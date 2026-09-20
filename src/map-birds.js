import {groundHeight,projectMap} from './map.js';

const TAU=Math.PI*2;
const species=new Set(['crow','eagle']);
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

function hash(value){
 let result=2166136261;
 for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619)>>>0;
 return result;
}

function randoms(seed){
 let value=seed>>>0;
 return()=>{value+=0x6d2b79f5;let next=value;next=Math.imul(next^next>>>15,next|1);next^=next+Math.imul(next^next>>>7,next|61);return((next^next>>>14)>>>0)/4294967296;};
}

function birdSeed(map,bird){return Number.isSafeInteger(bird.seed)?bird.seed>>>0:hash(`${map.seed??0}:${bird.id}`);}

function inside(point,rect,pad=0){
 const width=rect?.width??rect?.w??0,height=rect?.height??rect?.h??0;
 return !!rect&&point.x+pad>=rect.x&&point.x-pad<=rect.x+width&&point.y+pad>=rect.y&&point.y-pad<=rect.y+height;
}

function birdDefinitions(map,birds){
 if(Array.isArray(birds))return birds;
 if(birds&&typeof birds.sample==='function')return birds.sample(0).map(sample=>sample.definition??sample);
 return map.birds??[];
}

/** Validate independent aerial actors without adding them to map pathfinding. */
export function assertMapBirds(map){
 const birds=map?.birds;
 if(birds===undefined)return map;
 if(!Array.isArray(birds)||birds.length>256)throw TypeError('Invalid map birds: expected at most 256 birds.');
 const ids=new Set();
 for(const bird of birds){
  const home=bird?.home;
  if(!bird||typeof bird.id!=='string'||!bird.id||ids.has(bird.id))throw TypeError('Invalid map birds: ids must be unique nonempty strings.');
  ids.add(bird.id);
  if(!species.has(bird.species))throw TypeError(`Invalid map bird ${bird.id}: unsupported species.`);
  if(!home||![home.x,home.y,home.z].every(Number.isFinite)||home.x<0||home.y<0||home.x>=map.width||home.y>=map.height)throw TypeError(`Invalid map bird ${bird.id}: home must be inside the map and include z.`);
  if(!Number.isFinite(bird.radius)||bird.radius<.25||bird.radius>64)throw TypeError(`Invalid map bird ${bird.id}: radius must be between 0.25 and 64.`);
  if(bird.seed!==undefined&&!Number.isSafeInteger(bird.seed))throw TypeError(`Invalid map bird ${bird.id}: seed must be a safe integer.`);
  if(bird.roost!==undefined&&!['nest','branch','rock'].includes(bird.roost))throw TypeError(`Invalid map bird ${bird.id}: unsupported roost.`);
 }
 return map;
}

function profile(map,bird){
 const random=randoms(birdSeed(map,bird)),crow=bird.species==='crow';
 const direction=random()<.5?-1:1,angle=random()*TAU,radius=bird.radius*(.62+random()*.34);
 const targetAngle=angle+(random()-.5)*1.2;
 const target={
  x:clamp(bird.home.x+Math.cos(targetAngle)*radius*.72,0,map.width-1e-6),
  y:clamp(bird.home.y+Math.sin(targetAngle)*radius*.72,0,map.height-1e-6)
 };
 const durations=crow
  ?[5+random()*4,4+random()*3,6+random()*5,4+random()*3]
  :[9+random()*6,5+random()*3,7+random()*5,5+random()*3];
 return{direction,angle,radius,target,durations,offset:random()*durations.reduce((sum,value)=>sum+value,0),wingOffset:random()*TAU};
}

function phaseAt(info,time){
 const total=info.durations.reduce((sum,value)=>sum+value,0);
 let local=((Math.max(0,Number.isFinite(time)?time:0)+info.offset)%total+total)%total;
 for(let index=0;index<info.durations.length;index++){
  const duration=info.durations[index];
  if(local<duration)return{index,t:local/duration,local,duration,total};
  local-=duration;
 }
 return{index:0,t:0,local:0,duration:info.durations[0],total};
}

function crowSample(map,bird,info,time,phase){
 const home=bird.home,target=info.target,ground=groundHeight(map,target)+.08;
 if(phase.index===0)return{x:home.x,y:home.y,z:home.z,state:'perch',heading:info.angle,wing:0,active:false};
 if(phase.index===2){
  const wander=Math.sin(phase.t*TAU*2+info.angle)*bird.radius*.08;
  return{x:clamp(target.x+Math.cos(info.angle+Math.PI/2)*wander,0,map.width-1e-6),y:clamp(target.y+Math.sin(info.angle+Math.PI/2)*wander,0,map.height-1e-6),z:ground,state:'forage',heading:info.angle+Math.sin(phase.t*TAU)*.8,wing:0,active:true};
 }
 const returning=phase.index===3,t=smooth(phase.t),from=returning?target:home,to=returning?home:target;
 const x=mix(from.x,to.x,t),y=mix(from.y,to.y,t),arc=Math.sin(Math.PI*t),planned=mix(returning?ground:home.z,returning?home.z:ground,t)+arc*Math.min(2.3,bird.radius*.5+.45),z=Math.max(planned,groundHeight(map,{x,y})+.45);
 const heading=Math.atan2(to.y-from.y,to.x-from.x),wing=Math.sin(time*TAU*2.8+info.wingOffset);
 return{x,y,z,state:'flight',heading,wing,active:true};
}

