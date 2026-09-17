// Convert the owner's original parts to portable rigs. Does not modify source apps.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { wwwzardDefinition } from '../examples/wwwzard/definition.js';
import { AnimationController } from '../examples/wwwzard/engine.js';
import { assertDocument } from '../src/schema.js';
import { addResponseProfile } from '../examples/character-profiles.js';
const source=process.argv[2];if(!source)throw new Error('Pass the trusted Ona source directory.');
const c=vm.createContext({});for(const file of ['traces.js','hair.js'])vm.runInContext(fs.readFileSync(path.join(source,file),'utf8'),c);
const trace=c.OnaTraces.parts;
const emotions=['neutral','happy','excited','sad','angry','surprised','sleepy','curious'];
const joint=(id,parent,x,y,rotation=0,min=-45,max=45,length=0)=>({id,parent,x,y,rotation,min,max,length});
const shape=(id,joint,d,fill,extra={})=>({id,joint,d,fill,...extra});
const track=(...values)=>values.map((v,i)=>[i/(values.length-1),v]);
const loop=(duration,tracks)=>({duration,loop:true,tracks:Object.fromEntries(Object.entries(tracks).map(([key,keys])=>[key,keys.map(([t,v])=>[t*duration,v])]))});
function states(pack) {
 const actions=Object.keys(pack.clips);
 pack.inputs={action:{type:'string',default:'idle',options:actions},emotion:{type:'string',default:'neutral',options:emotions},...pack.inputs};
 pack.initial='idle';pack.states=Object.fromEntries(actions.map(id=>[id,{clip:id,transitions:actions.filter(next=>next!==id).map(to=>({to,duration:.25,when:{input:'action',equals:to}}))}]));
 pack.reaction={joint:'root',strength:1,stiffness:35,damping:8};
 return pack;
}
const old=JSON.parse(fs.readFileSync('examples/ona.posecraft.json'));
const ona=structuredClone(old.packs.ona);
ona.provenance.note='Original Ona trace geometry, modular hair, and new authored expression and action tracks.';
ona.inputs={hair:{type:'string',default:'none',options:Object.keys(c.OnaHair.styles)}};
ona.joints.push(joint('eyes','head',0,-10,0,-15,15),joint('mouth','head',0,4,0,-15,15));
for(const p of ona.parts)if(['eyes','glint'].includes(p.channel)){
 p.joint='eyes';p.transform='translate(0 10) '+p.transform;
 p.variantInput='emotion';p.variants={happy:{transform:'scale(1 .45)'},excited:{transform:'scale(1 1.12)'},sleepy:{transform:'scale(1 .18)'},sad:{transform:'scale(1 .7)'},surprised:{transform:'scale(1.13 1.13)'},angry:{transform:'scale(1 .55)'}};
}
const mouth=shape('mouth','mouth','M-6 0Q0 3 6 0','none',{stroke:'#363435',strokeWidth:1.6,variantInput:'emotion',variants:{neutral:{visible:false},happy:{d:'M-8 -1Q0 10 8 -1'},excited:{d:'M-7 -1Q0 14 7 -1Z'},sad:{d:'M-6 4Q0 -2 6 4'},angry:{d:'M-6 2L6 0'},surprised:{d:'M-3 0A3 5 0 1 0 3 0A3 5 0 1 0 -3 0'},sleepy:{d:'M-4 2L4 2'},curious:{d:'M-4 1Q1 -1 6 1'}}});ona.parts.push(mouth);
ona.parts.push(shape('brows','head','M-23 -23Q-17 -26 -10 -23M10 -23Q17 -26 23 -23','none',{stroke:'#363435',strokeWidth:1.5,variantInput:'emotion',variants:{neutral:{visible:false},happy:{visible:false},excited:{transform:'translate(0 -4)'},sad:{d:'M-23 -21L-10 -26M10 -26L23 -21'},angry:{d:'M-23 -25L-10 -20M10 -20L23 -25'},surprised:{transform:'translate(0 -6)'},sleepy:{visible:false},curious:{d:'M-23 -28Q-17 -31 -10 -28M10 -23L23 -23'}}}));
for(const side of ['back','front']){
 const variants=Object.fromEntries(Object.keys(c.OnaHair.styles).map(style=>{const html=c.OnaHair.layer('primary',side,{style,color:'#453b36'});const d=html.match(/ d="([^"]+)"/)?.[1];return [style,d?{d}:{visible:false}];}));
 const p=shape(`hair-${side}`,'head','M0 0','#453b36',{channel:'hair',transform:'translate(0 16)',stroke:'#373b37',strokeWidth:2.5,variantInput:'hair',variants});
 if(side==='back')ona.parts.splice(ona.parts.findIndex(p=>p.joint==='head'),0,p);else ona.parts.push(p);
}
ona.clips={...ona.clips,
 nod:loop(1.3,{'head.rotation':track(0,16,-6,16,0)}),
 shake:loop(1.4,{'head.rotation':track(0,-15,15,-15,0)}),
 dance:loop(1.6,{'root.rotation':track(-8,8,-8,8,-8),'root.y':track(0,-7,0,-7,0),'leftArm.rotation':track(45,85,45,85,45),'rightArm.rotation':track(-85,-45,-85,-45,-85),'leftFoot.rotation':track(-10,15,-10,15,-10),'rightFoot.rotation':track(15,-10,15,-10,15)}),
 celebrate:loop(1.4,{'root.y':track(0,-15,0,-12,0),'leftArm.rotation':track(80,110,80,110,80),'rightArm.rotation':track(-80,-110,-80,-110,-80),'head.rotation':track(-5,5,-5,5,-5)}),
 stretch:loop(2.8,{'leftArm.rotation':track(18,100,110,100,18),'rightArm.rotation':track(-15,-100,-110,-100,-15),'root.y':track(0,-5,-7,-5,0),'head.rotation':track(0,-6,-8,-6,0)}),
 walk:loop(1.1,{'leftFoot.rotation':track(-20,20,-20),'rightFoot.rotation':track(20,-20,20),'leftArm.rotation':track(-25,30,-25),'rightArm.rotation':track(30,-25,30),'root.y':track(0,-4,0,-4,0)}),
 run:loop(.7,{'leftFoot.rotation':track(-35,35,-35),'rightFoot.rotation':track(35,-35,35),'leftArm.rotation':track(-60,65,-60),'rightArm.rotation':track(65,-60,65),'root.y':track(0,-12,0,-12,0),'root.rotation':track(5,8,5)}),
 reach:loop(2,{'rightArm.rotation':track(-15,-80,-100,-80,-15),'root.rotation':track(0,8,10,8,0),'head.rotation':track(0,12,12,10,0)}),
 think:loop(3,{'rightArm.rotation':track(-50,-70,-50),'head.rotation':track(-10,-16,-10),'leftArm.rotation':track(15,10,15)}),
 bow:loop(2.5,{'head.rotation':track(0,20,20,0),'root.rotation':track(0,18,18,0),'leftArm.rotation':track(18,-15,-15,18),'rightArm.rotation':track(-15,15,15,-15)}),
 sleep:loop(4,{'head.rotation':track(14,18,14),'root.y':track(0,2,0),'leftArm.rotation':track(8,10,8)})};
ona.expressions={happy:{'head.rotation':-3},excited:{'head.y':-2},sad:{'head.rotation':10},angry:{'head.rotation':-4},surprised:{'head.y':-4},sleepy:{'head.rotation':12},curious:{'head.rotation':-12}};
ona.appearanceDefaults={skin:'#fffdfa',clothing:'#e6bd57',shoes:'#454644',eyes:'#333232',glint:'#c6e4f9',hair:'#453b36'};
ona.description='Shoulder rig · 13 actions';states(ona);

const rusty={name:'Rusty',provenance:{source:'Ukis original seated Rusty paths',license:'MIT',copyright:'2026 Arnas',note:'Original seated artwork with head, tail and paw pivots. No walking rig.'},joints:[joint('root',null,0,0,0,-25,25),joint('tail','root',-15,17,0,-35,35,14),joint('backPaw','root',9,-12,0,-15,15,35),joint('frontPaw','root',7,-4,0,-25,25,25),joint('head','root',0,-21,-10,-35,35),joint('leftEye','head',9.3,-23.4,0,-20,20),joint('rightEye','head',23,-27,0,-20,20)],parts:[],inputs:{},clips:{}};
const pushTrace=(records,prefix,assign)=>records.forEach((p,i)=>{const id=assign(i),j=rusty.joints.find(j=>j.id===id);let x=j.x,y=j.y;if(j.parent==='head'){x+=0;y+=-21;}rusty.parts.push(shape(`${prefix}-${i}`,id,p.d,p.fill,{...(p.channel?{channel:p.channel}:{}),transform:`translate(${-x} ${-y}) scale(.3) translate(-935 -900)`}));});
pushTrace(trace['rusty-sit'],'body',i=>i<2?'tail':i<4?'backPaw':i>=9?'frontPaw':'root');
pushTrace(trace['rusty-sit-head'],'face',i=>i===5?'leftEye':i===6?'rightEye':'head');
for(const p of rusty.parts)if(['leftEye','rightEye'].includes(p.joint)){p.channel='eyes';p.variantInput='emotion';p.variants={happy:{transform:'scale(1 .5)'},sleepy:{transform:'scale(1 .16)'},sad:{transform:'scale(1 .7)'},surprised:{transform:'scale(1.15 1.15)'},angry:{transform:'scale(1 .6)'}};}
rusty.clips={idle:loop(3,{'head.rotation':track(-10,-6,-10),'tail.rotation':track(-8,8,-8)}),wag:loop(.6,{'tail.rotation':track(-28,28,-28),'head.rotation':track(-10,-7,-10)}),tilt:loop(2.2,{'head.rotation':track(-10,-28,8,-10)}),paw:loop(1.8,{'frontPaw.rotation':track(0,-23,-18,-23,0),'head.rotation':track(-10,-16,-10)}),bark:loop(1.1,{'head.rotation':track(-10,-20,-10,-20,-10),'head.y':track(0,-3,0,-3,0),'root.y':track(0,-2,0,-2,0)}),bounce:loop(1.1,{'root.y':track(0,-9,0,-9,0),'tail.rotation':track(-28,28,-28),'head.rotation':track(-10,0,-10)}),sniff:loop(2,{'head.rotation':track(-10,12,8,12,-10),'head.x':track(0,3,0,3,0)}),sleep:loop(4,{'head.rotation':track(16,20,16),'root.y':track(0,2,0)})};
rusty.expressions={happy:{'head.rotation':-4},excited:{'head.rotation':-10},sad:{'head.rotation':15},angry:{'head.rotation':-10},surprised:{'head.y':-3},sleepy:{'head.rotation':24},curious:{'head.rotation':-17}};
rusty.appearanceDefaults={coat:'#f4f0e5',patches:'#bc8755',nose:'#986b61',collar:'#a1bb98',eyes:'#2e2b2a'};rusty.description='Seated rig · 8 actions';states(rusty);

const wizard={name:'wwwzard',provenance:{source:'Original wwwzard joints, robe/head/hat/hand geometry and sampled actions',license:'MIT',copyright:'2026 Arnas',note:'Portable studio rig uses rigid sleeve pieces and solid fills. Original procedural cloth and typing demo is retained separately.'},joints:structuredClone(wwwzardDefinition.joints),parts:[],inputs:{},clips:{}};
wizard.joints[0].x=0;wizard.joints[0].y=0;wizard.joints[0].min=-25;wizard.joints[0].max=25;
const wp=(...args)=>wizard.parts.push(shape(...args));
for(const side of ['left','right']){
 wp(side+'-thigh',side+'Thigh','M-9-14H56V14H-9Z','#58396d');wp(side+'-calf',side+'Calf','M-4-11H53V11H-4Z','#51305f');wp(side+'-shoe',side+'Foot','M-10-8L11-8L30 1Q35 12 24 13L-12 10Z','#443353',{channel:'shoes'});
 wp(side+'-sleeve-upper',side+'Upper','M-8-22Q28-29 68-17L68 17Q28 26-8 22Z','#8e3faa',{channel:'clothing'});
}
wp('neck','torso','M-17-111L-15-82Q0-74 16-82L18-111Z','#d7a486',{channel:'skin'});
wp('robe','torso','M-44-119Q-78-105-69-61L-79 30Q0 55 77 27L67-66Q76-101 43-119Z','#8e3faa',{channel:'clothing'});
wp('robe-collar','torso','M-44-118L-11-76L7-99L36-122','#b557ca');
wp('robe-folds','torso','M-7-89L-9 26M-55-38L-61 17M45-52L53 18','none',{stroke:'#542578',strokeWidth:3});
wp('hem','root','M-65 0Q-65 50-81 101Q0 126 84 98L65 0Z','#653078',{channel:'hem'});
wp('face','head','M-38-23Q-4-44 34-22L39 9Q32 46 4 47Q-26 43-36 17Z','#f2cdaa',{channel:'skin'});
for(const [i,x] of [-13,17].entries()){
 const eyeId=i?'rightEye':'leftEye';wizard.joints.push(joint(eyeId,'head',x,12,0,-20,20));
 wp(`eye-white-${i}`,eyeId,'M-8-7Q0-9 8-7Q10 10 0 11Q-10 10-8-7Z','#fff9ed',{stroke:'#65464b',strokeWidth:.7});
 wp(`eye-${i}`,eyeId,'M-4 1A4 5.2 0 1 0 4 1A4 5.2 0 1 0 -4 1','#332541',{channel:'eyes',variantInput:'emotion',variants:{happy:{transform:'scale(1 .45)'},sleepy:{transform:'scale(1 .2)'},angry:{transform:'scale(1 .6)'},surprised:{transform:'scale(1.25 1.2)'}}});
 wp(`glint-${i}`,eyeId,'M.2-.5A.8.8 0 1 0 1.8-.5A.8.8 0 1 0 .2-.5','#ffffff',{channel:'glint'});
}
wp('hat-brim','head','M-96-29Q-84-43-42-44L52-43Q94-34 94-20Q85 5 12 8Q-51 7-96-13Q-103-22-96-29','#5d4098',{transform:'translate(0 -3) scale(.65 .78)',channel:'hat'});
wp('hat','head','M-65-35L-43-93L-6-146L30-111L65-36Q9-13-65-35','#8050d2',{transform:'translate(0 -3) scale(.65 .78)',channel:'hat'});
wp('hat-fold','head','M-43-92L-68-79L-27-131L-6-146L-14-104Z','#5335a2',{transform:'translate(0 -3) scale(.65 .78)'});
wp('hat-band','head','M-61-46Q-4-27 61-49L66-33Q4-10-67-31Z','#42287d',{transform:'translate(0 -3) scale(.65 .78)'});
wp('hat-buckle','head','M-13-14H13V14H-13Z M-7-8V8H7V-8Z','#efc063',{transform:'translate(0 -3) scale(.65 .78) translate(25 -43) rotate(-13)'});
for(const side of ['left','right']){
 wp(side+'-sleeve-lower',side+'Lower','M-6-18Q28-22 61-16L62 17Q28 21-6 18Z','#7a348f',{channel:'clothing'});
 wp(side+'-hand',side+'Hand','M-7-11Q3-15 12-8L23 1Q27 8 22 12L10 9Q6 18-5 14L-11 4Z','#f2cdaa',{channel:'skin',transform:`translate(7 0) scale(1 ${side==='left'?-1:1})`});
}
for(const [name,event,duration] of [['idle','REST',3],['work','WORK',3],['read','READ',3],['walk','WALK',1.6],['run','RUN',1],['pour','POUR',3],['phone','PHONE',3]]){
 const runtime=new AnimationController(wwwzardDefinition);runtime.send(event);for(let i=0;i<120;i++)runtime.step(1/120);
 const tracks={};for(let t=0;t<=duration+.0001;t+=.1){const frame=runtime.step(t===0?0:.1);for(const j of wizard.joints)for(const prop of ['rotation','x','y']){const key=`${j.id}.${prop}`;const value=frame.pose[key]??(prop==='rotation'?j.rotation:0);(tracks[key]??=[]).push([Math.round(t*1000)/1000,value]);}}
 wizard.clips[name]={duration,loop:true,tracks};
}
wizard.clips.wave=loop(1.2,{'rightUpper.rotation':track(-40,-55,-40),'rightLower.rotation':track(40,75,40),'rightHand.rotation':track(-25,25,-25),'head.rotation':track(-3,-8,-3)});
wizard.clips.celebrate=loop(1.4,{'leftUpper.rotation':track(170,160,170),'rightUpper.rotation':track(-40,-55,-40),'leftLower.rotation':track(-25,-40,-25),'rightLower.rotation':track(25,40,25),'root.y':track(0,-18,0,-18,0)});
wizard.clips.bow=loop(2.2,{'torso.rotation':track(0,8,8,0),'head.rotation':track(-3,16,16,-3),'root.y':track(0,8,8,0)});
wizard.expressions={happy:{'head.rotation':-4},excited:{'head.y':-5},sad:{'head.rotation':12},angry:{'head.rotation':-8},surprised:{'head.y':-7},sleepy:{'head.rotation':15},curious:{'head.rotation':-12}};
wizard.appearanceDefaults={clothing:'#8e3faa',hem:'#653078',hat:'#8050d2',skin:'#f2cdaa',shoes:'#443353',eyes:'#332541',glint:'#ffffff'};wizard.description='Articulated rig · 10 actions';states(wizard);

fs.mkdirSync('examples/characters',{recursive:true});
for(const [id,pack] of Object.entries({ona,wwwzard:wizard,rusty})){
 const doc={schemaVersion:1,kind:'scene',id,name:pack.name,revision:0,bounds:{width:640,height:400},requiredFeatures:['appearance-variants','expressions'],packs:{[id]:pack},actors:[{id,name:pack.name,pack:id,transform:{x:320,y:id==='wwwzard'?270:240,scale:id==='wwwzard'?1:2,rotation:0},appearance:{},inputs:{}}]};
 addResponseProfile(doc);assertDocument(doc);fs.writeFileSync(`examples/characters/${id}.json`,JSON.stringify(doc,null,2)+'\n');console.log(`${id}: ${pack.joints.length} joints, ${pack.parts.length} parts, ${Object.keys(pack.clips).length} actions.`);
}
