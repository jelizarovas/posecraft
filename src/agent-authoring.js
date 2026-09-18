import {assertDocument,validateDocument} from './schema.js';
import {DocumentStore} from './commands.js';

const id=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/,record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>structuredClone(v);
function reachable(initial,edges){const seen=new Set([initial]),queue=[initial];for(let i=0;i<queue.length;i++)for(const e of edges)if(e.from===queue[i]&&!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}return seen;}

/** Static diagnostics are conservative: conditions are not proven satisfiable. */
export function diagnoseScene(document,{maxDiagnostics=100}={}){
 if(!Number.isInteger(maxDiagnostics)||maxDiagnostics<1||maxDiagnostics>500)throw Error('maxDiagnostics must be 1..500.');
 const validation=validateDocument(document),diagnostics=[];let total=0;const add=(severity,code,path,message,details)=>{total++;if(diagnostics.length<maxDiagnostics)diagnostics.push({severity,code,path,message,...(details?{details}:{})});};
 for(const e of validation.errors)add('error',/^objects\..*\.owner/.test(e.path)?'invalid-ownership':'invalid-data',e.path,e.message);if(!validation.valid)return {valid:false,diagnostics,truncated:total>diagnostics.length};
 const graph=document.behaviorGraph;if(graph){const seen=reachable(graph.initial,graph.edges);for(const state of Object.keys(graph.states))if(!seen.has(state))add('warning','unreachable-state','behaviorGraph.states.'+state,'No structural path from the initial behavior state.');}
 for(const [packId,p]of Object.entries(document.packs)){
  const edges=Object.entries(p.states).flatMap(([from,s])=>(s.transitions||[]).map(e=>({from,to:e.to}))),seen=reachable(p.initial,edges);for(const state of Object.keys(p.states))if(!seen.has(state))add('warning','unreachable-state',`packs.${packId}.states.${state}`,'No input-state transition path from the initial state; direct preview remains possible.');
  for(const [clipId,clip]of Object.entries(p.clips))for(const [channel,keys]of Object.entries(clip.tracks)){
   const angular=/\.(rotation|yaw)$/.test(channel),delta=(a,b)=>angular?Math.abs(((b-a+180)%360+360)%360-180):Math.abs(b-a),threshold=angular?45:/\.(opacity|bend)$/.test(channel)?.5:32;
   for(let i=1;i<keys.length;i++)if(keys[i-1][2]!=='step'&&keys[i][0]-keys[i-1][0]<=1/120+1e-9&&delta(keys[i-1][1],keys[i][1])>threshold)add('warning','rapid-track-change',`packs.${packId}.clips.${clipId}.tracks.${channel}`,'A non-step segment changes sharply within one simulation tick.',{start:keys[i-1][0],end:keys[i][0]});
   if(clip.loop&&keys.length>1&&!keys.some(k=>k[2]==='step')&&delta(keys.at(-1)[1],keys[0][1])>threshold)add('warning','loop-seam',`packs.${packId}.clips.${clipId}.tracks.${channel}`,'Loop endpoints differ substantially; check the intended wrap or author an explicit step.');
  }
 }
 return {valid:true,diagnostics,truncated:total>diagnostics.length};
}

export function inspectScene(document){const d=assertDocument(document);return {id:d.id,name:d.name,revision:d.revision,bounds:copy(d.bounds),requiredFeatures:[...(d.requiredFeatures||[])],actors:copy(d.actors),objects:copy(d.objects||[]),props:copy(d.props||[]),packs:Object.fromEntries(Object.entries(d.packs).map(([key,p])=>[key,{name:p.name,joints:copy(p.joints),parts:p.parts.map(v=>v.id),inputs:copy(p.inputs),clips:Object.fromEntries(Object.entries(p.clips).map(([id,c])=>[id,{duration:c.duration,loop:c.loop,tracks:Object.keys(c.tracks),keys:Object.values(c.tracks).reduce((n,t)=>n+t.length,0)}])),states:copy(p.states)}])),contacts:copy(d.contacts||[]),interactions:copy(d.interactions||[]),diagnostics:diagnoseScene(d)};}

/** Builders only author existing scene data. They do not synthesize locomotion. */
export function proposeSceneEdit(document,{expectedRevision,operations}={}){
 const store=new DocumentStore(document);if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==document.revision)throw Error(`Revision conflict: expected ${expectedRevision}, current ${document.revision}.`);
 if(!Array.isArray(operations)||!operations.length||operations.length>16)throw Error('Supply 1..16 semantic operations.');
 const draft=copy(document),commands=[],summary=[],features=new Set(document.requiredFeatures||[]);
 for(const op of operations){if(!record(op))throw Error('Expected a semantic operation.');
  if(op.type==='create-clip'){
   if(!id.test(op.pack)||!id.test(op.id)||!draft.packs[op.pack])throw Error('create-clip needs an existing pack and stable clip ID.');if(Object.hasOwn(draft.packs[op.pack].clips,op.id))throw Error('Clip already exists: '+op.id);
   const value={duration:op.duration,loop:op.loop??false,tracks:copy(op.tracks)};draft.packs[op.pack].clips[op.id]=value;commands.push({op:'set',path:['packs',op.pack,'clips',op.id],value});summary.push({type:op.type,pack:op.pack,id:op.id,description:`Create ${op.duration}s clip with ${Object.keys(op.tracks||{}).length} tracks.`});
  }else if(op.type==='create-contact'||op.type==='create-interaction'){
   const key=op.type==='create-contact'?'contacts':'interactions',value=copy(op.value);if(!record(value)||!id.test(value.id))throw Error(op.type+' needs a complete value with a stable ID.');if((draft[key]||[]).some(v=>v.id===value.id))throw Error('ID already exists: '+value.id);(draft[key]??=[]).push(value);features.add(key==='contacts'?'contacts':'pointer-interactions');if(key==='contacts'&&(['object','prop'].includes(value.target?.type)||value.fadeIn!==undefined||value.fadeOut!==undefined))features.add('contact-targets');summary.push({type:op.type,id:value.id,description:`Create ${key==='contacts'?'contact constraint':'pointer interaction'} for ${value.actor}.`});
  }else throw Error('Unsupported semantic operation: '+op.type);
 }
 for(const key of ['contacts','interactions'])if(operations.some(op=>op.type===(key==='contacts'?'create-contact':'create-interaction')))commands.push({op:'set',path:[key],value:draft[key]});
 if([...features].some(f=>!document.requiredFeatures?.includes(f)))commands.push({op:'set',path:['requiredFeatures'],value:[...features]});
 const proposed=store.transact(commands,expectedRevision);return {format:'posecraft-edit-proposal',version:1,scene:document.id,expectedRevision,commands:copy(commands),summary,diagnostics:diagnoseScene(proposed)};
}

export function applySceneProposal(document,proposal){if(!record(proposal)||proposal.format!=='posecraft-edit-proposal'||proposal.version!==1||proposal.scene!==document.id||!Number.isSafeInteger(proposal.expectedRevision))throw Error('Expected a proposal for this scene with an explicit revision.');return new DocumentStore(document).transact(proposal.commands,proposal.expectedRevision);}
