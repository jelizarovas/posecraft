const types=[{description:'Posecraft project',accept:{'application/json':['.json']}}];
const serialize=doc=>JSON.stringify(doc,null,2);
const canceled=error=>error?.name==='AbortError';

export function recentProjectStore(indexedDB=globalThis.indexedDB){
 async function access(mode,value){
  if(!indexedDB)return null;
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('posecraft-project-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('recent');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('recent',mode),store=tx.objectStore('recent'),request=mode==='readonly'?store.get('project'):store.put(value,'project');let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
 }
 return {get:()=>access('readonly'),set:value=>access('readwrite',value)};
}

/** File handles stay on this device. Project contents are never uploaded. */
export function createProjectFiles({getDocument,load,validate,backup,download,pickFallback,notify,onChange=()=>{},environment=globalThis,recent=recentProjectStore(),confirmReplace=()=>true}){
 let handle=null,recentHandle=null,diskText=null,savedText=null,busy=false,generation=0;
 const supported=typeof environment.showOpenFilePicker==='function'&&typeof environment.showSaveFilePicker==='function';
 const state=()=>({supported,busy,name:handle?.name||null,recentName:recentHandle?.name||null,dirty:!!handle&&serialize(getDocument())!==savedText});
 const changed=()=>onChange(state());
 async function run(operation){if(busy)return false;busy=true;changed();try{return await operation();}catch(error){if(!canceled(error))notify(error.message);return false;}finally{busy=false;changed();}}
 async function remember(next){recentHandle=next;try{await recent.set(next);}catch{notify('Project saved on this device, but this browser could not remember its file permission.');}}
 async function permission(next,mode){if(!next.queryPermission)return;const opts={mode};if(await next.queryPermission(opts)==='granted')return;if(await next.requestPermission(opts)!=='granted')throw new Error('File access was not granted. Your draft is unchanged.');}
 async function read(next){const file=await next.getFile();if(file.size>5000000)throw new Error('Scene exceeds 5 MB.');const text=await file.text(),doc=JSON.parse(text);validate(doc);return {text,doc};}
 async function openHandle(next){const before=serialize(getDocument());await permission(next,'read');const opened=await read(next);if(serialize(getDocument())!==before)throw new Error('The draft changed while the file was opening. Open it again when you are ready.');if(!confirmReplace())return false;backup(getDocument());load(opened.doc);handle=next;diskText=opened.text;savedText=serialize(getDocument());await remember(next);notify('Opened '+next.name+'. Changes also stay in your recovery draft.');return true;}
 const api={
  state,changed,
  ready:Promise.resolve().then(()=>recent.get()).then(next=>{recentHandle=next||null;changed();}).catch(()=>{}),
  detach(){generation++;handle=null;diskText=null;savedText=null;changed();},
  open:()=>supported?run(async()=>{const [next]=await environment.showOpenFilePicker({types,multiple:false});return next?openHandle(next):false;}):pickFallback(),
  reopen:()=>run(async()=>{if(!recentHandle)throw new Error('No recent local project.');return openHandle(recentHandle);}),
  importFile:file=>run(async()=>{const before=serialize(getDocument());if(file.size>5000000)throw new Error('Scene exceeds 5 MB.');const doc=JSON.parse(await file.text());validate(doc);if(serialize(getDocument())!==before)throw new Error('The draft changed while opening. Please open the file again.');if(!confirmReplace())return false;backup(getDocument());load(doc);api.detach();notify('Project opened. Save downloads a copy in this browser.');return true;}),
  save:(as=false)=>run(async()=>{
   const text=serialize(getDocument()),name=getDocument().id+'.posecraft.json',started=generation;
   if(!supported){download(name,text);notify('Project downloaded. Your recovery draft stays on this device.');return true;}
   const next=as||!handle?await environment.showSaveFilePicker({types,suggestedName:handle?.name||name}):handle;
   await permission(next,'readwrite');
   // Compare exact contents, not timestamps, which can have coarse resolution.
   const same=next===handle||!!(handle&&next.isSameEntry&&await next.isSameEntry(handle));
   if(same&&(await next.getFile()).size>5000000)throw new Error('The project file changed outside Studio. Reopen it or use Save as.');
   if(same&&await (await next.getFile()).text()!==diskText)throw new Error('The project file changed outside Studio. Reopen it or use Save as.');
   const writable=await next.createWritable();try{await writable.write(text);await writable.close();}catch(error){try{await writable.abort();}catch{}throw error;}
   if(started===generation){handle=next;diskText=text;savedText=text;}await remember(next);
   notify(serialize(getDocument())===text?'Saved '+next.name+'.':'Saved '+next.name+'. Newer edits are still in your recovery draft; save again to write them.');return true;
  })
 };
 return api;
}
