import {projectMap} from './map.js';
import {artPropSelection,mapImageBounds} from './map-art-layout.js';
import {drawMapFenceShadow,isMapFence,mapFenceBounds} from './map-fence.js';

// A shared sun direction for all scenery. Raster alpha is flattened onto the
// ground once while building scenery chunks, never filtered each frame.
export function mapPropShadowGeometry(map,prop){
 if(isMapFence(prop)){const art=mapFenceBounds(map,prop),pad=14*map.tileSize.width/64;return{fence:true,bounds:{x:art.x,y:art.y,width:art.width+pad,height:art.height+pad/2}};}
 const scale=map.tileSize.width/64,base=projectMap(map,{x:prop.x+prop.width/2,y:prop.y+prop.height/2});
 const selected=artPropSelection(map,prop);
 const cover=prop.occlusion?.mode;
 if(cover==='ground'||cover==='low-foliage')return null;
 const image=selected?mapImageBounds(map,{x:prop.x+prop.width/2,y:prop.y+prop.height/2},selected.image):{x:base.x-24*scale,y:base.y-48*scale,width:48*scale,height:50*scale};
 const transform={a:1,b:0,c:-.65,d:-.32,e:.65*base.y,f:1.32*base.y};
 const points=[[image.x,image.y],[image.x+image.width,image.y],[image.x,image.y+image.height],[image.x+image.width,image.y+image.height]].map(([x,y])=>({x:x-.65*y+transform.e,y:-.32*y+transform.f}));
 const contactX=prop.kind==='tree'?9*scale:Math.max(7*scale,(prop.width+prop.height)*map.tileSize.width*.16);
 const contactY=prop.kind==='tree'?3.5*scale:Math.max(3*scale,(prop.width+prop.height)*map.tileSize.height*.14);
 const left=Math.min(base.x-contactX,...points.map(p=>p.x)),top=Math.min(base.y-contactY,...points.map(p=>p.y));
 const right=Math.max(base.x+contactX,...points.map(p=>p.x)),bottom=Math.max(base.y+contactY,...points.map(p=>p.y));
 return{base,image,transform,contactX,contactY,bounds:{x:left,y:top,width:right-left,height:bottom-top}};
}

const stamps=new WeakMap();
export function drawMapPropShadow(ctx,map,prop,art){
 if(prop.cliffFace)return;
 const geometry=mapPropShadowGeometry(map,prop);if(!geometry)return;
 if(geometry.fence){drawMapFenceShadow(ctx,map,prop);return;}
 const selected=artPropSelection(map,prop),source=selected&&art?.image(selected.id);
 const {base,image,transform:t,contactX,contactY}=geometry;
 ctx.save();
 if(source){
  let stamp=stamps.get(source);
  if(!stamp){
   stamp=ctx.canvas.ownerDocument.createElement('canvas');const ratio=Math.min(1,256/Math.max(source.width,source.height));
   stamp.width=Math.max(1,Math.round(source.width*ratio));stamp.height=Math.max(1,Math.round(source.height*ratio));
   const c=stamp.getContext('2d');c.drawImage(source,0,0,stamp.width,stamp.height);c.globalCompositeOperation='source-in';c.fillStyle='#243025';c.fillRect(0,0,stamp.width,stamp.height);stamps.set(source,stamp);
  }
  ctx.save();ctx.globalAlpha=.26;ctx.transform(t.a,t.b,t.c,t.d,t.e,t.f);ctx.drawImage(stamp,image.x,image.y,image.width,image.height);ctx.restore();
 }
 ctx.fillStyle='#18281c40';ctx.beginPath();ctx.ellipse(base.x,base.y+1,contactX,contactY,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
