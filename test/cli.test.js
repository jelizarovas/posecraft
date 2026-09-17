import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
test('agent CLI edits, validates, renders, simulates and rejects a stale revision',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'posecraft-cli-'));
 const run=(...args)=>execFileSync(process.execPath,['tools/cli.mjs',...args],{encoding:'utf8'});
 try {
  const request=path.join(dir,'edit.json'),out=path.join(dir,'out.json'),svg=path.join(dir,'out.svg');
  fs.writeFileSync(request,JSON.stringify({expectedRevision:0,commands:[{op:'set',path:['actors',0,'appearance','clothing'],value:'#bddae5'}]}));
  assert.equal(JSON.parse(run('edit','examples/ona.posecraft.json',request,out)).revision,1);
  assert.equal(JSON.parse(run('validate',out)).valid,true);
  run('preview',out,svg,'0.5');assert.ok(fs.readFileSync(svg,'utf8').includes('#bddae5'));
  const failed=spawnSync(process.execPath,['tools/cli.mjs','edit',out,request,out],{encoding:'utf8'});assert.equal(failed.status,1);assert.match(failed.stderr,/Revision conflict/);
  const scenario=path.join(dir,'scenario.json');fs.writeFileSync(scenario,JSON.stringify({duration:1,events:[{time:0,type:'input',actor:'ona',name:'greeting',value:true},{time:.2,type:'acceleration',ax:1500,ay:0}]}));
  const result=JSON.parse(run('simulate',out,scenario));assert.equal(result.frame.actors[0].state,'wave');assert.ok(result.frame.actors[0].spring.x<0);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
