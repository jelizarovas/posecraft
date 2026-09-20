import {projectMap} from './map.js';
import {cliffFaces,terrainTileCorners} from './map-cliffs.js';
import {createCliffTopProps,mapPropArtBounds} from './map-depth.js';
import {groundHeight} from './map-art-layout.js';

const patterns=new WeakMap();
const sceneryTopMasks=new WeakMap();
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const polygon=(ctx,points)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
export function cliffSceneryMasks(map,prop){
 let cache=sceneryTopMasks.get(map);if(!cache){cache=new Map();sceneryTopMasks.set(map,cache);}
 if(cache.has(prop))return cache.get(prop);
 const position={x:prop.x+prop.width/2,y:prop.y+prop.height/2},height=groundHeight(map,position),bounds=mapPropArtBounds(map,prop);
 const masks=createCliffTopProps(map).filter(top=>top.cliffHeight>height+.05&&position.x+position.y<top.x+top.y+1&&overlaps(top.cliffBounds,bounds));
 cache.set(prop,masks);return masks;
}
export function clipCliffScenery(ctx,masks){
 for(const top of masks){ctx.beginPath();ctx.rect(-100000,-100000,200000,200000);top.cliffPoints.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip('evenodd');}
}
export function cliffDrawProps(map){
 return cliffFaces(map).filter(face=>face.edge==='east'||face.edge==='south').map(face=>{
  const points=[...face.top,...[...face.bottom].reverse()].map(p=>projectMap(map,p));
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  const bounds={x:x-2,y:y-2,width:Math.max(...points.map(p=>p.x))-x+4,height:Math.max(...points.map(p=>p.y))-y+4};
  return{id:`@cliff-${face.x}-${face.y}-${face.edge}`,kind:'decoration',x:face.x,y:face.y,width:1,height:1,cliffFace:face,cliffPoints:points,cliffBounds:bounds};
 });
}
export function drawCliffFace(ctx,map,prop,art){
 const p=prop.cliffPoints,b=prop.cliffBounds,scale=map.tileSize.width/64;
 ctx.save();polygon(ctx,p);ctx.clip();
 const image=art?.image('cliff-rock');let pattern=image&&patterns.get(ctx);
 if(image&&!pattern){pattern=ctx.createPattern(image,'repeat');pattern.setTransform({a:224*scale/image.naturalWidth,d:224*scale/image.naturalHeight,b:0,c:0,e:0,f:0});patterns.set(ctx,pattern);}
 ctx.fillStyle=pattern||'#777866';ctx.fillRect(b.x,b.y,b.width,b.height);
 ctx.fillStyle=prop.cliffFace.edge==='east'?'#20322c38':'#e9c89215';ctx.fillRect(b.x,b.y,b.width,b.height);
 const gradient=ctx.createLinearGradient(0,b.y,0,b.y+b.height);gradient.addColorStop(0,'#18251950');gradient.addColorStop(.12,'#18251900');gradient.addColorStop(1,'#18251940');ctx.fillStyle=gradient;ctx.fillRect(b.x,b.y,b.width,b.height);
 ctx.restore();
 // An uneven moss lip joins the cliff face to the textured ground above.
 ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);
 for(let i=12;i>=0;i--){const t=i/12;ctx.lineTo(p[0].x+(p[1].x-p[0].x)*t,p[0].y+(p[1].y-p[0].y)*t+(1.6+Math.sin(i*7+prop.x*3+prop.y)*1.1)*scale);}
 ctx.closePath();ctx.fillStyle='#53623e';ctx.fill();
}

/** Animated water uses visible tile/face geometry only; no offscreen simulation. */
export function drawCliffWater(ctx,map,props,rect,time,{reduced=false,art}={}){
 let visible=0;const scale=map.tileSize.width/64,t=reduced?0:time;
 for(const prop of props){
  const f=prop.cliffFace;
  if(map.terrain[f.y*map.width+f.x]!==2||!overlaps(prop.cliffBounds,rect))continue;
  visible++;const p=prop.cliffPoints;
  ctx.save();polygon(ctx,p);ctx.clip();ctx.fillStyle='#578f9bd9';ctx.fill();
  const image=art?.image(map.art?.terrain?.water),b=prop.cliffBounds;
  if(image){const span=80*scale,offset=t*70*scale%span;ctx.globalAlpha=.66;for(let y=b.y-span+offset;y<b.y+b.height;y+=span)ctx.drawImage(image,b.x,y,b.width,span);ctx.globalAlpha=1;}
  const glow=ctx.createLinearGradient(b.x,0,b.x+b.width,0);glow.addColorStop(0,'#e5faff12');glow.addColorStop(.5,'#d9f5f75a');glow.addColorStop(1,'#e5faff12');ctx.fillStyle=glow;ctx.fillRect(b.x,b.y,b.width,b.height);
  for(let i=0;i<16;i++){
   const u=(i+.5)/16,x=p[0].x+(p[1].x-p[0].x)*u,top=p[0].y+(p[1].y-p[0].y)*u,bottom=p[3].y+(p[2].y-p[3].y)*u;
   const fall=bottom-top,phase=(t*1.5+i*.173)%1,y=top+phase*fall;
   ctx.strokeStyle=i%3?'#d3edf730':'#f4fbff60';ctx.lineWidth=(i%3?.6:1.2)*scale;
   ctx.beginPath();ctx.moveTo(x,Math.max(top,y-fall*.16));ctx.quadraticCurveTo(x+Math.sin(i+t*3)*scale,y,x+Math.sin(i+t)*scale,Math.min(bottom,y+fall*.12));ctx.stroke();
  }
  ctx.restore();
  for(let i=0;i<12;i++){const u=(i+.5)/12,x=p[3].x+(p[2].x-p[3].x)*u,y=p[3].y+(p[2].y-p[3].y)*u,phase=(t*.8+i*.313)%1;
   ctx.beginPath();ctx.ellipse(x+Math.sin(i*8)*phase*5*scale,y+phase*4*scale,(1+phase*3)*scale,(.5+phase)*scale,0,0,Math.PI*2);ctx.fillStyle=`rgba(224,242,235,${(1-phase)*.42})`;ctx.fill();}
 }
 return visible;
}

export function drawRiverWater(ctx,map,tiles,rect,time,{reduced=false}={}){
 let visible=0;const s=map.tileSize.width/64,t=reduced?0:time;
 for(const tile of tiles){
  if(tile.terrain!==2)continue;
  const p=terrainTileCorners(map,tile.x,tile.y).map(p=>projectMap(map,p));
  const bounds={x:Math.min(...p.map(p=>p.x)),y:Math.min(...p.map(p=>p.y)),width:map.tileSize.width,height:map.tileSize.height+2};
  if(!overlaps(bounds,rect))continue;visible++;
  ctx.save();polygon(ctx,p);ctx.clip();ctx.lineWidth=.8*s;
  for(let i=0;i<2;i++){
   const u=(t*.24+tile.x*.371+tile.y*.183+i*.5)%1,v=(tile.x*.127+tile.y*.281+i*.43)%1;
   const a={x:p[0].x+(p[1].x-p[0].x)*u+(p[3].x-p[0].x)*v,y:p[0].y+(p[1].y-p[0].y)*u+(p[3].y-p[0].y)*v};
   ctx.strokeStyle=`rgba(202,237,237,${.12+Math.sin(u*Math.PI)*.12})`;ctx.beginPath();ctx.moveTo(a.x-3*s,a.y);ctx.quadraticCurveTo(a.x,a.y+s,a.x+4*s,a.y);ctx.stroke();
  }ctx.restore();
 }return visible;
}
