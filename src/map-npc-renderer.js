import {projectMap} from './map.js';
import {sampleMapActor} from './map-character.js';
import {getAuthenticCast, resolveAuthenticAction} from './map-cast.js';

const TAU=Math.PI*2;
const paletteCache=new Map();
const variantCache=new Map();
const variantLimit=128;
let imageIds=new WeakMap(),nextImageId=1;
const palettes={
  berry:['#8f4355','#d79872','#5a3439'],moss:['#526847','#c9976f','#354232'],
  ochre:['#aa7139','#d5a079','#684425'],river:['#3e6980','#b97f5d','#294656'],
  plum:['#74506f','#deb18a','#493449'],clay:['#9b5741','#c98762','#5b342b'],
  sky:['#4d83a3','#e0ad82','#315468'],sun:['#c18738','#b97855','#745024']
};
const feedingActions=new Set(['eat','graze','drink','peck','hay']);
const socialActions=new Set(['social','look','react','intimidate']);
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function styleFor(appearance){
  const palette=typeof appearance.palette==='string'?appearance.palette:'moss',key=palette+':'+(appearance.skin??'');
  if(paletteCache.has(key))return paletteCache.get(key);
  const source=palettes[palette]||[palette,'#d3a078','#493b34'],style={cloth:source[0],skin:appearance.skin||source[1],dark:source[2]};
  if(paletteCache.size>=16)paletteCache.delete(paletteCache.keys().next().value);
  paletteCache.set(key,style);return style;
}
function makeCanvas(width,height){if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}return null;}
function spriteVariant(image,clip,frame,direction,style){
  let imageId=imageIds.get(image);if(!imageId){imageId=nextImageId++;imageIds.set(image,imageId);}const key=[imageId,clip.image,clip.frameWidth,clip.frameHeight,frame,direction,style.cloth,style.skin].join(':');if(variantCache.has(key)){const value=variantCache.get(key);variantCache.delete(key);variantCache.set(key,value);return value;}
  const canvas=makeCanvas(clip.frameWidth,clip.frameHeight);if(!canvas)return null;const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,frame*clip.frameWidth,direction*clip.frameHeight,clip.frameWidth,clip.frameHeight,0,0,clip.frameWidth,clip.frameHeight);
  try{
    const data=context.getImageData(0,0,clip.frameWidth,clip.frameHeight),pixels=data.data,cloth=parseColor(style.cloth),skin=parseColor(style.skin);
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<12)continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],light=(Math.max(r,g,b)+Math.min(r,g,b))/510;
      // Stock adventurer clothing is green/neutral; warm exposed pixels remain skin.
      const warm=r>g*1.08&&g>b*1.08&&r>75,target=warm?skin:cloth,amount=warm?.7:.58;
      pixels[i]=r*(1-amount)+target[0]*(.3+.7*light)*amount;pixels[i+1]=g*(1-amount)+target[1]*(.3+.7*light)*amount;pixels[i+2]=b*(1-amount)+target[2]*(.3+.7*light)*amount;
    }context.putImageData(data,0,0);
  }catch{return null;}
  if(variantCache.size>=variantLimit){const oldest=variantCache.keys().next().value;const old=variantCache.get(oldest);if(old){old.width=old.height=1;}variantCache.delete(oldest);}variantCache.set(key,canvas);return canvas;
}
function parseColor(color){const value=/^#([\da-f]{6})$/i.exec(color);return value?[0,2,4].map(i=>parseInt(value[1].slice(i,i+2),16)):[100,115,80];}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,a,b,color,width){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function actionOf(actor,presentation){return presentation?.action||actor.presentation?.action||'idle';}

function drawShadow(ctx,width,alpha=.22){ctx.save();ctx.scale(1,.32);ellipse(ctx,0,3,width,width*.32,`rgba(20,31,23,${alpha})`);ctx.restore();}

function drawAnimal(ctx,map,actor,appearance,reduced,options){
  const spec=map.art?.images?.[appearance.image],image=spec&&options.art?.image(appearance.image);
  if(!spec||!image)return true;
  const position=projectMap(map,actor),base=map.tileSize.width/64,scale=base*finite(appearance.scale,1);
  const presentation=options.presentation||actor.presentation||{},action=actionOf(actor,presentation),moving=!!actor.walking&&!reduced;
  const phase=Number.isFinite(presentation.time)?presentation.time*4.2:finite(actor.phase),gait=moving?Math.sin(phase*2):0,peck=Math.max(0,Math.sin(phase*1.35));
  const feeding=feedingActions.has(action),social=socialActions.has(action);
  const dip=feeding?(appearance.image==='farm-chicken'?peck:0.5+0.5*Math.sin(phase*.7)):0;
  const flip=Math.cos(finite(actor.facing))<0?-1:1;
  ctx.save();ctx.translate(position.x,position.y);if(options.shadow!==false)drawShadow(ctx,spec.width*scale*.34);
  ctx.translate(0,-finite(actor.lift)*map.tileSize.height-(moving?Math.abs(gait)*1.2:0));
  ctx.scale(flip*scale*(1+(moving?Math.abs(gait)*.018:0)),scale*(1-(moving?Math.abs(gait)*.015:0)));
  ctx.rotate((moving?gait*.018:0)+(social?Math.sin(phase*.45)*.035:0));
  const x=-spec.anchorX*spec.width,y=-spec.anchorY*spec.height;
  if(dip){
    // The body stays planted while the front third bows toward grass or water.
    // Source livestock heads are on the left. Transform that quarter locally;
    // the enclosing negative scale mirrors the finished pose when facing right.
    const split=spec.width*.34,sourceSplit=image.naturalWidth*split/spec.width;
    ctx.save();ctx.translate(x+split,y+spec.height*.68);ctx.rotate(-dip*.18);ctx.translate(-(x+split),-(y+spec.height*.68));
    ctx.drawImage(image,0,0,sourceSplit,image.naturalHeight,x,y,split,spec.height);ctx.restore();
    ctx.drawImage(image,sourceSplit,0,image.naturalWidth-sourceSplit,image.naturalHeight,x+split,y,spec.width-split,spec.height);
  }else ctx.drawImage(image,x,y,spec.width,spec.height);
  if(action==='react'||action==='intimidate'){const side=flip;ctx.fillStyle='#f5e5a9';ctx.font='bold 13px system-ui';ctx.fillText('!',side*spec.width*.32,-spec.height*.78);}
  ctx.restore();return true;
}

function drawHat(ctx,sample,hat,style,kid){
  if(!hat||hat==='none')return;const head=sample.point(0,0,32+sample.bob),s=kid?.86:1,contact=head.y-1.1*s;
  if(hat==='straw'){
    ellipse(ctx,head.x,contact,4.8*s,1.05*s,'#d3ad57');
    polygon(ctx,[{x:head.x-3*s,y:contact-.4*s},{x:head.x-2.1*s,y:contact-3.6*s},{x:head.x+2.1*s,y:contact-3.6*s},{x:head.x+3*s,y:contact-.4*s}],'#c4973e','#7d6632');
  }else if(hat==='cap'){
    ctx.beginPath();ctx.arc(head.x,contact,3.25*s,Math.PI,TAU);ctx.closePath();ctx.fillStyle=style.cloth;ctx.fill();
    const brimStart={x:head.x+sample.forward.x*1.8*s,y:contact},brimEnd={x:head.x+sample.forward.x*4.8*s,y:contact+.4*s};line(ctx,brimStart,brimEnd,style.dark,1.25*s);
  }else{
    ctx.beginPath();ctx.arc(head.x,contact+2.1*s,3.65*s,Math.PI*.92,TAU*1.04);ctx.lineTo(head.x+2.8*s,contact+3.6*s);ctx.lineTo(head.x-2.8*s,contact+3.6*s);ctx.closePath();ctx.fillStyle=style.cloth;ctx.fill();
  }
}
function drawVillagerSprite(ctx,map,actor,reduced,art,style,shadow){
  const sample=sampleMapActor(actor,reduced),clips=map.art?.actors?.[actor.id],action=actor.rolling?'roll':actor.jumping?'jump':sample.moving?(sample.running?'run':'walk'):'idle',clip=clips?.[action],image=clip&&art?.image(clip.image),spec=clip&&map.art.images[clip.image];if(!image||!spec)return false;
  const position=projectMap(map,actor),scale=map.tileSize.width/64,direction=((Math.round(sample.facing/TAU*clip.directions)%clip.directions)+clip.directions)%clip.directions,progress=action==='jump'?actor.jumpProgress:action==='roll'?actor.rollProgress:null,frame=progress==null?Math.floor((((sample.phase/TAU)%1)+1)%1*clip.frames):Math.min(clip.frames-1,Math.floor(clamp(finite(progress),0,1)*clip.frames)),variant=spriteVariant(image,clip,frame,direction,style);
  ctx.save();ctx.translate(position.x,position.y);ctx.scale(scale,scale);if(shadow!==false)drawShadow(ctx,18);ctx.translate(0,-finite(actor.lift)*map.tileSize.height/scale);ctx.drawImage(variant||image,...(variant?[0,0,clip.frameWidth,clip.frameHeight]:[frame*clip.frameWidth,direction*clip.frameHeight,clip.frameWidth,clip.frameHeight]),-spec.anchorX*spec.width,-spec.anchorY*spec.height,spec.width,spec.height);ctx.restore();return true;
}
function drawWheelbarrow(ctx,sample,style){
  const wheel=sample.point(0,17,2),nearLeft=sample.point(-8,4,4),nearRight=sample.point(8,4,4),farLeft=sample.point(-6,13,8),farRight=sample.point(6,13,8);
  // Two handles terminate at the actor's hands; the tub reads as a wooden
  // farm implement regardless of the villager's clothing palette.
  line(ctx,sample.limbs[0].hand,nearLeft,'#68452b',1.8);line(ctx,sample.limbs[1].hand,nearRight,'#68452b',1.8);
  polygon(ctx,[nearLeft,nearRight,farRight,farLeft],'#94683d','#4f3826');
  line(ctx,nearLeft,farLeft,'#c18b50',1);line(ctx,nearRight,farRight,'#5b3e28',1);
  line(ctx,sample.point(-5,10,3),wheel,'#68452b',1.7);line(ctx,sample.point(5,10,3),wheel,'#68452b',1.7);
  ellipse(ctx,wheel.x,wheel.y,3.6,3.6,'#31352f');ellipse(ctx,wheel.x,wheel.y,1.25,1.25,'#ad7a43');
  const produce=[[-3,8,10,'#d87f27'],[0,10,11,'#789244'],[3,8,10,'#d99a32'],[1,6,11,'#b9632d']];
  for(const[lateral,depth,height,color]of produce){const p=sample.point(lateral,depth,height);ellipse(ctx,p.x,p.y,1.35,1.45,color);}
}
function drawHoe(ctx,sample,time=0){const hand=sample.limbs[1].hand,swing=Math.sin(time*5)*5,tip=sample.point(4,18+swing,Math.max(0,swing));line(ctx,hand,tip,'#755333',2);line(ctx,{x:tip.x-4,y:tip.y+1},{x:tip.x+4,y:tip.y-1},'#454b43',2.5);}
function drawBall(ctx,sample,presentation){const cycle=(Math.sin(finite(presentation?.time,sample.phase)*3.2)+1)/2,t=finite(presentation?.progress,cycle),p=sample.point(8+(t-.5)*8,8,3+Math.sin(t*Math.PI)*12);ellipse(ctx,p.x,p.y,4.1,4.1,'#d96843');ctx.strokeStyle='#f0c86a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,TAU);ctx.stroke();}
function drawSharedBall(ctx,map,actor,presentation){const ball=presentation?.ball;if(!ball?.from||!ball?.to||(ball.ownerId&&ball.ownerId!==actor.id))return false;const start=Number.isFinite(ball.startTime)?ball.startTime:0,duration=Math.max(.01,finite(ball.duration,Number.isFinite(ball.endTime)?ball.endTime-start:1)),elapsed=Number.isFinite(ball.startTime)?finite(presentation.time)-start:finite(presentation.age),t=clamp(Number.isFinite(ball.progress)?ball.progress:elapsed/duration,0,1),from=projectMap(map,ball.from),to=projectMap(map,ball.to),x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t-Math.sin(t*Math.PI)*map.tileSize.height*.85,r=map.tileSize.width/64*4;ellipse(ctx,x,y,r,r,'#d96843');ctx.strokeStyle='#f0c86a';ctx.lineWidth=Math.max(1,r*.22);ctx.beginPath();ctx.arc(x,y,r*.62,0,TAU);ctx.stroke();return true;}
function drawBasket(ctx,sample,style){const p=sample.limbs[1].hand;polygon(ctx,[{x:p.x-5,y:p.y},{x:p.x+5,y:p.y},{x:p.x+4,y:p.y+6},{x:p.x-4,y:p.y+6}],'#a8783f','#5d4228');ctx.beginPath();ctx.arc(p.x,p.y,5,Math.PI,TAU);ctx.strokeStyle=style.dark;ctx.lineWidth=1.3;ctx.stroke();}
function drawSocial(ctx,sample,time){const hand=sample.limbs[1].hand,raise={x:hand.x+Math.sin(time*6)*2,y:hand.y-9};line(ctx,hand,raise,'#d5a17a',3);}
function rasterSample(source){const map=p=>({x:p.x,y:p.y*1.48,depth:p.depth}),point=(...args)=>map(source.point(...args));return{...source,point,limbs:source.limbs.map(limb=>({...limb,hand:map(limb.hand),elbow:map(limb.elbow),shoulder:map(limb.shoulder)}))};}

function drawVillager(ctx,map,actor,definition,reduced,options){
  const appearance=definition.appearance,style=styleFor(appearance),position=projectMap(map,actor),mapScale=map.tileSize.width/64,bodyScale=finite(appearance.scale,1);
  ctx.save();ctx.translate(position.x,position.y);ctx.scale(bodyScale,bodyScale);ctx.translate(-position.x,-position.y);
  const custom=drawVillagerSprite(ctx,map,actor,reduced,options.art,style,options.shadow);if(!custom&&typeof options.drawBase==='function')options.drawBase(ctx,map,actor,definition,reduced,{shadow:options.shadow,art:options.art});ctx.restore();if(!custom&&typeof options.drawBase!=='function')return false;
  const sample=rasterSample(sampleMapActor(actor,reduced)),presentation=options.presentation||actor.presentation||{},carrying=presentation.carrying||presentation.tool;
  ctx.save();ctx.translate(position.x,position.y-finite(actor.lift)*map.tileSize.height);ctx.scale(mapScale*bodyScale,mapScale*bodyScale);
  drawHat(ctx,sample,appearance.hat,style,bodyScale<.9);
  if(carrying==='wheelbarrow'||actionOf(actor,presentation)==='harvest')drawWheelbarrow(ctx,sample,style);
  const action=actionOf(actor,presentation),time=finite(presentation.time);
  if(carrying==='farmhoe'||carrying==='hoe'||action==='hoe'||action==='till')drawHoe(ctx,sample,time);
  if(carrying==='ball'&&!presentation.ball)drawBall(ctx,sample,presentation);
  if(carrying==='basket'||carrying==='produce')drawBasket(ctx,sample,style);
  if(action==='social'||action==='wave')drawSocial(ctx,sample,time);
  ctx.restore();drawSharedBall(ctx,map,actor,presentation);return true;
}

const authenticImages = new Map();
function getAuthenticImage(dir, action, art) {
  const key = `${dir}/${action}`;
  if (art?.image) {
    const fromArt = art.image(key) || art.image(`${dir}-${action}`);
    if (fromArt) return fromArt;
  }
  if (authenticImages.has(key)) return authenticImages.get(key);
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = `./assets/map/${dir}/${action}-page-00.webp`;
  img.onerror = () => {
    if (img.src.endsWith('.webp')) {
      img.src = `./assets/map/${dir}/${action}-page-00.png`;
    }
  };
  authenticImages.set(key, img);
  return img;
}

function drawAuthenticActor(ctx, map, actor, definition, authentic, reduced, options) {
  const presentation = options.presentation || actor.presentation || {};
  const moving = !!actor.walking && !reduced;
  const rawAction = actionOf(actor, presentation);
  const actionClip = resolveAuthenticAction(authentic, rawAction, moving);
  if (!actionClip) return false;

  const image = getAuthenticImage(authentic.dir, actionClip.name, options.art);
  if (!image || !image.complete || !image.naturalWidth) {
    // If authentic image is still decoding or unavailable, return false to let fallback draw
    return false;
  }

  const sample = sampleMapActor(actor, reduced);
  const position = projectMap(map, actor);
  const mapScale = map.tileSize.width / 64;
  // Pip and other cast members are modeled and baked at genuine metric scale (no runtime downscale)
  const scale = mapScale;
  const spec = authentic.spec;

  const direction = ((Math.round(sample.facing / TAU * actionClip.directions) % actionClip.directions) + actionClip.directions) % actionClip.directions;
  let frame = 0;
  if (moving) {
    frame = Math.floor((((sample.phase / TAU) % 1) + 1) % 1 * actionClip.frames);
  } else {
    const time = finite(presentation.time, sample.phase / 2);
    const duration = actionClip.duration || 1.6;
    const progress = (time % duration) / duration;
    frame = Math.floor(progress * actionClip.frames) % actionClip.frames;
  }
  frame = clamp(frame, 0, actionClip.frames - 1);

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.scale(scale, scale);

  if (options.shadow !== false) {
    if (authentic.species === 'human' || authentic.species === 'child') {
      drawShadow(ctx, 18);
    } else {
      drawShadow(ctx, spec.width * 0.34);
    }
  }

  ctx.translate(0, -finite(actor.lift) * map.tileSize.height / scale);

  const sx = frame * authentic.frameWidth;
  const sy = direction * authentic.frameHeight;
  const sw = authentic.frameWidth;
  const sh = authentic.frameHeight;
  const dx = -spec.anchorX * spec.width;
  const dy = -spec.anchorY * spec.height;
  const dw = spec.width;
  const dh = spec.height;

  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();

  if (authentic.id === 'npc-child-1') {
    drawSharedBall(ctx, map, actor, presentation);
  }

  return true;
}

/** Draw a specialized town NPC. Returns false when the normal actor renderer should handle it. */
export function drawMapNpc(ctx,map,actor,definition,reduced=false,{shadow=true,art,presentation,drawBase}={}){
  const appearance=definition?.appearance;if(!appearance)return false;
  const authentic = getAuthenticCast(actor.id, definition);
  if (authentic) {
    const drawn = drawAuthenticActor(ctx, map, actor, definition, authentic, reduced, {shadow, art, presentation});
    if (drawn) return true;
  }
  if(appearance.kind==='livestock')return drawAnimal(ctx,map,actor,appearance,reduced,{shadow,art,presentation});
  if(appearance.kind==='villager')return drawVillager(ctx,map,actor,definition,reduced,{shadow,art,presentation,drawBase});
  return false;
}

/** Conservative screen-space local bounds around the actor anchor, for occlusion scratch canvases. */
export function npcActorBounds(map,actor,definition,presentation){
  const appearance=definition?.appearance;if(!appearance)return null;
  const authentic = getAuthenticCast(actor.id, definition);
  const scale = map.tileSize.width / 64 * (authentic ? 1 : finite(appearance.scale, 1));
  const spec = authentic ? authentic.spec : (appearance.kind==='livestock'&&map.art?.images?.[appearance.image]);
  const isHuman = authentic ? (authentic.species === 'human' || authentic.species === 'child') : appearance.kind === 'villager';
  const width = (spec?.width || 64) * scale, height = (spec?.height || 56) * scale, extra = isHuman ? 18 * scale : 5 * scale;
  const p=projectMap(map,actor),lift=finite(actor.lift)*map.tileSize.height;
  let bounds={x:p.x-width*.62-extra,y:p.y-lift-height-extra,width:width*1.24+extra*2,height:height+extra*1.5+lift};
  const ball=presentation?.ball;if(ball?.from&&ball?.to&&(!ball.ownerId||ball.ownerId===actor.id)){
    const a=projectMap(map,ball.from),b=projectMap(map,ball.to),radius=map.tileSize.width/64*5,arc=map.tileSize.height*.85+radius,left=Math.min(bounds.x,a.x-radius,b.x-radius),top=Math.min(bounds.y,a.y-arc,b.y-arc),right=Math.max(bounds.x+bounds.width,a.x+radius,b.x+radius),bottom=Math.max(bounds.y+bounds.height,a.y+radius,b.y+radius);bounds={x:left,y:top,width:right-left,height:bottom-top};
  }
  return bounds;
}

/** Clears the small shared style cache; useful for long-lived hot-reload hosts. */
export function disposeMapNpcRenderer(){paletteCache.clear();for(const canvas of variantCache.values())canvas.width=canvas.height=1;variantCache.clear();imageIds=new WeakMap();nextImageId=1;authenticImages.clear();}

export function mapNpcRendererStats(){return{paletteStyles:paletteCache.size,paletteStyleLimit:16,spriteVariants:variantCache.size,spriteVariantLimit:variantLimit,authenticImages:authenticImages.size};}
