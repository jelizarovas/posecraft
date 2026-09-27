import {createWwzardArtwork} from './wwzard-artwork.js';
import {addWwwzardHostTransition} from './wwwzard-host-transition.js';
import {addWwwzardNightLighting} from './wwwzard-night.js';

// The portfolio's project illustration is an editable drafting scene. Artwork,
// deformations, pauses and interruptions are all ordinary exported scene data.
const shade=(dark,light)=>({type:'linear',x1:0,y1:1,x2:1,y2:0,stops:[[0,dark],[1,light]]});
const path=(id,d,fill,gradient,joint='root')=>({id,joint,d,fill,...(gradient?{gradient}:{})});
const clip=(duration,tracks={})=>({duration,loop:false,tracks});
const contour=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,pair=>move(...pair.split(/\s+/).map(Number)).map(n=>+n.toFixed(3)).join(' '));
const actor=(id,pack,depth)=>({id,name:id,pack,layer:'characters',transform:{x:0,y:0,rotation:0,scale:1},depth:{value:depth},unlit:true});
const stillPack=(name,parts)=>({name,joints:[{id:'root',parent:null,x:0,y:0,rotation:0,length:0,min:-180,max:180}],parts,inputs:{},clips:{still:{duration:1,loop:true,tracks:{}}},states:{still:{clip:'still',transitions:[]}},initial:'still'});

function workbench(){
  const parts=[
    path('plan-shadow','M204 336L313 277L388 318L278 382Z','#a4b2e5'),
    path('plan-paper','M202 332L312 274L385 315L275 376Z','#548ce3',shade('#327bc9','#70baff')),
    path('plan-border','M212 331L312 280L375 315L275 368Z','none'),
  ];
  // A grid on the same isometric plane as the sheet, rather than screen axes.
  const point=(u,v)=>[202+110*u+73*v,332-58*u+41*v];
  for(let i=1;i<9;i++){
    const a=point(i/9,0),b=point(i/9,1),c=point(0,i/9),d=point(1,i/9);
    parts.push({...path('grid-u-'+i,`M${a}L${b}`,'none'),stroke:'#9ad0f4',strokeWidth:.65,opacity:.52});
    parts.push({...path('grid-v-'+i,`M${c}L${d}`,'none'),stroke:'#9ad0f4',strokeWidth:.65,opacity:.52});
  }
  parts.push(
    {...path('car-plan','M260 338L270 325L292 313L308 312L326 321L331 332L318 340L286 354L271 350ZM270 325L291 333L308 312M291 333L295 348M280 321L300 330M313 317L316 327','none'),stroke:'#d0edff',strokeWidth:1.8},
    {...path('plan-wheels','M274 345Q269 342 272 337Q275 333 280 337Q284 341 280 345ZM311 334Q305 331 309 327Q313 323 317 326Q321 331 316 334Z','none'),stroke:'#d4efff',strokeWidth:1.6},
    path('paper-roll-shadow','M312 274L321 270L390 309L385 321Z','#4b84cb'),
    path('paper-roll','M312 272Q313 267 320 269L387 307Q395 312 389 320L383 322Q388 313 379 309Z','#adcdfd',shade('#72a9ed','#d9e6ff')),
    {...path('roll-opening','M384 310Q393 311 389 318Q385 324 381 319Q378 315 384 312','none'),stroke:'#467bbb',strokeWidth:1.6},
    path('model-shadow','M282 413Q328 390 380 412L369 434Q331 455 287 433Z','#bdc2ed'),
    path('plinth-side','M286 411Q328 390 377 411L377 423Q330 449 286 425Z','#6e62ac',shade('#504683','#9683c6')),
    path('plinth-top','M286 411Q330 386 377 410Q379 420 334 436Q302 430 286 417Z','#edf0ff',shade('#b9c9f0','#fbfaff')),
    path('car-underbody','M304 396L324 380L354 379L367 394L362 409L323 422L303 411Z','#463767'),
    path('car-body','M301 391L316 382L325 363L347 354L361 363L368 383L367 398L325 417L301 405Z','#883caf',shade('#642991','#c166d2')),
    path('car-hood','M301 391L321 383L341 393L324 405L301 400Z','#a563d4',shade('#7f3fad','#c184e2')),
    path('car-roof','M325 363L346 354L357 362L336 372Z','#bd69d3',shade('#8c42bc','#d18de5')),
    path('car-front-window','M324 368L335 375L330 387L318 381Z','#504781',shade('#363961','#6768a0')),
    path('car-side-window','M339 375L357 366L362 383L335 395Z','#47386c',shade('#332e58','#70649f')),
    path('car-window-divider','M349 371L351 388L347 390L345 373Z','#a356c0'),
    path('front-wheel','M310 400Q316 396 320 401Q326 410 318 416Q311 420 307 413Q304 405 310 400Z','#3e375e'),
    path('front-hub','M311 405Q315 402 317 406Q320 411 315 413Q310 414 311 405Z','#ddd9f2'),
    path('back-wheel','M349 386Q356 382 360 388Q364 396 357 401Q350 405 346 398Q343 391 349 386Z','#3e375e'),
    path('back-hub','M350 391Q354 388 356 392Q358 397 353 398Q349 399 350 391Z','#ddd9f2'),
    path('headlight','M302 394Q306 392 308 395L309 399Q305 402 302 399Z','#ffedb4'),
    path('cup-back','M177 367L192 359L208 368L191 378Z','#8483cb'),
    path('cup-pencil-gold','M189 370L191 334Q194 328 198 332L196 370Z','#f2c344',shade('#dc982e','#ffe189')),
    path('cup-pencil-purple','M184 373L175 337Q175 332 179 332Q183 332 183 336L192 374Z','#9256c6',shade('#6b3eaa','#bc8be0')),
    path('cup-left','M177 367L191 377L191 402L177 393Z','#8993da',shade('#6676bc','#b1b9ed')),
    path('cup-right','M191 377L208 368L206 392L191 402Z','#a5ace6',shade('#7b80c6','#c2c8f7')),
    path('eraser-side','M225 393L246 381L260 389L260 398L238 410L225 403Z','#c6c5e8'),
    path('eraser-top','M225 393L246 381L260 389L238 402Z','#f3eeff'),
    path('eraser-purple','M225 393L236 387L249 395L238 402L238 410L225 403Z','#9755c9',shade('#7745ad','#bd81de')),
  );
  // Keep the complete display base supported by the tabletop, including its
  // far corner. This transform belongs to the authored prop, not the renderer.
  const modelIds=new Set(['model-shadow','plinth-side','plinth-top','car-underbody','car-body','car-hood','car-roof','car-front-window','car-side-window','car-window-divider','front-wheel','front-hub','back-wheel','back-hub','headlight']);
  for(const part of parts)if(modelIds.has(part.id))part.transform='translate(33.2 15) scale(.9)';
  return stillPack('Blueprint, pencils and a model car',parts);
}

