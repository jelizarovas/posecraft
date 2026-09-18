const ID=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/,reserved=new Set(['__proto__','prototype','constructor']);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export const SCENE_3D_LIMITS=Object.freeze({rigs:32,joints:128,chains:32,actors:64,objects:128,anchors:32,contacts:256,nodes:100000,depth:24,errors:100});

/** Validate a separate meters/Y-up document without normalizing or mutating it. */
function inspectScene3D(document){
 const errors=[],add=(path,message)=>{if(errors.length<SCENE_3D_LIMITS.errors)errors.push({path:path.length>512?path.slice(0,509)+'...':path,message});},check=(ok,path,message)=>{if(!ok)add(path,message);return !!ok;};
 let nodes=0;const active=new WeakSet();
 function json(v,path,depth){
  if(++nodes>SCENE_3D_LIMITS.nodes){add(path,'Scene exceeds the JSON resource budget.');return;}
  if(depth>SCENE_3D_LIMITS.depth){add(path,'Scene nesting is too deep.');return;}
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){check(Number.isFinite(v),path,'Expected a finite JSON number.');return;}
  if(typeof v==='string'){check(v.length<=1024,path,'JSON strings are limited to 1024 characters.');return;}
  if(typeof v!=='object'){add(path,'Expected plain JSON data.');return;}
  if(active.has(v)){add(path,'Cyclic data is not JSON.');return;}
  if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v))){add(path,'Expected a plain JSON object.');return;}
  if(Object.getOwnPropertySymbols(v).length){add(path,'Symbol properties are not JSON.');return;}
  const entries=Object.getOwnPropertyDescriptors(v);active.add(v);
  if(Array.isArray(v))check(v.length<=SCENE_3D_LIMITS.nodes,path,'Array exceeds the resource budget.');
  for(const [key,d]of Object.entries(entries)){
   if(Array.isArray(v)&&key==='length')continue;
   if(key.length>128){add(path,'JSON field names are limited to 128 characters.');continue;}
   if(reserved.has(key)||Array.isArray(v)&&!/^\d+$/.test(key)){add(path+'.'+key,'Unsupported JSON property.');continue;}
   if(!Object.hasOwn(d,'value')||!d.enumerable){add(path+'.'+key,'Accessors and non-enumerable data are not supported.');continue;}
   json(d.value,path+'.'+key,depth+1);if(nodes>SCENE_3D_LIMITS.nodes)break;
  }
  if(Array.isArray(v))check(Object.keys(entries).length===v.length+1,path,'Sparse arrays are not supported.');active.delete(v);
 }
 json(document,'$',0);if(errors.length)return {valid:false,errors};
 const fields=(v,allowed,path)=>{if(!check(record(v),path,'Expected an object.'))return false;for(const key of Object.keys(v))check(allowed.includes(key),path+'.'+key,'Unknown field.');return true;};
 const stableId=(v,path)=>check(typeof v==='string'&&ID.test(v)&&!reserved.has(v),path,'Expected an ID starting with a letter, up to 64 letters, digits, hyphens or underscores.');
 const vector=(v,path,positive=false)=>check(Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,positive?.0001:-10000,10000)),path,positive?'Expected three positive dimensions in meters.':'Expected three finite coordinates within ±10000 meters.');
 const quaternion=(v,path)=>check(Array.isArray(v)&&v.length===4&&v.every(n=>finite(n,-1,1))&&Math.abs(Math.hypot(...v)-1)<=1e-5,path,'Expected a unit quaternion [x,y,z,w].');
 const transform=(v,path)=>{if(fields(v,['position','rotation','scale'],path)){vector(v.position,path+'.position');quaternion(v.rotation,path+'.rotation');check(finite(v.scale,.001,1000),path+'.scale','Uniform scale must be .001..1000.');}};
 const list=(v,max,path)=>{if(!check(Array.isArray(v)&&v.length<=max,path,`Expected an array with at most ${max} entries.`))return [];return v;};
 if(!fields(document,['kind','schemaVersion','units','up','id','name','revision','rigs','actors','objects','contacts','camera'],'$'))return {valid:false,errors};
 check(document.kind==='scene3d','$.kind','Expected scene3d; legacy scenes use their existing schema.');check(document.schemaVersion===1,'$.schemaVersion','Expected schema version 1.');check(document.units==='meters','$.units','Native 3D scenes use meters.');check(document.up==='Y','$.up','Native 3D scenes use Y-up and Z-forward.');stableId(document.id,'$.id');check(typeof document.name==='string'&&document.name.trim().length>0&&document.name.length<=100&&!/[\u0000-\u001f\u007f]/.test(document.name),'$.name','Expected a nonempty name of at most 100 characters.');check(Number.isSafeInteger(document.revision)&&document.revision>=0,'$.revision','Expected a nonnegative integer revision.');
 const rigs=record(document.rigs)?document.rigs:{};check(record(document.rigs)&&Object.keys(rigs).length>0&&Object.keys(rigs).length<=SCENE_3D_LIMITS.rigs,'$.rigs','Expected 1..32 rigs.');
 const rigJoints=new Map();
 for(const [id,rig]of Object.entries(rigs)){
  const path='$.rigs.'+id;stableId(id,path);if(!fields(rig,['joints','chains'],path))continue;
  const joints=list(rig.joints,128,path+'.joints'),byId=new Map();check(joints.length>0,path+'.joints','A rig needs at least one joint.');
  for(const [i,j]of joints.entries()){const p=path+'.joints.'+i;if(!fields(j,['id','parent','position','rotation'],p))continue;stableId(j.id,p+'.id');check(!byId.has(j.id),p+'.id','Duplicate joint ID.');byId.set(j.id,j);check(j.parent===null||typeof j.parent==='string',p+'.parent','Expected a parent joint ID or null.');vector(j.position,p+'.position');quaternion(j.rotation,p+'.rotation');}
  rigJoints.set(id,byId);check(joints.filter(j=>j?.parent===null).length===1,path+'.joints','A rig must have exactly one root.');
  for(const [i,j]of joints.entries()){if(!record(j))continue;const p=path+'.joints.'+i+'.parent';check(j.parent===null||byId.has(j.parent),p,'Missing parent joint.');let current=j;const seen=new Set();while(current){if(seen.has(current.id)){add(p,'Joint hierarchy contains a cycle.');break;}seen.add(current.id);current=byId.get(current.parent);}}
  const chains=record(rig.chains)?rig.chains:{};check(record(rig.chains)&&Object.keys(chains).length<=32,path+'.chains','Expected at most 32 named chains.');
  for(const [role,chain]of Object.entries(chains)){const p=path+'.chains.'+role;stableId(role,p);if(!fields(chain,['root','middle','tip','pole','bend'],p))continue;for(const key of ['root','middle','tip'])check(typeof chain[key]==='string'&&byId.has(chain[key]),p+'.'+key,'Missing chain joint.');const middle=byId.get(chain.middle),tip=byId.get(chain.tip);check(new Set([chain.root,chain.middle,chain.tip]).size===3&&middle?.parent===chain.root&&tip?.parent===chain.middle,p,'Expected three different directly connected joints.');for(const [key,j]of [['middle',middle],['tip',tip]])check(Array.isArray(j?.position)&&j.position.length===3&&j.position.every(n=>finite(n,-10000,10000))&&Math.hypot(...j.position)>1e-8,p+'.'+key,'A chain segment needs nonzero rest length.');vector(chain.pole,p+'.pole');if(fields(chain.bend,['min','max'],p+'.bend'))check(finite(chain.bend.min,0,Math.PI)&&finite(chain.bend.max,0,Math.PI)&&chain.bend.min<=chain.bend.max,p+'.bend','Bend limits must satisfy 0 ≤ min ≤ max ≤ π radians.');}
 }
 const actors=new Map();
 for(const [i,a]of list(document.actors,64,'$.actors').entries()){
  const p='$.actors.'+i;if(!fields(a,['id','rig','transform','pose'],p))continue;stableId(a.id,p+'.id');check(!actors.has(a.id),p+'.id','Duplicate actor ID.');actors.set(a.id,a);check(typeof a.rig==='string'&&Object.hasOwn(rigs,a.rig),p+'.rig','Missing rig.');transform(a.transform,p+'.transform');
  if(check(record(a.pose)&&Object.keys(a.pose).length<=128,p+'.pose','Expected joint-local pose overrides.'))for(const [joint,value]of Object.entries(a.pose)){const q=p+'.pose.'+joint;check(rigJoints.get(a.rig)?.has(joint),q,'Missing pose joint.');if(fields(value,['position','rotation'],q)){check(Object.keys(value).length>0,q,'A pose override needs position or rotation.');if(value.position!==undefined)vector(value.position,q+'.position');if(value.rotation!==undefined)quaternion(value.rotation,q+'.rotation');}}
 }
 const objects=new Map();
 for(const [i,o]of list(document.objects,128,'$.objects').entries()){
  const p='$.objects.'+i;if(!fields(o,['id','transform','geometry','anchors'],p))continue;stableId(o.id,p+'.id');check(!objects.has(o.id),p+'.id','Duplicate object ID.');objects.set(o.id,o);transform(o.transform,p+'.transform');if(fields(o.geometry,['type','size'],p+'.geometry')){check(o.geometry.type==='box',p+'.geometry.type','Only box geometry is supported.');vector(o.geometry.size,p+'.geometry.size',true);}
  if(check(record(o.anchors)&&Object.keys(o.anchors).length<=32,p+'.anchors','Expected at most 32 named anchors.'))for(const [id,anchor]of Object.entries(o.anchors)){const q=p+'.anchors.'+id;stableId(id,q);if(fields(anchor,['position','rotation'],q)){vector(anchor.position,q+'.position');quaternion(anchor.rotation,q+'.rotation');}}
 }
 const ids=new Set(),activeChains=new Set();
 for(const [i,c]of list(document.contacts,256,'$.contacts').entries()){
  const p='$.contacts.'+i;if(!fields(c,['id','actor','chain','target','enabled'],p))continue;stableId(c.id,p+'.id');check(!ids.has(c.id),p+'.id','Duplicate contact ID.');ids.add(c.id);const actor=actors.get(c.actor);check(!!actor,p+'.actor','Missing contact actor.');check(typeof c.chain==='string'&&Object.hasOwn(rigs[actor?.rig]?.chains||{},c.chain),p+'.chain','Missing named rig chain.');check(typeof c.enabled==='boolean',p+'.enabled','Expected boolean.');if(c.enabled){const source=c.actor+'/'+c.chain;check(!activeChains.has(source),p+'.chain','An actor chain can have only one enabled contact.');activeChains.add(source);}
  if(fields(c.target,['object','anchor'],p+'.target')){const o=objects.get(c.target.object);check(!!o,p+'.target.object','Missing target object.');check(typeof c.target.anchor==='string'&&Object.hasOwn(o?.anchors||{},c.target.anchor),p+'.target.anchor','Missing target anchor.');}
 }
 if(fields(document.camera,['position','target','projection','height'],'$.camera')){const c=document.camera;vector(c.position,'$.camera.position');vector(c.target,'$.camera.target');if(Array.isArray(c.position)&&c.position.length===3&&c.position.every(n=>finite(n,-10000,10000))&&Array.isArray(c.target)&&c.target.length===3&&c.target.every(n=>finite(n,-10000,10000)))check(Math.hypot(...c.position.map((v,i)=>v-c.target[i]))>1e-8,'$.camera.target','Camera position and target must differ.');check(c.projection==='orthographic','$.camera.projection','Only orthographic projection is supported.');check(finite(c.height,.01,10000),'$.camera.height','Camera height must be .01..10000 meters.');}
 return {valid:errors.length===0,errors};
}
export function validateScene3D(document){try{return inspectScene3D(document);}catch{return {valid:false,errors:[{path:'$',message:'Scene data could not be inspected as plain JSON.'}]};}}
export function assertScene3D(document){const result=validateScene3D(document);if(!result.valid)throw Error('Invalid 3D scene: '+result.errors.map(e=>e.path+': '+e.message).join('; '));return document;}