function eagleSample(map,bird,info,time,phase){
 const home=bird.home;
 if(phase.index===0)return{x:home.x,y:home.y,z:home.z,state:'perch',heading:info.angle,wing:0,active:false};
 const flightDuration=info.durations[1]+info.durations[2]+info.durations[3];
 const elapsed=phase.index===1?phase.local:phase.index===2?info.durations[1]+phase.local:info.durations[1]+info.durations[2]+phase.local;
 const t=elapsed/flightDuration,theta=t*TAU*info.direction;
 const radial=Math.sin(Math.PI*t),along=info.radius*radial;
 const x=clamp(home.x+Math.cos(info.angle+theta)*along,0,map.width-1e-6),y=clamp(home.y+Math.sin(info.angle+theta)*along*.72,0,map.height-1e-6);
 const z=Math.max(home.z+Math.sin(Math.PI*t)*Math.min(4,info.radius*.42+1),groundHeight(map,{x,y})+.8);
 const dx=Math.cos(info.angle+theta)*Math.PI*info.direction*info.radius*2*Math.cos(Math.PI*t)-Math.sin(info.angle+theta)*along*TAU*info.direction;
 const dy=(Math.sin(info.angle+theta)*Math.PI*info.direction*info.radius*2*Math.cos(Math.PI*t)+Math.cos(info.angle+theta)*along*TAU*info.direction)*.72;
 const gliding=phase.index===2;
 return{x,y,z,state:gliding?'glide':'flight',heading:Math.atan2(dy,dx),wing:gliding?.18:Math.sin(time*TAU*1.65+info.wingOffset),active:true};
}

function makeSampler(map,definitions){
 const records=definitions.map(definition=>({definition,info:profile(map,definition)}));
 return time=>records.map(({definition,info})=>{
  const phase=phaseAt(info,time),motion=definition.species==='crow'?crowSample(map,definition,info,time,phase):eagleSample(map,definition,info,time,phase);
  return{id:definition.id,species:definition.species,home:{...definition.home},radius:definition.radius,roost:definition.roost,phase:phase.t,definition,...motion};
 });
}

/** Deterministic, bounded bird schedules. Sampling has no pathfinding or mutable clock. */
export function createMapBirdLife(map){
 assertMapBirds(map);
 const definitions=(map.birds??[]).map(bird=>({...bird,home:{...bird.home}})),sample=makeSampler(map,definitions);
 let disposed=false;
 return{
  sample(time){return disposed?[]:sample(time);},
  hasVisible(time,rect,{reduced=false}={}){return !disposed&&hasVisibleMapBirds(map,sample(time),time,rect,{reduced});},
  nextWake(time,rect,{reduced=false}={}){return disposed?null:mapBirdWakeDelay(map,this,time,rect,{reduced});},
  dispose(){disposed=true;}
 };
}

function projectedRadius(map,sample){return (sample.species==='eagle'?15:9)*map.tileSize.width/64;}

/** True only when a visible moving bird needs another animation frame. */
export function hasVisibleMapBirds(map,birds,time,rect,{reduced=false}={}){
 if(reduced)return false;
 const samples=birds&&typeof birds.sample==='function'?birds.sample(time):birds??[];
 return samples.some(bird=>bird.active&&inside(projectMap(map,bird),rect,projectedRadius(map,bird)));
}

function flightEnvelopeVisible(map,bird,rect){
 const points=[],steps=16,rise=bird.species==='eagle'?Math.min(4,bird.radius*.42+1):Math.min(2.3,bird.radius*.5+.45),clearance=bird.species==='eagle'?.8:.45;
 for(let index=0;index<steps;index++){
  const angle=index/steps*TAU,x=clamp(bird.home.x+Math.cos(angle)*bird.radius,0,map.width-1e-6),y=clamp(bird.home.y+Math.sin(angle)*bird.radius,0,map.height-1e-6);
  const ground=groundHeight(map,{x,y});points.push(projectMap(map,{x,y,z:Math.min(bird.home.z,ground)}),projectMap(map,{x,y,z:Math.max(bird.home.z+rise,ground+clearance)}));
 }
 points.push(projectMap(map,bird.home));
 const pad=(bird.species==='eagle'?16:10)*map.tileSize.width/64,left=Math.min(...points.map(point=>point.x))-pad,right=Math.max(...points.map(point=>point.x))+pad,top=Math.min(...points.map(point=>point.y))-pad,bottom=Math.max(...points.map(point=>point.y))+pad,width=rect?.width??rect?.w??0,height=rect?.height??rect?.h??0;
 return !!rect&&left<=rect.x+width&&right>=rect.x&&top<=rect.y+height&&bottom>=rect.y;
}