export function createWwwzardProjectsScene(){
  const art=createWwzardArtwork(),wizard=art.wwzard;
  wizard.name='Wwwzard drafting a project';
  wizard.parts=wizard.parts.filter(part=>!part.id.startsWith('magic-'));
  wizard.joints=wizard.joints.filter(joint=>!joint.id.startsWith('magic-'));
  // Small authored elbow/cuff deformation maintains the drafting hand contact.
  // The pencil is bound to that same hand, with its point extending to the plan.
  for(const id of ['left-sleeve','left-sleeve-shadow']){
    const part=wizard.parts.find(part=>part.id===id);
    part.spatial.morph={channel:'leftArm.bend',target:contour(part.d,(x,y)=>{
      const weight=Math.max(0,Math.min(1,(x-191)/76));return [x+18*weight,y-48*weight];
    })};
  }
  const pencil=[
    path('draft-pencil-wood','M262 284L267 281L289 326L287 335L281 329Z','#e8bd72'),
    path('draft-pencil-gold','M262 284L267 281L287 322L282 326Z','#ffd775',shade('#dc9c33','#fff0a0')),
    path('draft-pencil-lead','M287 328L287 335L282 330Z','#55536e'),
    path('draft-pencil-glint','M264 283L265 282L285 323L284 324Z','#fff0b1'),
  ];
  for(const part of pencil){part.joint='leftHand';part.transform='translate(-275 -317)';part.spatial={sceneDepth:{value:39}};}
  // Behind the palm, ahead of the plan; the fingers conceal the pencil's grip.
  wizard.parts.splice(wizard.parts.findIndex(part=>part.id==='left-hand'),0,...pencil);
  const draftKeys=[[0,0],[.35,0],[.7,.28],[.95,.08],[1.3,.32],[1.55,.08],[1.9,.24],[2.2,0],[2.6,0]];
  const clips={
    draft:clip(2.6,{
      'leftArm.bend':draftKeys,
      'leftHand.x':draftKeys.map(([t,v])=>[t,v*18]),
      'leftHand.y':draftKeys.map(([t,v])=>[t,-v*48]),
      'head.rotation':[[0,0],[.4,0],[1.1,5],[1.9,5],[2.6,0]],
      'hatTip.bend':[[0,0],[1.1,.25],[1.9,.25],[2.6,0]],
    }),
    inspect:clip(3.6,{
      'leftArm.bend':[[0,0],[.4,.25],[.85,1],[1.6,1],[2.15,.5],[2.6,.5],[3.35,0],[3.6,0]],
      'leftHand.x':[[0,0],[.4,4.5],[.85,18],[1.6,18],[2.15,9],[2.6,9],[3.35,0],[3.6,0]],
      'leftHand.y':[[0,0],[.4,-12],[.85,-48],[1.6,-48],[2.15,-24],[2.6,-24],[3.35,0],[3.6,0]],
      'head.rotation':[[0,0],[.65,-8],[1.6,-8],[2.15,12],[2.6,12],[3.35,0],[3.6,0]],
      'head.x':[[0,0],[.65,-4],[1.6,-4],[2.15,9],[2.6,9],[3.35,0],[3.6,0]],
      'hat.rotation':[[0,0],[.8,-4],[1.6,-4],[2.15,4],[2.6,4],[3.5,0],[3.6,0]],
      'hatTip.bend':[[0,0],[.85,.5],[1.6,.5],[2.4,.25],[3.6,0]],
    }),
    visitor:clip(1.8,{
      'head.rotation':[[0,0],[.3,-11],[.95,-11],[1.15,-7],[1.4,-10],[1.8,0]],
      'head.y':[[0,0],[.3,-2],[.95,-2],[1.15,0],[1.4,-1],[1.8,0]],
      'hat.rotation':[[0,0],[.38,-3],[.95,-3],[1.8,0]],
      'hatTip.bend':[[0,0],[.48,.35],[1.1,.12],[1.8,0]],
    }),
    quiet:clip(1),
  };
  const channels=[...new Set(Object.values(clips).flatMap(motion=>Object.keys(motion.tracks)))];
  for(const motion of Object.values(clips))for(const channel of channels)motion.tracks[channel]??=[[0,0],[motion.duration,0]];
  Object.assign(wizard,{inputs:{action:{type:'string',default:'draft',options:Object.keys(clips)}},clips,states:Object.fromEntries(Object.keys(clips).map(id=>[id,{clip:id,transitions:[]} ])),initial:'draft'});
  const perform=activity=>({type:'perform',activity});
  const activity=(id)=>({actor:'wwzard',variants:[{id,clip:id,weight:1,speed:{min:1,max:1}}],transition:{duration:.2,interrupt:true},success:{base:1,modifiers:[]},onStart:[],onSuccess:[{type:'event',event:id+'-done'}],onFailure:[]});
  const eventEdge=(from,to,event)=>({id:from+'-'+event,from,to,event,weight:1});
  return addWwwzardNightLighting(addWwwzardHostTransition({
    schemaVersion:1,kind:'scene',id:'wwwzard-projects',name:'Wwwzard at the drafting table',revision:0,
    bounds:{width:360,height:450},presentation:'live',lighting:{enabled:false},
    requiredFeatures:['rigs','paths','instances','timelines','input-states','spatial-rig','scene-depth','part-gradients'],
    packs:{wwzard:wizard,desk:art.desk,workbench:workbench(),shadow:stillPack('Workbench shadow',[art.room.parts.find(part=>part.id==='desk-shadow')])},
    actors:[actor('shadow','shadow',-20),actor('wwzard','wwzard',30),actor('desk','desk',5),actor('workbench','workbench',10)].map(a=>({...a,transform:{...a.transform,x:-90,y:-70}})),
    interactions:[{id:'projects-visitor',actor:'wwzard',gesture:'click',response:'event',event:'visitor',resistance:0},{id:'project-inspection',actor:'workbench',gesture:'click',response:'event',event:'inspect-project',resistance:0}],
    behaviorGraph:{seed:260926,variables:{visits:0},variableBounds:{visits:{min:0,max:1000}},initial:'drafting',
      states:{drafting:{actions:[perform('draft')]},inspecting:{actions:[perform('inspect')]},quiet:{actions:[perform('quiet')]},greeting:{actions:[{type:'add',variable:'visits',value:1},perform('visitor')]}},
      handlers:[],
      edges:[eventEdge('drafting','inspecting','draft-done'),eventEdge('inspecting','quiet','inspect-done'),eventEdge('greeting','quiet','visitor-done'),{id:'resume-drafting',from:'quiet',to:'drafting',after:{min:3.5,max:5.5},weight:1},...['drafting','inspecting','quiet'].map(from=>eventEdge(from,'greeting','visitor')),...['drafting','quiet','greeting'].map(from=>eventEdge(from,'inspecting','inspect-project'))],
      activities:Object.fromEntries(Object.keys(clips).map(id=>[id,activity(id)])),
    },
  }));
}
