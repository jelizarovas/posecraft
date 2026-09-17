const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
const point=value=>record(value)&&finite(value.x,-10000,10000)&&finite(value.y,-10000,10000);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<1e-8&&p.x>=Math.min(a.x,b.x)-1e-8&&p.x<=Math.max(a.x,b.x)+1e-8&&p.y>=Math.min(a.y,b.y)-1e-8&&p.y<=Math.max(a.y,b.y)+1e-8;
function intersects(a,b,c,d){const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);return ac*ad<0&&ca*cb<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);}
function simpleBoundary(points){
  if(!Array.isArray(points)||points.length<3||points.length>64||!points.every(point))return false;
  let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(a.x-b.x,a.y-b.y)<1e-6)return false;area+=a.x*b.y-b.x*a.y;for(let j=i+1;j<points.length;j++){if(j===i+1||i===0&&j===points.length-1)continue;if(intersects(a,b,points[j],points[(j+1)%points.length]))return false;}}
  return Math.abs(area)>1e-4;
}
/** Data-only validation: importing the schema never loads the fluid simulation. */
export function validateBottleFluid(document,check){
  const f=document.fluid;if(f===undefined)return;check(record(f),'fluid','Expected bottle-fluid settings.');if(!record(f))return;
  check(f.type==='bottle','fluid.type','Expected bottle fluid.');
  const vessel=document.actors.find(a=>a.id===f.vessel),contents=document.actors.find(a=>a.id===f.contents);
  check(!!vessel,'fluid.vessel','Missing vessel actor.');check(!!contents&&f.contents!==f.vessel,'fluid.contents','Contents must reference a different existing actor.');
  check(point(f.pivot),'fluid.pivot','Expected a finite local pivot within +/-10000.');
  check(simpleBoundary(f.boundary),'fluid.boundary','Expected a simple, nondegenerate polygon with 3..64 finite local points.');
  check(finite(f.fill,.1,.65),'fluid.fill','Fill must be 0.1..0.65.');check(finite(f.damping,.1,3),'fluid.damping','Damping must be 0.1..3.');check(finite(f.wind,-2,2),'fluid.wind','Wind must be -2..2.');
  check(record(f.ship),'fluid.ship','Expected a ship joint, scale and mass.');if(record(f.ship)){check(!!document.packs[contents?.pack]?.joints?.some(j=>j.id===f.ship.joint),'fluid.ship.joint','Missing contents ship joint.');check(finite(f.ship.scale,.35,1),'fluid.ship.scale','Ship scale must be 0.35..1.');check(finite(f.ship.mass,.1,10),'fluid.ship.mass','Ship mass must be 0.1..10.');}
}
/** Validate and copy small commands before recording or crossing a worker boundary. */
export function validateFluidCommand(command){
  if(!record(command))throw new Error('Invalid bottle-fluid command.');
  const type=command.type;
  if(['grab','move','release','cancel'].includes(type)){
    if(!Array.isArray(command.points)||command.points.length>2||(['grab','move'].includes(type)&&!command.points.length)||(type==='cancel'&&command.points.length)||!command.points.every(p=>point(p)&&Number.isSafeInteger(p.id)&&p.id>=0)||new Set(command.points.map(p=>p.id)).size!==command.points.length)throw new Error('Bottle-fluid pointer commands need up to two distinct, finite points.');
    return {type,points:command.points.map(({id,x,y})=>({id,x,y}))};
  }
  if(type==='wind'){if(!finite(command.value,-2,2))throw new Error('Bottle wind must be -2..2.');return {type,value:command.value};}
  if(type==='motion'||type==='nudge'){
    if(!finite(command.ax,-6000,6000)||!finite(command.ay,-6000,6000)||type==='motion'&&!finite(command.turn,-720,720))throw new Error('Invalid bottle acceleration.');
    const next={type,ax:command.ax,ay:command.ay};if(type==='motion'){next.turn=command.turn;for(const key of ['gravityX','gravityY'])if(command[key]!==undefined){if(!finite(command[key],-2,2))throw new Error('Bottle gravity components must be -2..2.');next[key]=command[key];}}return next;
  }
  throw new Error('Unknown bottle-fluid command.');
}
