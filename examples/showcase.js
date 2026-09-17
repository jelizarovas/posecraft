import {createCampfire} from './campfire.js';
import {addSpatialRig} from './spatial-rigs.js';
import {standingTarget} from '../src/recovery.js';
import ona from './characters/ona.json' with {type:'json'};
import wwwzard from './characters/wwwzard.json' with {type:'json'};
import rusty from './characters/rusty.json' with {type:'json'};
import dummy from './characters/dummy.json' with {type:'json'};
const library={ona,wwwzard,rusty,dummy};
export const demoCatalog=[
 {id:'campfire-night',title:'Campfire night',category:'Four friends after dark',description:'Four friends gather around the fire, chat, drift off and notice shooting stars. Distractions can burn dinner; sometimes a friend shares a treat.',features:['Editable emitters','Shared reactions','Seeded live events'],instruction:'Let the evening unfold, or start a conversation, meteor or handoff. New evening changes the events; the slider replays the first minute.',color:'#172b3a',kind:'scene'},
 {id:'light-and-shade',title:'Light & shade',category:'Lighting study',description:'A warm key light, soft shadows and a polished floor. Watch the light follow moving silhouettes.',features:['Surface gradients','Cast shadows','Floor reflections'],instruction:'Move the light, compare warm and cool presets, or jump to see the contact shadow soften. Open in Studio for receiver and shadow controls.',color:'#e2d3c4',kind:'scene'},
 {id:'turn-and-pose',title:'Turn & pose',category:'2.5D character study',description:'Turn the head and body, reach in front or behind, and bring a knee toward the camera.',features:['Depth & overlap','Shape morphs','Keyable turns'],instruction:'Play an acting study, or pause with the sliders. Open in Studio to key Yaw, Pitch, Depth and Shape on a selected joint.',color:'#e5ddd2',kind:'scene'},
 {id:'shake-and-settle',title:'Shake & settle',category:'Phone motion & recovery',description:'Shake or turn your phone to tumble the cast. They get up and walk back to their marks.',features:['Phone sensors','Assisted get-up','Walk & return'],instruction:'Enable phone motion, or use Shake scene. Stop moving to let the cast recover. Select a character and tap the stage to walk somewhere.',color:'#d4e4df',kind:'scene'},
 {id:'www-after-hours',title:'WWW after hours',category:'Short cartoon',description:'A late night at the studio. wwwzard takes a break, Ona has an idea, and Rusty wants attention.',features:['3 characters','3 camera shots','Expression timing'],instruction:'Play the scene, or scrub through the camera cuts. Open it in Director to change the performance.',color:'#dce6ee',kind:'episode'},
 {id:'neon-rehearsal',title:'Neon rehearsal',category:'Choreography',description:'Four performers, staggered actions and a moving camera on a neon stage.',features:['4 characters','2 sets','Staggered actions'],instruction:'A silent staging demo for a future music video. Try the different shots, then edit the timing in Director.',color:'#dfd0ed',kind:'episode'},
 {id:'rusty-in-the-park',title:'Rusty in the park',category:'Character acting',description:'Ona waves hello. Rusty offers a paw, gets excited, then settles down in the park.',features:['2 characters','Reaction shots','Reusable actions'],instruction:'Watch the exchange through three shots. Every pose, expression and camera move can be edited.',color:'#d6e5cc',kind:'episode'},
 {id:'drop-lab',title:'The drop lab',category:'Interactive physics',description:'Compare a loose dummy with two protective rigs over real collision platforms.',features:['3 dummies','Joint limits','Prop contacts'],instruction:'Drop the dummies, toss them, or catch them. Left is loose; middle protects its head; right braces. Each rig has independent physics.',color:'#eedbc6',kind:'scene'},
 {id:'zero-gravity',title:'Zero gravity',category:'Interactive motion',description:'The whole cast floats in a shared frame. Move the stage and watch them react.',features:['4 characters','Floating rigs','Container motion'],instruction:'Drag the stage, or press Nudge cast. Each character reacts independently; avatars do not collide with each other.',color:'#d5deef',kind:'scene'},
 {id:'expression-ensemble',title:'The expression lineup',category:'Actions & expressions',description:'One direction, four different performances. Try the same expression across the cast.',features:['4 characters','14 expressions','Independent inputs'],instruction:'Choose everyone or one performer, then change expressions and actions. Try the optional interaction sounds.',color:'#f0e0d5',kind:'scene'}
];
const rect=(id,x,y,width,height,fill,solid=false,rotation=0)=>({id,name:id.replaceAll('-',' '),x,y,width,height,rotation,fill,collider:{enabled:solid,width,height,x:0,y:0,friction:.65,bounce:.15}});
function actor(type,id,x,y,scale,appearance={}){const source=library[type].actors[0];return {...structuredClone(source),id,name:id===type?(type==='wwwzard'?'wwwzard':type[0].toUpperCase()+type.slice(1)):id.replaceAll('-',' '),transform:{x,y,scale,rotation:0},appearance:{...source.appearance,...appearance},inputs:{...source.inputs,emotion:'neutral'}};}
function scene(id,name,actors,props){return {schemaVersion:1,kind:'scene',id,name,revision:0,bounds:{width:800,height:450},packs:Object.fromEntries([...new Set(actors.map(a=>a.pack))].map(type=>[type,structuredClone(library[type].packs[type])])),actors,props};}
const cast=()=>[actor('wwwzard','wwwzard',155,300,.72),actor('ona','ona',335,330,1.15),actor('dummy','dummy',510,295,1.05),actor('rusty','rusty',680,350,1.7)];
const camera=(x=400,y=225,zoom=1)=>({x:[[0,x]],y:[[0,y]],zoom:[[0,zoom]],rotation:[[0,0]]});
const cue=(clip,emotion='neutral',extra={})=>({clip,offset:0,speed:1,emotion,...extra});
const shot=(id,name,set,actors,duration=4,view=camera())=>({id,name,scene:set,duration,camera:view,actors});
const episode=(id,name,scenes,shots)=>({schemaVersion:1,kind:'episode',id,name,revision:0,fps:24,size:{width:1280,height:720},scenes,shots});
const parkProps=()=>[rect('sky',400,200,800,500,'#d8e9e5'),rect('grass',400,425,800,110,'#a8c38c'),rect('path',400,415,800,32,'#ded1ac'),rect('tree-trunk',110,230,26,280,'#9b795f'),rect('tree-crown',100,104,165,155,'#89ae83',false,8),rect('tree-leaves',137,114,112,108,'#a1be90',false,30),rect('bench-seat',605,331,225,15,'#ac8c68'),rect('bench-back',605,287,225,60,'#bf9e76'),rect('bench-leg-a',520,368,14,60,'#897662'),rect('bench-leg-b',690,368,14,60,'#897662')];
export function createDemo(id){
 if(id==='campfire-night')return createCampfire();
 if(id==='light-and-shade'){
  const doc=createDemo('turn-and-pose');doc.id=id;doc.name='Light & shade';doc.props=[rect('wall',400,150,800,300,'#d8d0c9'),rect('floor',400,375,800,150,'#beb4aa')];
  for(const a of doc.actors){a.transform.y=365-standingTarget(doc,a,doc.packs[a.pack],a.transform.x).box.bottom;a.inputs.action='glance';}
  doc.lighting={enabled:true,shading:'cel',angle:-135,elevation:35,intensity:.8,ambient:.6,color:'#fff1d6',shadowColor:'#292438',softness:3,floorY:365,wallY:300,floorShadow:.24,wallShadow:.14,reflection:.22,gloss:.35};doc.requiredFeatures.push('scene-lighting');return doc;
 }
 if(id==='turn-and-pose'){
  const doc=scene(id,'Turn & pose',[actor('ona','ona',250,285,1.8),actor('dummy','dummy',565,235,1.6)],[rect('backdrop',400,225,800,450,'#f1ece3'),rect('ground',400,395,800,110,'#dfd6c7')]);
  for(const a of doc.actors){addSpatialRig(doc.packs[a.pack],a.pack);a.inputs={...a.inputs,action:'turnaround'};a.behavior={mode:'animated',autoFace:false};}doc.requiredFeatures=['spatial-rig'];return doc;
 }

 if(id==='shake-and-settle'){
  const actors=[actor('wwwzard','wwwzard',170,300,.65),actor('ona','ona',400,340,1.4),actor('dummy','dummy',635,320,1.15)];
  const doc=scene(id,'Shake & settle',actors,[rect('wall',400,225,800,450,'#e3e9e4'),rect('window-a',210,110,190,120,'#abc6c9'),rect('window-b',590,110,190,120,'#abc6c9'),rect('floor',400,430,800,40,'#acb6a5',true),...actors.map((a,i)=>rect('mark-'+i,a.transform.x,406,90,5,'#867598'))]);
  doc.requiredFeatures=['assisted-recovery'];
  for(const a of actors){a.transform.y=standingTarget(doc,a,doc.packs[a.pack],a.transform.x).y;a.behavior={mode:'protective',autoRecover:true,strategy:'auto',resistance:.85,gravity:1,bounce:.2};}return doc;
 }
 if(id==='www-after-hours'){
  const office=scene('www-office','WWW studio',[actor('wwwzard','wwwzard',205,305,.8),actor('ona','ona',450,335,1.15),actor('rusty','rusty',650,355,1.8)],[rect('wall',400,200,800,500,'#d4dce5'),rect('floor',400,432,800,90,'#b5a8a6'),rect('window-frame',620,140,240,175,'#7c8aa2'),rect('night-sky',620,140,219,154,'#38415f'),rect('moon',675,103,32,32,'#eddfa4',false,15),rect('window-cross',620,140,8,154,'#7c8aa2'),rect('shelf',190,118,210,15,'#997e76'),rect('book-a',130,85,20,51,'#b891aa'),rect('book-b',158,91,23,40,'#c4b278'),rect('book-c',188,80,22,62,'#88a7a1'),rect('desk-top',206,278,218,18,'#a78675'),rect('desk-leg',115,343,14,125,'#a78675'),rect('monitor',180,230,92,68,'#536576'),rect('monitor-screen',180,227,78,51,'#92c5c0')]);
  return episode(id,'WWW after hours',{office},[shot('late-night','A late night','office',{wwwzard:cue('work','focused'),ona:cue('think','curious'),rusty:cue('sniff')},4),shot('an-idea','Ona has an idea','office',{wwwzard:cue('wave','happy'),ona:cue('celebrate','excited',{expressions:[[0,'curious'],[.7,'excited'],[3,'happy']]}),rusty:cue('tilt','curious')},4,camera(440,270,1.4)),shot('goodnight','Rusty gets the last word','office',{wwwzard:cue('bow','relieved'),ona:cue('wave','happy'),rusty:cue('bark','happy',{expressions:[[0,'surprised'],[1.2,'happy'],[3,'sleepy']]})},4,{...camera(590,290,1.5),zoom:[[0,1.5],[4,1,'smooth']],x:[[0,590],[4,400,'smooth']],y:[[0,290],[4,225,'smooth']]})]);
 }
 if(id==='neon-rehearsal'){
  const stage=scene('neon-stage','Neon stage',cast(),[rect('backdrop',400,200,800,500,'#27283f'),rect('platform',400,425,800,95,'#49405d'),rect('light-left',52,215,18,350,'#d5a5ed'),rect('light-right',748,215,18,350,'#97d8d1'),rect('light-top',400,49,650,10,'#b6a4e4'),rect('riser',400,377,700,12,'#b188c1'),...Array.from({length:5},(_,i)=>rect('equalizer-'+i,270+i*65,160-(i%3)*15,30,65+(i%3)*30,['#8276b5','#ca8bc9','#8cbabf'][i%3]))]);
  const backstage=scene('backstage','After the show',cast(),[rect('wall',400,200,800,500,'#d9c9cb'),rect('floor',400,428,800,95,'#ada0ae'),rect('mirror',400,160,260,170,'#e7e5df'),rect('rail',140,140,190,10,'#897c91'),rect('coat',100,217,55,130,'#856d9c'),rect('coat-two',181,205,50,105,'#9d7f81')]);
  const moves={wwwzard:cue('celebrate','happy',{offset:.2}),ona:cue('dance','excited'),dummy:cue('dance','happy',{offset:.5}),rusty:cue('bounce','happy',{offset:.2})};
  return episode(id,'Neon rehearsal',{stage,backstage},[shot('ensemble','Find the rhythm','stage',moves,4),shot('spotlight','Into the spotlight','stage',{...moves,ona:cue('celebrate','excited',{placement:{x:[[0,335],[2,420],[4,335]],y:[[0,330],[1,300],[2,330],[3,300],[4,330]]}})},4,{...camera(),zoom:[[0,1],[2,1.15],[4,1]],rotation:[[0,-2],[2,2],[4,0]]}),shot('curtain-call','Backstage bow','backstage',{wwwzard:cue('bow','relieved'),ona:cue('bow','happy'),dummy:cue('nod','happy'),rusty:cue('wag','happy')},4)]);
 }
 if(id==='rusty-in-the-park'){
  const park=scene('park','Afternoon park',[actor('ona','ona',310,330,1.25),actor('rusty','rusty',500,350,2)],parkProps());
  return episode(id,'Rusty in the park',{park},[shot('hello','A familiar face','park',{ona:cue('wave','happy'),rusty:cue('tilt','curious')},3),shot('a-paw','One paw, please','park',{ona:cue('reach','happy'),rusty:cue('paw','happy',{expressions:[[0,'curious'],[1.2,'happy']]})},4,camera(415,290,1.5)),shot('settle','Time to rest','park',{ona:cue('nod','relieved'),rusty:cue('sleep','sleepy')},4,{...camera(440,275,1.3),zoom:[[0,1.3],[4,1]]})]);
 }
 if(id==='drop-lab'){
  const actors=[actor('dummy','loose',160,175,.8,{shell:'#b7c5df'}),actor('dummy','protect',400,175,.8,{shell:'#d9ac9c'}),actor('dummy','brace',640,175,.8,{shell:'#b7caa0'})];
  return scene(id,'The drop lab',actors,[rect('backdrop',400,225,800,450,'#f1e8da'),rect('platform-a',160,370,180,26,'#c5b7a2',true),rect('platform-b',400,353,180,26,'#c5b7a2',true,-8),rect('platform-c',640,370,180,26,'#c5b7a2',true,8),rect('floor',400,443,800,14,'#a19a92',true)]);
 }
 if(id==='zero-gravity'){
  const actors=cast();for(const a of actors){a.transform.y-=75;a.behavior={mode:'floating',resistance:.12,gravity:0,bounce:.65};}
  return scene(id,'Zero gravity',actors,[rect('space',400,225,800,450,'#283c59'),rect('window-a',170,140,180,140,'#536f8c'),rect('window-b',405,140,180,140,'#536f8c'),rect('window-c',640,140,180,140,'#536f8c'),...Array.from({length:9},(_,i)=>rect('star-'+i,95+i*77,80+(i%3)*44,5,5,'#f3e7bf',false,45)),rect('deck',400,430,800,40,'#758496')]);
 }
 if(id==='expression-ensemble')return scene(id,'The expression lineup',cast(),[rect('wall',400,225,800,450,'#ede4db'),rect('band',400,200,800,120,'#dfd1c5'),rect('floor',400,425,800,75,'#b7c1ba'),...Array.from({length:4},(_,i)=>rect('mark-'+i,155+i*175,400,95,6,'#f5eedf'))]);
 throw new Error('Unknown demo.');
}
export function findDemo(id){return demoCatalog.find(d=>d.id===id);}
