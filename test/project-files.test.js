import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectFiles} from '../studio/project-files.js';

function fixture(){
 let doc={id:'draft',value:1},disk=JSON.stringify({id:'local',value:2}),remembered=null,permission='granted',writes=0,backups=[];
 const handle={name:'local.posecraft.json',queryPermission:async()=>permission,requestPermission:async()=>permission,getFile:async()=>({size:disk.length,text:async()=>disk}),createWritable:async()=>({write:async text=>{disk=text;writes++;},close:async()=>{},abort:async()=>{}})};
 const messages=[],downloads=[],env={showOpenFilePicker:async()=>[handle],showSaveFilePicker:async()=>handle};
 const options={getDocument:()=>doc,load:next=>{doc=next;},validate:value=>{if(!value.id)throw new Error('Invalid project');},backup:value=>backups.push(structuredClone(value)),download:(...args)=>downloads.push(args),pickFallback:()=>downloads.push('picker'),notify:message=>messages.push(message),environment:env,recent:{get:async()=>remembered,set:async value=>{remembered=value;}}};
 const api=createProjectFiles(options);
 return {api,options,handle,env,messages,downloads,backups,get doc(){return doc;},set doc(next){doc=next;},get disk(){return disk;},set disk(next){disk=next;},get writes(){return writes;},set permission(next){permission=next;}};
}
test('opens, saves to the same file, remembers and reopens with permission',async()=>{
 const f=fixture();await f.api.ready;assert.equal(await f.api.open(),true);assert.equal(f.doc.id,'local');assert.equal(f.backups[0].id,'draft');f.doc.value=3;assert.equal(f.api.state().dirty,true);await f.api.save();assert.equal(JSON.parse(f.disk).value,3);assert.equal(f.api.state().dirty,false);
 const next=createProjectFiles(f.options);await next.ready;assert.equal(next.state().recentName,'local.posecraft.json');await next.reopen();assert.equal(next.state().name,'local.posecraft.json');
 f.permission='denied';assert.equal(await next.save(),false);assert.match(f.messages.at(-1),/not granted/);
});
test('external changes and invalid open never replace existing work',async()=>{
 const f=fixture();await f.api.open();f.doc.value=7;f.disk='{"id":"changed","value":9}';assert.equal(await f.api.save(),false);assert.equal(f.writes,0);assert.equal(f.doc.value,7);assert.match(f.messages.at(-1),/changed outside/);
 f.disk='{"broken":true}';assert.equal(await f.api.open(),false);assert.equal(f.doc.value,7);
});
test('cancel keeps the document, binding and recovery intact',async()=>{
 const f=fixture();await f.api.open();f.env.showSaveFilePicker=async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'});};f.doc.value=8;const before=f.messages.length;assert.equal(await f.api.save(true),false);assert.equal(f.messages.length,before);assert.equal(f.api.state().name,'local.posecraft.json');assert.equal(f.api.state().dirty,true);
});
test('edits made during asynchronous save stay dirty',async()=>{
 const f=fixture();await f.api.open();f.doc.value=3;let release;const gate=new Promise(resolve=>{release=resolve;});f.handle.createWritable=async()=>({write:async()=>gate,close:async()=>{}});const saving=f.api.save();await new Promise(resolve=>setTimeout(resolve,0));f.doc.value=4;release();await saving;assert.equal(f.api.state().dirty,true);assert.match(f.messages.at(-1),/Newer edits/);
});
test('concurrent open detects edits and unsupported browsers keep import/download',async()=>{
 const f=fixture();let release;f.handle.getFile=async()=>{await new Promise(resolve=>{release=resolve;});return {size:20,text:async()=>'{"id":"late"}'};};const opening=f.api.open();await new Promise(resolve=>setTimeout(resolve,0));f.doc.value=5;release();assert.equal(await opening,false);assert.equal(f.doc.value,5);
 const fallback=createProjectFiles({...f.options,environment:{}});fallback.open();assert.equal(f.downloads.at(-1),'picker');await fallback.save();assert.match(f.downloads.at(-1)[0],/posecraft.json/);
});