/** Delay for a single invalidation while a visible flight envelope is currently quiet. */
export function mapBirdWakeDelay(map,birds,time,rect,{reduced=false}={}){
 if(reduced)return null;
 const samples=birds&&typeof birds.sample==='function'?birds.sample(time):Array.isArray(birds)&&birds.every(bird=>typeof bird.state==='string')?birds:makeSampler(map,birdDefinitions(map,birds))(time);
 if(samples.some(bird=>bird.active&&inside(projectMap(map,bird),rect,projectedRadius(map,bird))))return 0;
 return samples.some(bird=>flightEnvelopeVisible(map,bird.definition??bird,rect))?750:null;
}

function polygon(ctx,points,fill){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}

function drawRoost(ctx,map,bird,rect){
 if(!bird.roost)return;
 const point=projectMap(map,bird.home),scale=map.tileSize.width/64;
 if(!inside(point,rect,18*scale))return;
 ctx.save();ctx.translate(point.x,point.y);
 if(bird.roost==='nest'){
  ellipse(ctx,0,2,13*scale,4.5*scale,'#493a2d');ellipse(ctx,0,1,10*scale,3*scale,'#8b6c45');
  ctx.strokeStyle='#b99a68';ctx.lineWidth=Math.max(1,1.2*scale);for(let i=-8;i<=8;i+=4){ctx.beginPath();ctx.moveTo(i*scale,0);ctx.lineTo((i+5)*scale,4*scale);ctx.stroke();}
 }else{
  ctx.strokeStyle=bird.roost==='branch'?'#665039':'#77736a';ctx.lineWidth=Math.max(1,2.2*scale);ctx.beginPath();ctx.moveTo(-11*scale,3*scale);ctx.lineTo(12*scale,0);ctx.stroke();
 }
 ctx.restore();
}

function drawBird(ctx,map,bird,reduced){
 const point=projectMap(map,bird),scale=map.tileSize.width/64*(bird.species==='eagle'?1.25:.72),heading=bird.heading??0;
 const dx=Math.cos(heading),dy=Math.sin(heading),angle=Math.atan2((dx+dy)*map.tileSize.height/2,(dx-dy)*map.tileSize.width/2);
 const flying=bird.state==='flight'||bird.state==='glide',wing=reduced?0:bird.wing??0;
 const dark=bird.species==='eagle'?'#493b31':'#202427',mid=bird.species==='eagle'?'#765b3f':'#383d40',light=bird.species==='eagle'?'#d6c7a7':'#70777a';
 ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);
 ctx.globalAlpha=.16;ellipse(ctx,1*scale,3*scale,8*scale,2.2*scale,'#23312d');ctx.globalAlpha=1;
 const spread=flying?(7+Math.abs(wing)*5)*scale:3.2*scale,lift=flying?wing*5*scale:1.5*scale;
 polygon(ctx,[[-2*scale,0],[-6*scale,-spread],[-1*scale,-lift],[2*scale,0]],mid);
 polygon(ctx,[[-2*scale,0],[-6*scale,spread],[-1*scale,lift],[2*scale,0]],dark);
 polygon(ctx,[[-6*scale,-spread],[-3*scale,-spread*.58],[-1*scale,-lift]],light);
 ellipse(ctx,0,0,6.4*scale,3.1*scale,dark);ellipse(ctx,4.8*scale,-.5*scale,2.5*scale,2.25*scale,mid);
 polygon(ctx,[[-5*scale,0],[-10*scale,-2.5*scale],[-8*scale,.2*scale],[-10*scale,2.4*scale]],dark);
 polygon(ctx,[[6.5*scale,-.7*scale],[9.5*scale,0],[6.5*scale,.7*scale]],bird.species==='eagle'?'#d1a33b':'#777067');
 if(bird.species==='eagle'){ellipse(ctx,4.7*scale,-.6*scale,2.1*scale,1.7*scale,'#e2ddd0');ellipse(ctx,5.5*scale,-1.1*scale,.35*scale,.35*scale,'#171714');}
 else ellipse(ctx,5.2*scale,-1.2*scale,.3*scale,.3*scale,'#b8c1bd');
 if(bird.state==='forage'){ctx.rotate(.45+.22*Math.sin((bird.phase??0)*TAU*4));}
 ctx.restore();
}

/** Draw visible birds in projected world space. Returns true while visible birds animate. */
export function drawMapBirds(ctx,map,birds,time,rect,{reduced=false}={}){
 const definitions=birdDefinitions(map,birds),samples=birds&&typeof birds.sample==='function'?birds.sample(time):Array.isArray(birds)&&birds.every(bird=>typeof bird.state==='string')?birds:makeSampler(map,definitions)(time);
 for(const bird of definitions)drawRoost(ctx,map,bird,rect);
 let active=false;
 for(const bird of samples){const point=projectMap(map,bird),pad=projectedRadius(map,bird);if(!inside(point,rect,pad))continue;drawBird(ctx,map,bird,reduced);if(bird.active&&!reduced)active=true;}
 return active;
}

export const mapBirdSpecies=Object.freeze([...species]);
