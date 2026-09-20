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
  const jumping=actor.jumping===true,rolling=actor.rolling===true,traversing=typeof actor.traversalAction==='string';
  const phase=finite(actor.phase),weight=Number.isFinite(actor.gaitWeight)?Math.max(0,Math.min(1,actor.gaitWeight)):1,moving=!!actor.walking&&!reduced&&weight>0&&!jumping&&!rolling&&!traversing;
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
  if(jumping){
    const tuck=Math.sin(Math.max(0,Math.min(1,finite(actor.jumpProgress)))*Math.PI);
    for(const limb of limbs){
      limb.foot.x=mix(limb.foot.x,limb.hip.x,.72*tuck);limb.foot.y=mix(limb.foot.y,limb.hip.y+5,.72*tuck);
      limb.knee.x+=stride.x*5*tuck;limb.knee.y-=3*tuck;
      limb.elbow.x=mix(limb.elbow.x,limb.shoulder.x,.5*tuck);limb.elbow.y+=4*tuck;
      limb.hand.x=mix(limb.hand.x,limb.shoulder.x,.58*tuck);limb.hand.y+=6*tuck;
    }
  }
  return{facing,forward,right,stride,phase,moving,running,bob,point,limbs,jumping,rolling,traversing};
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
  for(const face of faces){polygon(ctx,face.points,color);const a=(face.i+.5)*TAU/lower.length,nx=sample.right.x*Math.cos(a)+sample.forward.x*Math.sin(a),ny=sample.right.y*Math.cos(a)+sample.forward.y*Math.sin(a),lit=-nx*.6-ny;polygon(ctx,face.points,lit>0?'#ffebb51a':'#18221838');}
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
  line(ctx,[limb.hip,limb.knee,limb.foot],'#393b31',4.1);
  line(ctx,[limb.hip,limb.knee],limb.depth<0?'#454534':'#656049',3.7);
  const right=sample.right,front=sample.forward,p=limb.foot;
  // Shoes occupy a small oriented rectangle on the ground, not a screen-facing dash.
  polygon(ctx,[[-1.7,-1],[1.7,-1],[2,3.2],[-2,3.2]].map(([l,d])=>({x:p.x+right.x*l+front.x*d,y:p.y+right.y*l+front.y*d-1})), '#59432d','#302d22');
}
function drawHead(ctx,sample){
  const height=32+sample.bob,c=sample.point(0,0,height),front=sample.forward;
  const skin=ctx.createLinearGradient(c.x-5,c.y-6,c.x+5,c.y+5);skin.addColorStop(0,'#e0bd8c');skin.addColorStop(1,'#9c704c');ellipse(ctx,c.x,c.y,5.1,6.3,skin);
  // Project the facial surface around an ellipsoid. Only forward-facing features show.
  ctx.save();ctx.beginPath();ctx.ellipse(c.x,c.y,5.2,6.4,0,0,TAU);ctx.clip();
  const frontAmount=Math.max(0,Math.min(1,front.y*2+.5));
  const faceCenter={x:c.x+front.x*3,y:c.y+front.y*2};
  ellipse(ctx,faceCenter.x,faceCenter.y+1,3.8,5.1,skin);
  // Back hair wraps around the skull; the face opening shifts with yaw without scaling the head.
  const faceNormal=front.y*2;
  const hairCoverage=Math.max(0,Math.min(1,(.35-faceNormal)/.65));
  if(hairCoverage>0){ctx.globalAlpha=hairCoverage;ellipse(ctx,c.x-front.x*2,c.y-1,5.4,6.5,'#504737');ctx.globalAlpha=1;}
  polygon(ctx,[{x:c.x-6.5,y:c.y-2},{x:c.x-5,y:c.y-6},{x:c.x-1,y:c.y-8},{x:c.x+4.5,y:c.y-6.8},{x:c.x+6.7,y:c.y-2.2},{x:c.x+front.x*2+2,y:c.y-3.7},{x:c.x+front.x*2-1,y:c.y-2},{x:c.x-3,y:c.y-3.8}], '#504737');
  if(frontAmount>0){
    ctx.globalAlpha=frontAmount;
    for(const side of [-1,1]){const p=sample.point(side*2.4,5,33+sample.bob);const visible=Math.max(0,Math.min(1,(front.y*.8+side*sample.right.y*.6)*3));ctx.globalAlpha=frontAmount*visible;ellipse(ctx,p.x,p.y,.5,.75,'#34403a');}
    ctx.globalAlpha=frontAmount;const mouth=sample.point(0,5,30+sample.bob);line(ctx,[{x:mouth.x-1,y:mouth.y},{x:mouth.x+1,y:mouth.y}], '#a67754',.7);
  }
  ctx.restore();
  // A small projecting nose keeps the profile readable at exact side-on yaw.
  if(Math.abs(front.x)>.5&&front.y>-.18){const nose=sample.point(0,6,32.5+sample.bob);ellipse(ctx,nose.x,nose.y,1.5,1.3,'#e4bc8e');}
  const ear=sample.point((sample.right.y>=0?1:-1)*5,0,32+sample.bob);ellipse(ctx,ear.x,ear.y,1.4,1.9,'#d8ad7e');
}

