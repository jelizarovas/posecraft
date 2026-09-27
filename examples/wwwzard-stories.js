import {createWwzardArtwork} from './wwzard-artwork.js';
import {addWwwzardHostTransition} from './wwwzard-host-transition.js';
import {addWwwzardNightLighting} from './wwwzard-night.js';

// Authored path drawings and clips. The exported document needs only the public
// illustration runtime; no page timer, particles, or application-side posing.
const shade=(a,b)=>({type:'linear',x1:0,y1:1,x2:1,y2:0,stops:[[0,a],[1,b]]});
const path=(id,d,fill,gradient,joint='root',depth=30)=>({id,joint,d,fill,...(gradient?{gradient}:{}),spatial:{sceneDepth:{value:depth}}});
const bone=(id,parent,x=0,y=0)=>({id,parent,x,y,rotation:0,min:-180,max:180,length:0});
const motion=(duration,tracks)=>({duration,loop:false,tracks});
const pose=(keys,duration)=>Object.fromEntries(Object.entries(keys).map(([key,value])=>[key,[[0,value],[duration,value]]]));
const states=clips=>Object.fromEntries(Object.keys(clips).map(id=>[id,{clip:id,transitions:[]} ]));
const sleeve=([x,y])=>`M238 239Q250 232 260 243Q280 259 ${x-7} ${y-12}L${x+4} ${y+10}Q282 286 250 267Q237 257 238 239Z`;
// A lifted leaf clears the upper cover edge. Its broad curved face stays
// legible when the entire illustration is only a hundred pixels high.
const page=([x,y])=>`M259 302Q286 ${y-4} ${x} ${y}Q${x+4} ${y+21} ${x-7} ${y+40}Q284 319 258 311Q262 306 259 302Z`;
const raisedPage='M259 302Q272 223 313 223Q349 229 340 260Q290 302 258 311Q262 306 259 302Z';
const curledPage='M259 302Q232 232 260 229Q307 237 299 268Q286 304 258 311Q262 306 259 302Z';
const landingPage='M259 302Q191 249 185 266Q177 281 188 297Q215 324 258 311Q262 306 259 302Z';
const move=(d,x,y)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,p=>{const [a,b]=p.split(/\s+/).map(Number);return `${a+x} ${b+y}`;});

