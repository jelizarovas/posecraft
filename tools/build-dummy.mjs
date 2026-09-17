// Original vector test mannequin. Regenerate with node tools/build-dummy.mjs.
import fs from 'node:fs';
import {assertDocument} from '../src/schema.js';
const joints=[],parts=[],bodies={};
const circle=(x,y,r)=>`M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0`;
function limb(id,parent,x,y,rotation,min,max,length,width){
 joints.push({id,parent,x,y,rotation,min,max,length});
 bodies[id]={width:length,height:width,x:length/2,y:0,density:id==='root'?2:1};
 parts.push({id:id+'-shell',joint:id,d:`M3 ${-width/2}H${length-3}Q${length} ${-width/2} ${length} 0Q${length} ${width/2} ${length-3} ${width/2}H3Q0 ${width/2} 0 0Q0 ${-width/2} 3 ${-width/2}Z`,fill:'#d8b997',channel:'shell',stroke:'#69594d',strokeWidth:1.2});
 parts.push({id:id+'-joint',joint:id,d:circle(0,0,width*.28),fill:'#61564f',channel:'joints',stroke:'#fff4dd',strokeWidth:1});
}
limb('root',null,0,0,0,-40,40,1,28);bodies.root={width:38,height:25,x:0,y:0,density:2};
parts[0].d='M-19 -12H19L16 13H-16Z';
limb('torso','root',0,-10,-90,-120,-60,48,34);
limb('head','torso',51,0,90,45,135,1,32);bodies.head={width:32,height:38,x:0,y:-16,density:1};parts.find(p=>p.id==='head-shell').d='M-16 -28Q-16 -36 0 -36Q16 -36 16 -28V-7Q16 3 0 3Q-16 3 -16 -7Z';
for(const side of ['left','right']){const left=side==='left';
 limb(side+'Upper','torso',39,left?-21:21,left?-165:165,-180,180,32,12);
 limb(side+'Lower',side+'Upper',32,0,0,left?-145:-5,left?5:145,29,10);
 limb(side+'Hand',side+'Lower',29,0,0,-65,65,13,11);
 limb(side+'Thigh','root',left?-12:12,10,90,30,150,39,16);
 limb(side+'Calf',side+'Thigh',39,0,0,left?-5:-145,left?145:5,36,12);
 limb(side+'Foot',side+'Calf',36,0,-90,-125,-45,19,10);
}
const emotions=['neutral','happy','excited','sad','angry','surprised','sleepy','curious','scared','hurt','dizzy','focused','relieved','wink'];
for(const [i,x] of [-7,7].entries())parts.push({id:'eye-'+i,joint:'head',d:circle(x,-19,2.5),fill:'#413a37',channel:'eyes',variantInput:'emotion',variants:{happy:{transform:'translate(0 -10) scale(1 .45)'},sleepy:{transform:'translate(0 -16) scale(1 .15)'},hurt:{transform:'translate(0 -16) scale(1 .15)'},scared:{transform:'translate(0 4) scale(1 1.2)'},angry:{transform:'translate(0 -8) scale(1 .6)'},wink:i===0?{transform:'translate(0 -16) scale(1 .15)'}:{}}});
parts.push({id:'mouth',joint:'head',d:'M-5 -8H5',fill:'none',stroke:'#413a37',strokeWidth:1.5,variantInput:'emotion',variants:{happy:{d:'M-6 -9Q0 -1 6 -9'},excited:{d:'M-5 -10Q0 4 5 -10Z'},sad:{d:'M-5 -6Q0 -12 5 -6'},surprised:{d:circle(0,-8,3)},scared:{d:circle(0,-8,4)},hurt:{d:'M-6 -7L-3 -10L0 -7L3 -10L6 -7'},dizzy:{d:'M-6 -8Q-3 -12 0 -8T6 -8'},relieved:{d:'M-5 -9Q0 -3 5 -9'},curious:{d:'M-5 -8L4 -10'},angry:{d:'M-5 -7L5 -9'},focused:{d:'M-4 -8H4'},sleepy:{d:'M-2 -8H2'},wink:{d:'M-5 -9Q0 -3 5 -9'}}});
parts.push({id:'chest-target',joint:'torso',d:circle(25,0,9)+'M16 0H34M25 -9V9',fill:'#f1d783',channel:'markings',stroke:'#61564f',strokeWidth:1.5});
parts.push({id:'hurt-cheek',joint:'head',d:'M-13 -12L-8 -14M8 -14L13 -12',fill:'none',stroke:'#db666a',strokeWidth:2,showWhen:{input:'emotion',equals:'hurt'}});
const clips={};const motion=(name,duration,pose)=>{clips[name]={duration,loop:true,tracks:Object.fromEntries(Object.entries(pose).map(([j,values])=>[j+'.rotation',values.map((v,i)=>[i*duration/(values.length-1),v,'smooth'])]))};};
motion('idle',3,{root:[0,2,0,-2,0],head:[90,92,90]});
motion('wave',2,{rightUpper:[165,45,45,165],rightLower:[0,110,65,110,0],head:[90,82,90]});
motion('nod',1.5,{head:[90,108,90,108,90]});motion('dance',2,{root:[-15,15,-15],leftUpper:[-165,-100,-165],rightUpper:[165,110,165],leftThigh:[80,110,80],rightThigh:[110,80,110]});
motion('reach',2,{leftUpper:[-165,-70,-165],rightUpper:[165,70,165]});
motion('crouch',2,{leftThigh:[90,55,90],rightThigh:[90,125,90],leftCalf:[0,75,0],rightCalf:[0,-75,0]});
const actions=Object.keys(clips),pack={name:'Dummy',description:'Original articulated test mannequin with visible pivots and editable collision proxies.',provenance:{source:'Posecraft original vector mannequin',license:'MIT'},joints,parts,clips,inputs:{action:{type:'string',default:'idle',options:actions},emotion:{type:'string',default:'neutral',options:emotions}},initial:'idle',states:Object.fromEntries(actions.map(id=>[id,{clip:id,transitions:actions.filter(to=>to!==id).map(to=>({to,duration:.25,when:{input:'action',equals:to}}))}])),appearanceDefaults:{shell:'#d8b997',joints:'#61564f',eyes:'#413a37',markings:'#f1d783'},expressions:Object.fromEntries(emotions.map(e=>[e,{}])),reaction:{joint:'root',strength:1,stiffness:35,damping:8},physics:{root:'root',head:'head',bodies,responses:{brace:{'leftUpper.rotation':-110,'rightUpper.rotation':110,'leftLower.rotation':-30,'rightLower.rotation':30},protect:{'leftUpper.rotation':-45,'rightUpper.rotation':45,'leftLower.rotation':-125,'rightLower.rotation':125,'head.rotation':110},curl:{'leftUpper.rotation':-110,'rightUpper.rotation':110,'leftLower.rotation':-130,'rightLower.rotation':130,'leftThigh.rotation':45,'rightThigh.rotation':135,'leftCalf.rotation':110,'rightCalf.rotation':-110}}}};
const doc={schemaVersion:1,kind:'scene',id:'dummy-demo',name:'Dummy',revision:0,bounds:{width:640,height:400},requiredFeatures:['rigs','rigid-body-physics','expressions','response-states'],packs:{dummy:pack},actors:[{id:'dummy',name:'Dummy',pack:'dummy',transform:{x:320,y:205,scale:1.25,rotation:0}}]};
fs.writeFileSync('examples/characters/dummy.json',JSON.stringify(assertDocument(doc),null,2)+'\n');