function drawRollingFallback(ctx,sample){
  const p=Math.max(0,Math.min(1,finite(sample.rollProgress))),curl=Math.sin(Math.min(1,p/.72)*Math.PI),recover=smooth(Math.max(0,(p-.7)/.3));
  const center={x:sample.forward.x*4*Math.sin(p*Math.PI),y:-11+3*Math.sin(p*Math.PI)};
  const torso={x:center.x,y:mix(center.y,-19,recover)},head={x:center.x+sample.forward.x*mix(7,0,recover),y:mix(center.y-1,-32,recover)};
  line(ctx,[{x:torso.x-6,y:torso.y+2},{x:torso.x+6,y:torso.y+2}],'#393b31',5);
  for(const side of [-1,1]){
    const hip={x:torso.x+side*3,y:torso.y+4},knee={x:torso.x+side*mix(8,3,recover),y:torso.y+mix(8,10,recover)},foot={x:torso.x+side*mix(4,3,recover),y:torso.y+mix(2,18,recover)};
    line(ctx,[hip,knee,foot],'#55513e',4);
    const shoulder={x:torso.x+side*4,y:torso.y-4},hand={x:torso.x+side*mix(2,5,recover),y:torso.y+mix(5,5,recover)};
    line(ctx,[shoulder,hand],sample.color,4.5);
  }
  ellipse(ctx,torso.x,torso.y,6.5,8-curl*2,sample.color);ellipse(ctx,head.x,head.y,5.2,6,'#d2a477');
}

