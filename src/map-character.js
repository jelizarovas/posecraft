import {projectMap} from './map.js';

const TAU=Math.PI*2,ROOT_DISTANCE=32*Math.SQRT2;
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const unit=angle=>({x:(Math.cos(angle)-Math.sin(angle))/Math.SQRT2,y:(Math.cos(angle)+Math.sin(angle))/(2*Math.SQRT2)});
const finite=value=>Number.isFinite(value)?value:0;

/** A planted foot moves opposite travel while its counterpart swings forward. */
function footCycle(phase,moving,running=false){
  if(!moving)return{forward:0,lift:0,stance:true};
  const contact=running ? .42 : .6,cycle=((phase/TAU)%1+1)%1,stance=cycle<contact;
  if(stance)return{forward:ROOT_DISTANCE*(contact/2-cycle),lift:0,stance:true};
  const t=(cycle-contact)/(1-contact);
  return{forward:ROOT_DISTANCE*mix(-contact/2,contact/2,smooth(t)),lift:Math.sin(t*Math.PI)*(running?8.5:5),stance:false};
}

/** Pure camera-space joints. Body yaw and translation direction are independent. */
export function sampleMapActor(actor,reduced=false){
  const facing=finite(actor.facing),travel=Number.isFinite(actor.travelFacing)?actor.travelFacing:facing;
  const forward=unit(facing),right=unit(facing+Math.PI/2),stride=unit(travel);
  const phase=finite(actor.phase),weight=Number.isFinite(actor.gaitWeight)?Math.max(0,Math.min(1,actor.gaitWeight)):1,moving=!!actor.walking&&!reduced&&weight>0;
  const running=moving&&(actor.running===true||actor.gait==='run'),bob=moving?(running?1.4+Math.sin(phase*2)*1.3:Math.sin(phase*2)*.65)*weight:0;
  const point=(lateral,depth,height)=>{depth+=(running?3.2*weight:0)*Math.max(0,Math.min(1,(height-12)/22));return{x:right.x*lateral+forward.x*depth,y:right.y*lateral+forward.y*depth-height,depth:right.y*lateral+forward.y*depth};};
  const limbs=[-1,1].map((side,i)=>{
    const gait=footCycle(phase+i*Math.PI,moving,running),hip=point(side*2.7,0,14+bob);gait.forward*=weight;gait.lift*=weight;
    const base=point(side*2.7,0,0),foot={x:base.x+stride.x*gait.forward,y:base.y+stride.y*gait.forward-gait.lift,depth:base.depth+stride.y*gait.forward};
    // Knee pole remains ahead of the leg, including rear and profile views.
    const bend=running?4.1:2.8,knee={x:mix(hip.x,foot.x,.52)+stride.x*bend,y:mix(hip.y,foot.y,.52)+stride.y*bend-1.2,depth:mix(hip.depth,foot.depth,.52)+stride.y*bend};
    const swing=moving?-Math.sin(phase+i*Math.PI)*(running?10:7)*weight:0,shoulder=point(side*5.1,0,25+bob),elbow=point(side*6,swing*.55,(running?20.5:19)+bob),hand=point(side*5.8,swing,(running?22:14.5)+bob);
    return{side,gait,hip,knee,foot,shoulder,elbow,hand,depth:point(side*5.8,swing*.3,0).depth};
  });
  return{facing,forward,right,stride,phase,moving,running,bob,point,limbs};
}

