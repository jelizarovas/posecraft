import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editTimelineKeys} from '../src/timeline-editing.js';
import {DocumentStore} from '../src/commands.js';
import {readFileSync} from 'node:fs';
const starter=JSON.parse(readFileSync(new URL('../examples/characters/ona.json',import.meta.url),'utf8'));
import {sampleClip} from '../src/index.js';
const clip=()=>({duration:2,loop:false,tracks:{'head.rotation':[[0,0],[.5,10,'linear'],[1,20],[2,0]],'rightArm.rotation':[[.5,-30],[1,-50],[2,0]]}});
const select=[{track:'head.rotation',time:.5},{track:'rightArm.rotation',time:.5}];
test('multi-track move preserves values and spacing, keeps input immutable and rounds to milliseconds',()=>{
 const source=clip(),before=structuredClone(source),result=editTimelineKeys(source,select,{type:'move',offset:.23456});
 assert.deepEqual(source,before);assert.deepEqual(result.selection,select.map(r=>({...r,time:.735})));
 assert.deepEqual(result.clip.tracks['head.rotation'][1],[.735,10,'linear']);assert.deepEqual(result.clip.tracks['rightArm.rotation'][0],[.735,-30]);
});
test('copy and scaling preserve selected correspondence and scale around an explicit anchor',()=>{
 const result=editTimelineKeys(clip(),select,{type:'copy',offset:.25});
 assert.equal(result.clip.tracks['head.rotation'].length,5);assert.deepEqual(result.clip.tracks['rightArm.rotation'].slice(0,2),[[.5,-30],[.75,-30]]);
 const selection=[...select,{track:'head.rotation',time:1},{track:'rightArm.rotation',time:1}];
 const scaled=editTimelineKeys(clip(),selection,{type:'scale',factor:1.5,pivot:.5});
 assert.deepEqual(scaled.selection.map(r=>r.time),[.5,1.25,.5,1.25]);
});
test('collisions, rounded collapses and out-of-bounds edits reject the complete batch',()=>{
 const source=clip(),before=JSON.stringify(source);
 for(const operation of [{type:'move',offset:.5},{type:'copy',offset:0},{type:'move',offset:-1},{type:'scale',factor:10,pivot:0},{type:'scale',factor:0,pivot:0},{type:'move',offset:NaN}])assert.throws(()=>editTimelineKeys(source,select,operation));
 assert.throws(()=>editTimelineKeys(source,[...select,{track:'head.rotation',time:1}],{type:'scale',factor:.0001,pivot:0}));assert.equal(JSON.stringify(source),before);
});
test('easing changes outgoing interpolation, deletion removes empty tracks, stale selection rejected',()=>{
 const result=editTimelineKeys(clip(),select,{type:'easing',easing:'step'});assert.equal(sampleClip(result.clip,.75)['head.rotation'],10);assert.equal(sampleClip(result.clip,1)['head.rotation'],20);
 const refs=clip().tracks['rightArm.rotation'].map(([time])=>({track:'rightArm.rotation',time}));assert.equal(editTimelineKeys(clip(),refs,{type:'delete'}).clip.tracks['rightArm.rotation'],undefined);
 assert.throws(()=>editTimelineKeys(clip(),[{track:'head.rotation',time:.7}],{type:'delete'}));assert.throws(()=>editTimelineKeys(clip(),[],{type:'delete'}));
});
test('one batch is one validated revision with undo, redo and durable scene roundtrip',()=>{
 const store=new DocumentStore(starter),packId=store.document.actors[0].pack;
 store.transact([{op:'set',path:['packs',packId,'clips','wave'],value:clip()}]);const original=structuredClone(store.document);
 const result=editTimelineKeys(store.document.packs[packId].clips.wave,select,{type:'move',offset:.2});
 store.transact([{op:'set',path:['packs',packId,'clips','wave'],value:result.clip}]);assert.equal(store.document.revision,original.revision+1);
 store.undo();assert.deepEqual(store.document.packs[packId].clips.wave,original.packs[packId].clips.wave);store.redo();assert.deepEqual(new DocumentStore(JSON.parse(JSON.stringify(store.document))).document.packs[packId].clips.wave,result.clip);
});
test('selected-to-selected destinations are allowed when all source keys move away',()=>{
 const result=editTimelineKeys(clip(),[{track:'head.rotation',time:.5},{track:'head.rotation',time:1}],{type:'move',offset:.5});assert.deepEqual(result.clip.tracks['head.rotation'].map(k=>k[0]),[0,1,1.5,2]);
});