/** Lightweight directional map adventurer; all joints share a projected body basis. */
export function drawMapActor(ctx,map,actor,definition,reduced=false,{shadow=true,art}={}){
  const sample=sampleMapActor(actor,reduced),position=projectMap(map,actor),scale=map.tileSize.width/64;
  sample.rollProgress=actor.rollProgress;
  sample.color=definition?.color||'#68734b';ctx.save();ctx.translate(position.x,position.y);ctx.scale(scale,scale);
  if(shadow){ctx.save();ctx.translate(13,6);ctx.rotate(.35);ellipse(ctx,0,0,20,5,'#19271c3d');ctx.restore();ellipse(ctx,0,1,7,2.5,'#13221b66');}
  ctx.translate(0,-(actor.lift||0)*map.tileSize.height/scale);
  const traversalClip={'vault':'vault','climb-up':'climbUp','climb-down':'climbDown'}[actor.traversalAction];
  const clips=map.art?.actors?.[actor.id],action=traversalClip||(actor.rolling===true?'roll':actor.jumping===true?'jump':sample.moving?(sample.running?'run':'walk'):'idle'),clip=clips?.[action],image=clip&&art?.image(clip.image);
  if(image){
    const spec=map.art.images[clip.image],direction=((Math.round(sample.facing/TAU*clip.directions)%clip.directions)+clip.directions)%clip.directions;
    let progress=traversalClip?actor.traversalProgress:action==='jump'?actor.jumpProgress:action==='roll'?actor.rollProgress:null;
    if(action==='climbDown')progress=1-finite(progress);
    const normalized=progress===null?null:Math.max(0,Math.min(1,finite(progress))),frame=normalized===null?Math.floor(((sample.phase/TAU)%1+1)%1*clip.frames):Math.min(clip.frames-1,Math.floor(normalized*clip.frames));
    let x=-spec.anchorX*spec.width,y=-spec.anchorY*spec.height;
    if(action==='vault'&&actor.supportContact&&clip.supportAnchors?.[direction]&&Array.isArray(clip.supportWindow)){
      const contact=projectMap(map,actor.supportContact),directionAnchors=clip.supportAnchors[direction],anchor=Array.isArray(directionAnchors)?directionAnchors[frame]:directionAnchors,[start,end]=clip.supportWindow,ramp=.08;
      if(anchor){
      const strength=Math.max(0,Math.min(1,(normalized-start)/ramp,(end-normalized)/ramp));
      const desiredX=(contact.x-position.x)/scale,desiredY=(contact.y-position.y+(actor.lift||0)*map.tileSize.height)/scale;
      x+=(desiredX-(x+anchor.x/clip.frameWidth*spec.width))*strength;y+=(desiredY-(y+anchor.y/clip.frameHeight*spec.height))*strength;
      }
    }
    ctx.drawImage(image,frame*clip.frameWidth,direction*clip.frameHeight,clip.frameWidth,clip.frameHeight,x,y,spec.width,spec.height);ctx.restore();return;
  }
  if(actor.rolling===true){drawRollingFallback(ctx,sample);ctx.restore();return;}
  if(traversalClip){
    const p=Math.max(0,Math.min(1,finite(actor.traversalProgress))),effort=Math.sin(p*Math.PI),support=sample.limbs[0];
    if(actor.supportContact){const contact=projectMap(map,actor.supportContact);support.hand={x:(contact.x-position.x)/scale,y:(contact.y-position.y+(actor.lift||0)*map.tileSize.height)/scale};support.elbow={x:mix(support.shoulder.x,support.hand.x,.55),y:mix(support.shoulder.y,support.hand.y,.55)-3*effort};}
    for(const limb of sample.limbs){limb.knee.y-=4*effort;limb.foot.x=mix(limb.foot.x,limb.hip.x,.55*effort);limb.foot.y=mix(limb.foot.y,limb.hip.y+7,.55*effort);}
    if(traversalClip!=='vault'){for(const limb of sample.limbs){limb.hand.x+=sample.forward.x*7*effort;limb.hand.y-=6*effort;}}
  }
  const limbs=[...sample.limbs].sort((a,b)=>a.foot.depth-b.foot.depth);for(const limb of limbs)drawLeg(ctx,sample,limb);
  for(const limb of sample.limbs.filter(limb=>limb.depth<0))drawArm(ctx,sample,limb);
  if(sample.forward.y>=0)drawPack(ctx,sample);
  shell(ctx,sample,{width:5.4,depth:3.6,bottom:12.5+sample.bob,top:26+sample.bob,color:sample.color});
  // Shoulder straps and a leather hip pouch tie the traveler to the woodland palette.
  for(const side of [-1,1])line(ctx,[sample.point(side*3.5,2.7,25+sample.bob),sample.point(side*3,3.7,17+sample.bob)],'#a68a59',1.2);
  const pouch=sample.point(4,2,14+sample.bob);ellipse(ctx,pouch.x,pouch.y,2.3,2.8,'#85633e');
  const belt=ring(sample,5.6,3.7,14+sample.bob);line(ctx,[...belt,belt[0]],'#b99c64',1.2);
  if(sample.forward.y<0)drawPack(ctx,sample);
  for(const limb of sample.limbs.filter(limb=>limb.depth>=0))drawArm(ctx,sample,limb);
  drawHead(ctx,sample);ctx.restore();
}