function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,points,color,width){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function ring(sample,width,depth,height,n=16){return Array.from({length:n},(_,i)=>{const a=i*TAU/n;return sample.point(Math.cos(a)*width,Math.sin(a)*depth,height);});}
function shell(ctx,sample,{width,depth,bottom,top,color,offset=0}){
  const lower=ring(sample,width,depth,bottom),upper=ring(sample,width*.9,depth*.92,top),faces=[];
  for(let i=0;i<lower.length;i++){const next=(i+1)%lower.length;faces.push({points:[upper[i],upper[next],lower[next],lower[i]],depth:(lower[i].depth+lower[next].depth)/2,i});}
  ctx.save();ctx.translate(sample.forward.x*offset,sample.forward.y*offset);
  polygon(ctx,lower,color);faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){polygon(ctx,face.points,color);if(face.i<8)polygon(ctx,face.points,'#ffffff0b');else polygon(ctx,face.points,'#162d391a');}
  polygon(ctx,upper,color);ctx.restore();
}
function drawPack(ctx,sample){
  shell(ctx,sample,{width:4.1,depth:1.9,bottom:17+sample.bob,top:27+sample.bob,color:'#a78558',offset:-4.6});
  const a=sample.point(-3.2,-6.5,24+sample.bob),b=sample.point(3.2,-6.5,24+sample.bob);
  line(ctx,[a,b],'#dac19a',1.5);
}
function drawArm(ctx,sample,limb){
  line(ctx,[limb.shoulder,limb.elbow,limb.hand],'#434c49',4.8);
  line(ctx,[limb.shoulder,limb.elbow,limb.hand],limb.depth<0?'#c89b72':'#e1b98b',3.5);
  const sleeve={x:mix(limb.shoulder.x,limb.elbow.x,.33),y:mix(limb.shoulder.y,limb.elbow.y,.33)};
  line(ctx,[limb.shoulder,sleeve],sample.color,5.2);
  ellipse(ctx,limb.hand.x,limb.hand.y,2,2.1,'#e6bf90');
}
function drawLeg(ctx,sample,limb){
  line(ctx,[limb.hip,limb.knee,limb.foot],'#344753',4.1);
  line(ctx,[limb.hip,limb.knee],limb.depth<0?'#3e5361':'#506976',3.7);
  const right=sample.right,front=sample.forward,p=limb.foot;
  // Shoes occupy a small oriented rectangle on the ground, not a screen-facing dash.
  polygon(ctx,[[-1.7,-1],[1.7,-1],[2,3.2],[-2,3.2]].map(([l,d])=>({x:p.x+right.x*l+front.x*d,y:p.y+right.y*l+front.y*d-1})), '#283c43','#26373e');
}
function drawHead(ctx,sample){
  const height=33+sample.bob,c=sample.point(0,0,height),front=sample.forward;
  ellipse(ctx,c.x,c.y,6.1,7.3,'#d6ad80');
  // Project the facial surface around an ellipsoid. Only forward-facing features show.
  ctx.save();ctx.beginPath();ctx.ellipse(c.x,c.y,6.2,7.4,0,0,TAU);ctx.clip();
  const frontAmount=Math.max(0,Math.min(1,front.y*2+.5));
  const faceCenter={x:c.x+front.x*3,y:c.y+front.y*2};
  ellipse(ctx,faceCenter.x,faceCenter.y+1,4.2,5.8,'#e8c69b');
  // Back hair wraps around the skull; the face opening shifts with yaw without scaling the head.
  const faceNormal=front.y*2;
  const hairCoverage=Math.max(0,Math.min(1,(.35-faceNormal)/.65));
  if(hairCoverage>0){ctx.globalAlpha=hairCoverage;ellipse(ctx,c.x-front.x*2,c.y-1,6.4,7.5,'#504737');ctx.globalAlpha=1;}
  polygon(ctx,[{x:c.x-6.5,y:c.y-2},{x:c.x-5,y:c.y-6},{x:c.x-1,y:c.y-8},{x:c.x+4.5,y:c.y-6.8},{x:c.x+6.7,y:c.y-2.2},{x:c.x+front.x*2+2,y:c.y-3.7},{x:c.x+front.x*2-1,y:c.y-2},{x:c.x-3,y:c.y-3.8}], '#504737');
  if(frontAmount>0){
    ctx.globalAlpha=frontAmount;
    for(const side of [-1,1]){const p=sample.point(side*2.4,5,33+sample.bob);const visible=Math.max(0,Math.min(1,(front.y*.8+side*sample.right.y*.6)*3));ctx.globalAlpha=frontAmount*visible;ellipse(ctx,p.x,p.y,.68,1.05,'#34403a');}
    ctx.globalAlpha=frontAmount;const mouth=sample.point(0,5,30+sample.bob);line(ctx,[{x:mouth.x-1,y:mouth.y},{x:mouth.x+1,y:mouth.y}], '#a67754',.7);
  }
  ctx.restore();
  // A small projecting nose keeps the profile readable at exact side-on yaw.
  if(Math.abs(front.x)>.5&&front.y>-.18){const nose=sample.point(0,6,32.5+sample.bob);ellipse(ctx,nose.x,nose.y,1.5,1.3,'#e4bc8e');}
  const ear=sample.point((sample.right.y>=0?1:-1)*5,0,32+sample.bob);ellipse(ctx,ear.x,ear.y,1.4,1.9,'#d8ad7e');
}

/** Lightweight directional map adventurer; all joints share a projected body basis. */
export function drawMapActor(ctx,map,actor,definition,reduced=false,{shadow=true}={}){
  const sample=sampleMapActor(actor,reduced),position=projectMap(map,actor),scale=map.tileSize.width/64;
  sample.color=definition?.color||'#8665be';ctx.save();ctx.translate(position.x,position.y);ctx.scale(scale,scale);
  if(shadow)ellipse(ctx,0,1,10,3.5,'#213d3d30');
  const limbs=[...sample.limbs].sort((a,b)=>a.foot.depth-b.foot.depth);for(const limb of limbs)drawLeg(ctx,sample,limb);
  for(const limb of sample.limbs.filter(limb=>limb.depth<0))drawArm(ctx,sample,limb);
  if(sample.forward.y>=0)drawPack(ctx,sample);
  shell(ctx,sample,{width:5.4,depth:3.6,bottom:12.5+sample.bob,top:26+sample.bob,color:sample.color});
  const belt=ring(sample,5.6,3.7,14+sample.bob);line(ctx,[...belt,belt[0]],'#b99c64',1.2);
  if(sample.forward.y<0)drawPack(ctx,sample);
  for(const limb of sample.limbs.filter(limb=>limb.depth>=0))drawArm(ctx,sample,limb);
  drawHead(ctx,sample);ctx.restore();
}
