import ona from './characters/ona.json';
import rusty from './characters/rusty.json';
import {standingTarget} from '../src/recovery.js';

/** A host game owns the repair quest; this document owns performances/targets. */
export function createGameExample(){
 const scene=structuredClone(ona);scene.id='little-lands-readiness';scene.name='The corner shop';scene.bounds={width:900,height:500};scene.presentation='live';
 scene.requiredFeatures=[...new Set([...scene.requiredFeatures,'game-bindings','scene-objects'])];
 scene.packs.rusty=structuredClone(Object.values(rusty.packs)[0]);
 scene.actors=[{...scene.actors[0],id:'shopkeeper',name:'Ona',transform:{x:175,y:290,scale:1.35,rotation:0},inputs:{action:'idle',emotion:'neutral'}},{id:'friend',name:'Rusty',pack:'rusty',transform:{x:325,y:404,scale:1.15,rotation:0},inputs:{action:'idle',emotion:'neutral'}}];
 const prop=(id,x,y,width,height,fill,solid=false)=>({id,name:id,x,y,width,height,rotation:0,fill,layer:'background',collider:{enabled:solid,width,height,x:0,y:0,friction:.5,bounce:0}});
 scene.props=[prop('ground',450,470,900,60,'#b3c8a8',true),prop('shop',660,275,270,330,'#f1d9ac'),prop('roof',660,102,302,27,'#bc6751'),prop('door',700,355,64,170,'#6c7971'),prop('window',587,282,83,92,'#9fbbbb'),prop('window-ledge',587,335,104,12,'#ba9b74')];
 const actor=scene.actors[0];actor.transform.y=standingTarget(scene,actor,scene.packs[actor.pack],actor.transform.x).y;
 scene.objects=[{id:'shop-light',name:'Shop light',shape:'circle',x:700,y:244,radius:12,fill:'#ffe8a0',mass:0,enabled:false}];
 scene.game={anchors:{'shop.front':{type:'prop',prop:'shop',offsetX:-185,offsetY:160},'shop.sign':{type:'prop',prop:'shop',offsetY:-118},'home':{type:'point',x:175,y:440}},actors:{shopkeeper:{actions:{inspect:'think',notice:'nod'},reactions:{success:{action:'celebrate',emotion:'happy'},encourage:{action:'wave',emotion:'happy'}},gaze:{joint:'head',maxAngle:20},speech:true},friend:{reactions:{success:{action:'wag',emotion:'happy'},encourage:{action:'tilt',emotion:'curious'}}}}};
 return scene;
}
