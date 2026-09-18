import ona from './characters/ona.json' with {type:'json'};
import {addSpatialRig,addOnaArmJoints} from '../src/character-rigs.js';
export function createCatch(){
 const pack=structuredClone(ona.packs.ona);addSpatialRig(pack,'ona',{studies:false});addOnaArmJoints(pack);
 const source=ona.actors[0],actors=['pip','fern'].map((id,i)=>({...structuredClone(source),id,name:i?'Fern':'Pip',pack:'ona',transform:{x:i?600:180,y:318,rotation:0,scale:1.8},inputs:{...source.inputs,action:'idle',emotion:'neutral',hair:i?'curls':'swept'},appearance:{...source.appearance,clothing:i?'#91b9a2':'#e8ae69',hair:i?'#513a30':'#c98148',eyes:i?'#556b55':'#4e6f81'},group:'cast',behavior:{mode:'animated',autoFace:false}}));
 for(const a of actors){if(!pack.inputs.action?.options.includes(a.inputs.action))a.inputs.action=pack.inputs.action?.default;}
 return {schemaVersion:1,kind:'scene',id:'game-of-catch',name:'A game of catch',revision:0,bounds:{width:800,height:450},presentation:'live',requiredFeatures:['scene-groups','spatial-rig','scene-objects','prop-games'],packs:{ona:pack},actors,groups:[{id:'cast',name:'Players',parent:null},{id:'setting',name:'Setting',parent:null}],
 props:[{id:'sky',name:'Sky',group:'setting',layer:'background',x:400,y:180,width:800,height:450,rotation:0,fill:'#e0ebe8',collider:{enabled:false,width:800,height:450,x:0,y:0,friction:.5,bounce:.2}},{id:'grass',name:'Grass',group:'setting',layer:'background',x:400,y:440,width:800,height:70,rotation:0,fill:'#94b18c',collider:{enabled:false,width:800,height:70,x:0,y:0,friction:.5,bounce:.2}}],
 objects:[{id:'ball',name:'Ball',shape:'circle',x:240,y:340,radius:10,fill:'#df8257',mass:.2,restitution:.65,damping:.05,friction:.6,depth:410,owner:{actor:'pip',joint:'rightWrist'}}],objectPhysics:{gravity:650,floorY:410,actorCollisions:false},
 objectGames:[{id:'passing',type:'catch',object:'ball',seed:20260917,variation:75,flightTime:1.35,pause:1.3,participants:actors.map((a,i)=>({actor:a.id,root:'root',head:'head',feet:['leftFoot','rightFoot'],chain:{upper:i?'leftArm':'rightArm',lower:i?'leftForearm':'rightForearm',end:i?'leftWrist':'rightWrist'},bend:i?-1:1,speed:145,skill:i?.78:.88,reaction:.14,crouch:48}))}]};
}

/** The same passing game with an authored walking area and collision props. */
export function createCatchNavigation(){const doc=createCatch();doc.name='Catch around obstacles';doc.bounds.height=500;doc.requiredFeatures.push('navigation','scene-depth');doc.objectGames[0].navigation={bounds:{x:40,y:210,width:720,height:180},cellSize:12,clearance:18,maxNodes:64};const grass=doc.props.find(p=>p.id==='grass');Object.assign(grass,{y:375,height:250});grass.collider.height=250;
 for(const actor of doc.actors)actor.depth={joint:'root',offset:50};
 doc.props.push({id:'garden-box',name:'Garden box',group:'setting',layer:'characters',x:400,y:318,width:90,height:38,rotation:12,fill:'#839781',depth:{value:368},collider:{enabled:true,width:90,height:38,x:0,y:0,friction:.7,bounce:.45}});
 return doc;}