export function createWwwzardStoriesScene(){
  const art=createWwzardArtwork(),wizard=structuredClone(art.wwzard);
  wizard.name='Wwwzard reading';
  wizard.parts=wizard.parts.filter(p=>!p.id.startsWith('magic-')&&!p.id.startsWith('left-')&&!p.id.startsWith('right-')&&p.id!=='robe-front-fold');
  wizard.joints=wizard.joints.filter(j=>!j.id.startsWith('magic-'));
  wizard.parts.forEach(p=>{if(p.id.startsWith('robe')){
    p.spatial.sceneDepth={value:0};
    // This is a seated bust composition. Its lower robe is fully hidden inside
    // the plinth instead of extending beneath the thinner Stories pedestal.
    const hem=d=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,pair=>{const [x,y]=pair.split(/\s+/).map(Number);return `${x} ${y>350?350+(y-350)*.3:y}`;});
    p.d=hem(p.d);if(p.spatial.morph)p.spatial.morph.target=hem(p.spatial.morph.target);
  }});
  // Book contacts have independent arm contours. The hands remain on the book
  // while the head reads, avoiding inherited torso rotations at planted wrists.
  wizard.parts.push(
    {...path('reading-near-sleeve','M180 243Q199 235 211 251Q213 276 205 296L192 326Q184 343 170 336Q154 333 158 316L166 274Q165 253 180 243Z','#812364',shade('#52234e','#a13280'),'root',12)},
    path('reading-far-sleeve',sleeve([344,302]),'#832766',shade('#552150','#aa3382'),'root',12),
    path('reading-left-palm','M176 316Q185 310 193 317Q201 324 198 335Q192 345 183 343Q170 341 170 330Q169 322 176 316Z','#f6e2c2',shade('#d9b99f','#fff4d5'),'root',25),
    path('reading-left-thumb','M173 320Q176 317 180 320L183 324Q184 327 181 328L176 325L180 331Q181 335 178 335Q173 333 171 328Z','#f4debc',shade('#d9b99f','#fff4d5'),'root',46),
    path('reading-right-palm','M-10 -12Q-3 -18 7 -12Q15 -7 14 4Q12 14 3 16Q-8 16 -13 8Q-17 -3 -10 -12Z','#f5e1c1',shade('#dbbfaa','#fff6d8'),'pageHand',25),
    path('reading-right-thumb','M7 -8Q13 -11 14 -6L13 1Q12 6 8 7Q5 7 5 3L7 -1Z','#f6dfbd',shade('#e9cbb0','#fff0cf'),'pageHand',46),
  );
  wizard.joints.push(bone('pageHand','root'));
  const targets=[[344,302],[346,276],[340,260],[299,268],[188,297],[344,302]];
  const turnPhase=[[0,0],[.45,.2],[.95,.4],[1.2,.4],[1.55,.6],[1.8,.6],[2.2,.8],[2.4,.8],[2.95,1,'step'],[2.96,0],[3.4,0]];
  wizard.parts.find(p=>p.id==='reading-far-sleeve').spatial.morph={channel:'pageHand.bend',frames:targets.slice(1,-1).map((p,i)=>({value:(i+1)/5,target:sleeve(p)})),target:sleeve(targets.at(-1))};
  // A shared deformation channel drives sleeve and palm contours together.
  // Interrupted blends therefore cannot take a separate straight wrist path.
  for(const id of ['reading-right-palm','reading-right-thumb']){
    const part=wizard.parts.find(p=>p.id===id),drawing=part.d;
    part.d=move(drawing,344,302);
    part.spatial.morph={channel:'pageHand.bend',frames:targets.slice(1,-1).map(([x,y],i)=>({value:(i+1)/5,target:move(drawing,x,y)})),target:part.d};
  }
  // The cover hides the palm at rest. A separate small grip stays at its outer
  // edge; the travelling fingers disappear behind the cover on their return.
  const grip=structuredClone(wizard.parts.find(p=>p.id==='reading-right-thumb'));
  grip.id='reading-right-grip';grip.joint='root';grip.opacityChannel='bookGrip.opacity';delete grip.spatial.morph;wizard.parts.push(grip);wizard.joints.push(bone('bookGrip','root'));
  for(const id of ['reading-right-palm','reading-right-thumb'])wizard.parts.find(p=>p.id===id).spatial.sceneDepth={value:25,channel:'pageHand.z'};
  wizard.parts.find(p=>p.id==='reading-right-thumb').opacityChannel='pageHand.opacity';
  const quietPose={'bookGrip.opacity':1,'pageHand.opacity':0,'pageHand.z':0,'pageHand.bend':0,'head.rotation':2,'hat.rotation':0,'hatTip.bend':.08};
  const reading=motion(6.8,{
    ...pose(quietPose,6.8),
    'head.rotation':[[0,2],[1.7,2],[2.8,6],[4,6],[5.4,2],[6.8,2]],
    'hatTip.bend':[[0,.08],[2,.08],[3.1,.17],[4.2,.17],[5.7,.08],[6.8,.08]],
  });
  const turn=motion(3.4,{
    ...pose(quietPose,3.4),
    'pageHand.bend':turnPhase,
    'pageHand.opacity':[[0,0],[.35,0],[.5,1],[2.5,1],[2.8,0],[3.4,0]],
    'bookGrip.opacity':[[0,1],[.1,1],[.35,0],[3.02,0],[3.25,1],[3.4,1]],
    'pageHand.z':[[0,0],[.4,0],[.65,15],[2.5,15],[2.95,0],[3.4,0]],
    'head.rotation':[[0,2],[.45,-3],[1.45,-7],[2.2,6],[3.4,2]],
    'hatTip.bend':[[0,.08],[1.45,.42],[2.2,.3],[3.4,.08]],
  });
  const thought=motion(4.6,{
    ...pose(quietPose,4.6),
    'head.rotation':[[0,2],[.7,-5],[1.3,-8],[2.7,-8],[3.5,-3],[4.6,2]],
    'hat.rotation':[[0,0],[1,-2],[2.7,-2],[4.6,0]],
    'hatTip.bend':[[0,.08],[1.2,.4],[2.7,.35],[4.6,.08]],
  });
  const visitor=motion(2.6,{
    ...pose(quietPose,2.6),
    'head.rotation':[[0,2],[.3,-9],[.7,-9],[1,-5],[1.3,-9],[1.8,-9],[2.6,2]],
    'hat.rotation':[[0,0],[.4,-3],[1.5,-3],[2.6,0]],
    'hatTip.bend':[[0,.08],[.55,.5],[1.1,.2],[1.65,.3],[2.6,.08]],
  });
  wizard.clips={reading,turn,thought,visitor};wizard.states=states(wizard.clips);wizard.initial='reading';wizard.inputs={};

  const bookParts=[
    path('book-contact-shadow','M167 373L260 405L355 353L263 330Z','#aaa1cf',undefined,'root',8),
    path('book-left-cover','M174 296Q217 293 259 316L257 399Q219 383 168 382Z','#5135a6',shade('#392575','#7651c7')),
    path('book-right-cover','M259 316Q299 282 356 266L350 354Q303 369 257 399Z','#6240b2',shade('#41308e','#8b51ce')),
    path('book-left-paper-edge','M178 283Q221 280 258 306L257 317Q217 298 174 306Z','#d8cdb8',shade('#c9b89f','#fff3d2')),
    path('book-right-paper-edge','M258 306Q295 273 351 259L356 269Q302 284 258 317Z','#dfd3bc',shade('#cbb99e','#fff5d6')),
    path('book-left-page','M180 280Q222 277 259 302L256 310Q220 290 176 300Z','#fff4d7',shade('#e5d6b8','#fffbe7')),
    path('book-right-page','M259 302Q293 274 348 255L352 264Q304 278 256 310Z','#fff4d7',shade('#e2cfac','#fffbe7')),
    path('book-page-lines','M187 290Q222 288 249 303L248 305Q220 291 187 292ZM276 295Q312 275 339 267L340 269Q305 280 275 297Z','#d7c4a4'),
    path('book-spine','M250 312L260 314L257 399Q251 404 243 397Z','#39277c',shade('#302563','#6640a4')),
    path('book-front-facet','M260 319L278 306L271 383L257 399Z','#51319c',shade('#3a287e','#7143b5')),
    path('book-emblem','M314 309L325 316L315 333L306 326Z','#efbd4c',shade('#d69231','#ffe389')),
    path('book-left-corners','M174 306L186 306L185 313L174 314ZM169 370L177 372L177 377L188 377L188 384L168 382Z','#f6c758',shade('#d59b34','#ffe48c')),
    path('book-right-corners','M342 272L353 267L352 280L346 283L347 277L341 280ZM339 350L345 348L346 339L352 337L350 356L337 360Z','#f6c758',shade('#d59b34','#ffe48c')),
    {...path('turning-page',page([348,255]),'#fff4d7',shade('#e0cfaf','#fffbe7'),'root',35),opacityChannel:'leaf.opacity',spatial:{sceneDepth:{value:35},morph:{channel:'leaf.bend',frames:[{value:.2,target:page([348,255])},{value:.4,target:raisedPage},{value:.6,target:curledPage},{value:.8,target:landingPage}],target:page([178,280])}}},
  ];
  const bookClips={
    reading:motion(6.8,pose({'leaf.opacity':0,'leaf.bend':0},6.8)),
    thought:motion(4.6,pose({'leaf.opacity':0,'leaf.bend':0},4.6)),
    visitor:motion(2.6,{'leaf.opacity':[[0,0],[2.6,0]],'leaf.bend':[[0,0],[2.6,0]]}),
    turn:motion(3.4,{'leaf.opacity':[[0,0],[.43,0],[.5,1],[2.45,1],[2.7,0],[3.4,0]],'leaf.bend':turnPhase}),
  };
  const book={name:'Open storybook',spatial:true,joints:[bone('root',null),bone('leaf','root')],parts:bookParts,inputs:{},clips:bookClips,states:states(bookClips),initial:'reading'};
  const base=structuredClone(art.desk);
  base.name='Reading plinth';
  // A low display plinth supports the book, matching the existing Stories art.
  const plinthPaths={
    'desk-solid':'M144 355L296 274L439 355L439 387L288 469L144 387Z',
    'desk-top':'M144 355L296 274L439 355L288 437Z',
    'desk-left':'M144 355L288 437L288 469L144 387Z',
    'desk-right':'M288 437L439 355L439 387L288 469Z',
  };
  for(const part of base.parts)part.d=plinthPaths[part.id];
  const actor=(id,pack,depth)=>({id,name:id,pack,layer:'characters',transform:{x:0,y:0,rotation:0,scale:1},depth:{value:depth},unlit:true});
  const perform=activity=>({type:'perform',activity}),event=event=>({type:'event',event});
  const activities={};
  for(const name of Object.keys(wizard.clips))for(const id of ['wwzard','book'])activities[`${id}-${name}`]={actor:id,variants:[{id:name,clip:name,weight:1,speed:{min:1,max:1}}],transition:{duration:name==='visitor'?.22:.2,interrupt:true},success:{base:1,modifiers:[]},onStart:[],onSuccess:id==='wwzard'?[event(`${name}-done`)]:[],onFailure:[]};
  const enter=name=>({actions:[perform(`wwzard-${name}`),perform(`book-${name}`)]});
  const edge=(id,from,to,event)=>({id,from,to,event,weight:1});
  return addWwwzardNightLighting(addWwwzardHostTransition({
    schemaVersion:1,kind:'scene',id:'wwwzard-stories',name:'Wwwzard with a storybook',revision:0,
    bounds:{width:340,height:420},requiredFeatures:['rigs','paths','instances','timelines','input-states','spatial-rig','scene-depth','part-gradients'],
    packs:{wwzard:wizard,book,plinth:base},actors:[actor('wwzard','wwzard',20),actor('plinth','plinth',5),actor('book','book',30)].map(a=>({...a,transform:{...a.transform,x:-115,y:-70}})),lighting:{enabled:false},presentation:'live',
    behaviorGraph:{seed:260927,variables:{pages:0,visits:0},variableBounds:{pages:{min:0,max:1000},visits:{min:0,max:1000}},initial:'settling',
      states:{settling:enter('reading'),reading:enter('reading'),quiet:{actions:[]},turning:enter('turn'),thinking:enter('thought'),greeting:enter('visitor')},
      handlers:[{event:'turn-done',actions:[{type:'add',variable:'pages',value:1}]},{event:'visitor',actions:[{type:'add',variable:'visits',value:1}]}],
      edges:[{id:'first-page',from:'settling',to:'turning',after:{min:2.2,max:2.2},weight:1},edge('read-finished','reading','quiet','reading-done'),{id:'quiet-turn',from:'quiet',to:'turning',after:{min:1.5,max:3},weight:3},{id:'quiet-thought',from:'quiet',to:'thinking',after:{min:2,max:4},weight:1},edge('turn-finished','turning','reading','turn-done'),edge('thought-finished','thinking','reading','thought-done'),edge('greet-finished','greeting','reading','visitor-done'),...['settling','reading','quiet','turning','thinking'].map(from=>edge(`${from}-visitor`,from,'greeting','visitor')),...['settling','reading','quiet','thinking','greeting'].map(from=>edge(`${from}-turn-request`,from,'turning','turn-page'))],activities},
    interactions:[{id:'reader-visitor',actor:'wwzard',gesture:'click',response:'event',event:'visitor',resistance:0},{id:'book-page',actor:'book',gesture:'click',response:'event',event:'turn-page',resistance:0}],
  }));
}
