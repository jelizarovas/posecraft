import {assertEpisode} from './episode.js';

export const projectBundleLimits=Object.freeze({fileBytes:80000000,assetBytes:20000000,totalAssetBytes:40000000,assets:120,dimension:4096,pixels:16777216});
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const types=['image/png','image/jpeg','image/webp'];
const references=project=>[...new Set(project.shots.flatMap(s=>s.reference?[s.reference.id]:[]))];
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};

// Read dimensions before asking the browser decoder to allocate a bitmap.
export function inspectRaster(bytes,type){
 need(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=projectBundleLimits.assetBytes,'Reference image exceeds 20 MB or is empty.');
 need(types.includes(type),'Only PNG, JPEG and WebP reference images are supported.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(at,n)=>String.fromCharCode(...bytes.subarray(at,at+n));let width,height;
 if(type==='image/png'){
  need(bytes.length>=33&&bytes[0]===137&&ascii(1,7)==='PNG\r\n\x1a\n'&&ascii(12,4)==='IHDR','Invalid PNG reference.');width=v.getUint32(16);height=v.getUint32(20);
 }else if(type==='image/jpeg'){
  need(bytes.length>=4&&bytes[0]===255&&bytes[1]===216,'Invalid JPEG reference.');let at=2;
  while(at+4<=bytes.length){need(bytes[at]===255,'Invalid JPEG marker.');while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;need(at+2<=bytes.length,'Truncated JPEG reference.');const length=v.getUint16(at);need(length>=2&&at+length<=bytes.length,'Truncated JPEG reference.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){need(length>=8,'Invalid JPEG dimensions.');height=v.getUint16(at+3);width=v.getUint16(at+5);break;}at+=length;
  }
 }else{
  need(bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'&&v.getUint32(4,true)+8===bytes.length,'Invalid WebP reference.');const kind=ascii(12,4);
  if(kind==='VP8X'){need(!(bytes[20]&2),'Animated WebP references are not supported.');width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
  else if(kind==='VP8 '){need(bytes.length>=30&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42,'Invalid WebP frame.');width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
  else if(kind==='VP8L'){need(bytes[20]===47,'Invalid WebP frame.');width=1+bytes[21]+((bytes[22]&63)<<8);height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10);}
 }
 need(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=projectBundleLimits.dimension&&height<=projectBundleLimits.dimension&&width*height<=projectBundleLimits.pixels,'Reference dimensions must be within 4096 × 4096.');return {width,height};
}

export async function createProjectBundle(episode,loadReference,{validateImage}={}){
 const project=structuredClone(assertEpisode(episode)),assets=[];let total=0;const missing=[];
 for(const id of references(project)){
  const blob=await loadReference(id);if(!blob){missing.push(id);continue;}
  need(blob instanceof Blob,'Invalid stored reference: '+id);need(blob.size<=projectBundleLimits.assetBytes,'Reference exceeds 20 MB: '+id);total+=blob.size;need(total<=projectBundleLimits.totalAssetBytes,'References exceed the 40 MB portable-project limit.');
  const bytes=new Uint8Array(await blob.arrayBuffer());inspectRaster(bytes,blob.type);await validateImage?.(blob);
  assets.push({id,type:blob.type,bytes:bytes.length,sha256:await digest(bytes),data:encode(bytes)});
 }
 need(!missing.length,'Missing reference images: '+missing.join(', ')+'. Relink or remove them before saving a portable project.');
 const bundle={kind:'posecraft-project',schemaVersion:1,project,assets};need(new Blob([JSON.stringify(bundle)]).size<=projectBundleLimits.fileBytes,'Portable project exceeds 80 MB.');return bundle;
}

export async function readProjectBundle(value,{validateImage}={}){
 if(typeof value!=='string')need(new Blob([JSON.stringify(value)]).size<=projectBundleLimits.fileBytes,'Portable project exceeds 80 MB.');
 const bundle=typeof value==='string'?(need(new Blob([value]).size<=projectBundleLimits.fileBytes,'Portable project exceeds 80 MB.'),JSON.parse(value)):value;
 need(bundle&&bundle.kind==='posecraft-project'&&bundle.schemaVersion===1,'Expected a version 1 portable Posecraft project.');
 need(Object.keys(bundle).every(k=>['kind','schemaVersion','project','assets'].includes(k)),'Unknown portable-project field.');
 const project=structuredClone(assertEpisode(bundle.project));need(Array.isArray(bundle.assets)&&bundle.assets.length<=projectBundleLimits.assets,'Too many reference assets.');
 const wanted=new Set(references(project)),assets=new Map();let total=0;
 for(const a of bundle.assets){
  need(a&&Object.keys(a).every(k=>['id','type','bytes','sha256','data'].includes(k))&&wanted.has(a.id)&&!assets.has(a.id),'Unexpected or duplicate reference asset.');
  need(types.includes(a.type)&&Number.isSafeInteger(a.bytes)&&a.bytes>0&&a.bytes<=projectBundleLimits.assetBytes,'Invalid reference asset size or type.');
  total+=a.bytes;need(total<=projectBundleLimits.totalAssetBytes,'References exceed 40 MB.');
  need(typeof a.data==='string'&&a.data.length===4*Math.ceil(a.bytes/3)&&!/[^A-Za-z0-9+/=]/.test(a.data),'Invalid reference encoding.');
  const decoded=atob(a.data),bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));need(bytes.length===a.bytes&&encode(bytes)===a.data,'Invalid reference byte count or encoding.');
  need(typeof a.sha256==='string'&&a.sha256===await digest(bytes),'Corrupt reference image: '+a.id);inspectRaster(bytes,a.type);
  const blob=new Blob([bytes],{type:a.type});await validateImage?.(blob);assets.set(a.id,blob);
 }
 const missing=[...wanted].filter(id=>!assets.has(id));need(!missing.length,'Missing bundled reference images: '+missing.join(', '));return {project,assets};
}
