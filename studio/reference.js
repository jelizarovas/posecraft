import {inspectRaster} from '../src/project-bundle.js';
// Captured frames live locally and can be carried in a portable project.
let database;
async function db(){if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open('posecraft-reference-frames',1);request.onupgradeneeded=()=>request.result.createObjectStore('frames');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return database;}
export async function saveReference(id,blob){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('frames','readwrite');tx.objectStore('frames').put(blob,id);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Reference storage was interrupted.'));});}
export async function loadReference(id){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction('frames').objectStore('frames').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function captureVideo(video,time){
 if(!Number.isFinite(video.duration)||video.readyState<1)throw new Error('Wait for the video to finish loading.');
 if(!Number.isFinite(time)||time<0||time>=video.duration)throw new Error('Choose a time within the video.');
 video.pause();let mediaTime=time;
 if(Math.abs(video.currentTime-time)>.00001||video.readyState<2){
  await new Promise((resolve,reject)=>{let callback,timer;const finish=error=>{clearTimeout(timer);video.removeEventListener('seeked',seeked);video.removeEventListener('error',failed);if(callback!==undefined)video.cancelVideoFrameCallback?.(callback);error?reject(error):resolve();};const failed=()=>finish(new Error('Video decoding failed.'));
   const seeked=()=>{if(!video.requestVideoFrameCallback)finish();};
   if(video.requestVideoFrameCallback)callback=video.requestVideoFrameCallback((_,meta)=>{mediaTime=meta.mediaTime;finish();});
   video.addEventListener('seeked',seeked);video.addEventListener('error',failed);timer=setTimeout(()=>finish(new Error('Frame decoding timed out. Try a browser-supported video codec.')),8000);video.currentTime=time;
  });
 }
 const scale=Math.min(1,2048/Math.max(video.videoWidth,video.videoHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not capture frame.');return {blob,time:mediaTime};
}

export async function validateReferenceImage(blob){
 inspectRaster(new Uint8Array(await blob.arrayBuffer()),blob.type);
 let bitmap;try{bitmap=await createImageBitmap(blob);if(!bitmap.width||!bitmap.height)throw new Error();}catch{throw new Error('Reference image could not be decoded. Use a valid PNG, JPEG or WebP.');}finally{bitmap?.close();}
}
// Fresh keys prevent an imported file from overwriting another project's media.
// All puts commit together. If saving the episode fails, remove that entire batch.
export async function installProjectReferences(project,assets,saveProject){
 const next=structuredClone(project),rows=[...assets].map(([old,blob])=>({old,id:'ref-'+crypto.randomUUID(),blob})),ids=new Map(rows.map(r=>[r.old,r.id]));
 for(const shot of next.shots)if(shot.reference)shot.reference.id=ids.get(shot.reference.id)||shot.reference.id;
 const database=await db();
 const batch=(remove=false)=>new Promise((resolve,reject)=>{const tx=database.transaction('frames','readwrite'),store=tx.objectStore('frames');let failure;tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Reference storage was interrupted.'));try{for(const row of rows)remove?store.delete(row.id):store.add(row.blob,row.id);}catch(error){failure=error;tx.abort();}});
 await batch();try{saveProject(next);}catch(error){await batch(true);throw error;}return next;
}
