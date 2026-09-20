import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMapBirds,createMapBirdLife,drawMapBirds,hasVisibleMapBirds,mapBirdWakeDelay} from '../src/map-birds.js';
import {projectMap} from '../src/map.js';

function map(){return{format:'posecraft-map',version:1,id:'birds',name:'Bird test',width:40,height:32,seed:91,tileSize:{width:64,height:32},terrain:Array(40*32).fill(0),props:[],actors:[],birds:[
 {id:'rook',species:'crow',home:{x:11,y:12,z:2.2},radius:4,seed:12,roost:'rock'},
 {id:'aerie',species:'eagle',home:{x:25,y:8,z:5},radius:7,seed:34,roost:'nest'}
]};}

test('bird schedules are deterministic, distinct, and stay inside their envelopes',()=>{
 const document=map(),a=createMapBirdLife(document),b=createMapBirdLife(structuredClone(document)),states={rook:new Set(),aerie:new Set()};
 for(let time=0;time<180;time+=.25){
  const first=a.sample(time),second=b.sample(time);assert.deepEqual(first,second);
  for(const bird of first){states[bird.id].add(bird.state);const home=document.birds.find(item=>item.id===bird.id).home;assert.ok(Math.hypot(bird.x-home.x,bird.y-home.y)<=bird.radius+1e-9);assert.ok(Number.isFinite(bird.z));}
 }
 assert.deepEqual([...states.rook].sort(),['flight','forage','perch']);
 assert.deepEqual([...states.aerie].sort(),['flight','glide','perch']);
 a.dispose();assert.deepEqual(a.sample(10),[]);
});

test('validation rejects malformed aerial actors',()=>{
 const document=map();document.birds[0].species='sparrow';assert.throws(()=>assertMapBirds(document),/unsupported species/);
 document.birds[0].species='crow';document.birds[1].id='rook';assert.throws(()=>assertMapBirds(document),/ids must be unique/);
});

function context(){
 const calls=[];return{calls,fillStyle:'',strokeStyle:'',lineWidth:1,globalAlpha:1,save(){calls.push('save');},restore(){calls.push('restore');},translate(){calls.push('translate');},rotate(){calls.push('rotate');},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){calls.push('fill');},stroke(){calls.push('stroke');},ellipse(){calls.push('ellipse');}};
}

test('drawing culls offscreen birds and reports only visible active animation',()=>{
 const document=map(),life=createMapBirdLife(document);let time=0,samples=life.sample(time);
 while(!samples.some(bird=>bird.active)&&time<60)samples=life.sample(time+=.2);
 const moving=samples.find(bird=>bird.active),point=projectMap(document,moving),visible={x:point.x-30,y:point.y-30,width:60,height:60},hidden={x:5000,y:5000,width:20,height:20};
 assert.equal(hasVisibleMapBirds(document,samples,time,visible),true);assert.equal(hasVisibleMapBirds(document,samples,time,hidden),false);assert.equal(hasVisibleMapBirds(document,samples,time,visible,{reduced:true}),false);
 const shown=context(),offscreen=context();assert.equal(drawMapBirds(shown,document,samples,time,visible,{}),true);assert.ok(shown.calls.includes('fill'));assert.equal(drawMapBirds(offscreen,document,samples,time,hidden,{}),false);assert.deepEqual(offscreen.calls,[]);
});

test('quiet visible envelopes request a bounded wake without polling distant birds',()=>{
 const document=map();document.birds=[document.birds[0]];const life=createMapBirdLife(document);let time=0,samples=life.sample(time);
 while(samples.some(bird=>bird.active)&&time<100)samples=life.sample(time+=.25);
 const home=projectMap(document,document.birds.find(bird=>bird.id===samples[0].id).home),visible={x:home.x-20,y:home.y-20,width:40,height:40},hidden={x:5000,y:5000,width:20,height:20};
 assert.equal(mapBirdWakeDelay(document,life,time,visible),750);assert.equal(life.nextWake(time,visible),750);assert.equal(mapBirdWakeDelay(document,life,time,hidden),null);assert.equal(mapBirdWakeDelay(document,life,time,visible,{reduced:true}),null);
});

test('airborne samples clear raised terrain beneath their current position',()=>{
 const document=map();document.elevations=Array((document.width+1)*(document.height+1)).fill(6);for(const bird of document.birds)bird.home.z=7;
 const life=createMapBirdLife(document);
 for(let time=0;time<90;time+=.1)for(const bird of life.sample(time))if(bird.state==='flight'||bird.state==='glide')assert.ok(bird.z>=6+(bird.species==='eagle'?.8:.45)-1e-9);
});
