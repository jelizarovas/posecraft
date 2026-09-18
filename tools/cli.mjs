#!/usr/bin/env node
import fs from 'node:fs';
import {assertEpisode,EpisodeController,episodeDuration,episodeCapabilities} from '../src/episode.js';
import { validateDocument, capabilities } from '../src/schema.js';
import { DocumentStore } from '../src/commands.js';
import { SceneController, STEP } from '../src/scene.js';
import { renderSVG } from '../src/svg.js';
const [command, filename, ...args] = process.argv.slice(2);
const read = file => { if (!file || fs.statSync(file).size > 5000000) throw new Error('Expected a JSON file under 5 MB.'); return JSON.parse(fs.readFileSync(file, 'utf8')); };
try {
  if(command?.startsWith('agent-')){
    const {createAgentService}=await import('./agent-service.mjs'),service=await createAgentService(process.cwd());let result;
    if(command==='agent-inspect')result=await service.inspect({file:filename});
    else if(command==='agent-validate')result=await service.validate({file:filename,proposal:args[0]});
    else if(command==='agent-propose')result=await service.propose({...read(args[0]),file:filename,output:args[1]});
    else if(command==='agent-apply')result=await service.apply({file:filename,proposal:args[0],output:args[1]});
    else if(command==='agent-simulate')result=await service.simulate({...read(args[0]),file:filename,proposal:args[1]});
    else if(command==='agent-preview')result=await service.preview({file:filename,output:args[0],time:Number(args[1]||0),format:args[0]?.toLowerCase().endsWith('.png')?'png':'svg',proposal:args[2]});
    else throw Error('Unknown agent command.');console.log(JSON.stringify(result,null,2));if(result.valid===false)process.exitCode=1;
  }
  else if (['episode-inspect','episode-validate','episode-preview'].includes(command)) {
    if(!filename||fs.statSync(filename).size>20000000)throw new Error('Expected an episode under 20 MB.');
    const project=assertEpisode(JSON.parse(fs.readFileSync(filename,'utf8')));
    if(command==='episode-inspect')console.log(JSON.stringify({id:project.id,revision:project.revision,fps:project.fps,size:project.size,duration:episodeDuration(project),scenes:Object.keys(project.scenes),shots:project.shots},null,2));
    else if(command==='episode-validate')console.log(JSON.stringify({valid:true}));
    else{if(!args[0])throw new Error('Supply output SVG path.');const frame=new EpisodeController(project).frame(Number(args[1]||0));fs.writeFileSync(args[0],renderSVG(project.scenes[frame.scene],frame).replace('width="100%" height="100%"',`width="${project.size.width}" height="${project.size.height}"`));console.log(JSON.stringify({output:args[0],time:frame.time,shot:frame.shot}));}
  }
  else if (command === 'capabilities') console.log(JSON.stringify({...capabilities,episode:episodeCapabilities}, null, 2));
  else if (['inspect','validate','edit','preview','simulate'].includes(command)) {
    const doc = read(filename);
    const validation = validateDocument(doc);
    if(command === 'validate') { console.log(JSON.stringify(validation,null,2)); if(!validation.valid) process.exitCode=1; }
    else {
      const store = new DocumentStore(doc);
      if(command === 'inspect') console.log(JSON.stringify({id:doc.id,revision:doc.revision,bounds:doc.bounds,actors:doc.actors,packs:Object.fromEntries(Object.entries(doc.packs).map(([id,p])=>[id,{joints:p.joints.map(j=>j.id),inputs:p.inputs,clips:Object.keys(p.clips),states:p.states,reaction:p.reaction,physics:p.physics?{bodies:Object.keys(p.physics.bodies),responses:Object.keys(p.physics.responses)}:null,appearanceDefaults:p.appearanceDefaults}]))},null,2));
      if(command === 'edit') {
        const request=read(args[0]); const result=store.transact(request.commands,request.expectedRevision);
        if(!Number.isSafeInteger(request.expectedRevision)) throw new Error('edit requires expectedRevision.');
        if(!args[1]) throw new Error('Supply a separate output JSON path.');
        fs.writeFileSync(args[1],JSON.stringify(result,null,2)+'\n',{flag:'wx'}); console.log(JSON.stringify({revision:result.revision,output:args[1]}));
      }
      if(command === 'preview') {
        const runtime = new SceneController(doc); const time=Number(args[1] || 0); runtime.seek(time);
        if(!args[0]) throw new Error('Supply an output SVG path.');
        fs.writeFileSync(args[0],renderSVG(doc,runtime.frame())); console.log(JSON.stringify({output:args[0],time:runtime.time}));
      }
      if(command === 'simulate') {
        const scenario=read(args[0]);
        if(!Number.isFinite(scenario.duration)||scenario.duration<0||scenario.duration>60||!Array.isArray(scenario.events)||scenario.events.length>10000) throw new Error('Scenario needs duration 0..60 and events array.');
        if(scenario.events.some((e,i)=>!Number.isFinite(e.time)||e.time<0||e.time>scenario.duration||(i&&e.time<scenario.events[i-1].time)||!['input','acceleration','behavior','interaction'].includes(e.type))) throw new Error('Events must be ordered and within the duration.');
        const runtime=new SceneController(doc), events=[]; runtime.subscribe(e=>events.push(e)); let cursor=0;
        while(runtime.time+STEP<=scenario.duration+1e-9){while(cursor<scenario.events.length&&scenario.events[cursor].time<=runtime.time+1e-9){const e=scenario.events[cursor++];if(e.type==='input')runtime.setInput(e.actor,e.name,e.value);else if(e.type==='behavior')runtime.setBehavior(e.actor,e.value);else if(e.type==='interaction')runtime.interact(e.actor,e.interaction,e.strength);else runtime.setAcceleration(e.ax,e.ay);} runtime.step(STEP);}
        console.log(JSON.stringify({engineVersion:'0.1.0',schemaVersion:doc.schemaVersion,revision:doc.revision,seed:0,fixedStep:STEP,frame:runtime.frame(),events},null,2));
      }
    }
  } else console.log('Posecraft CLI\n  capabilities\n  inspect scene.json\n  validate scene.json\n  edit scene.json transaction.json output.json\n  preview scene.json output.svg [seconds]\n  simulate scene.json scenario.json\n  agent-inspect scene.json\n  agent-validate scene.json [proposal.json]\n  agent-propose scene.json request.json proposal.json\n  agent-apply scene.json proposal.json output.json\n  agent-simulate scene.json scenario.json [proposal.json]\n  agent-preview scene.json output.svg|png [seconds] [proposal.json]\n  episode-validate episode.json\n  episode-inspect episode.json\n  episode-preview episode.json output.svg [seconds]');
} catch(error) { console.error(JSON.stringify({error:error.message,diagnostics:error.diagnostics})); process.exitCode=1; }
