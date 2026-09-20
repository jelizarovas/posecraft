import {createMapTerrainPainter} from './map-terrain.js';
import {terrainTileCorners,terrainHeightOffset} from './map-cliffs.js';
import {projectMap} from './map.js';
import {artTerrainSelection} from './map-art-layout.js';

// Compile reusable flat materials and immutable world geometry separately.
// Camera scale never participates in either cache key. Elevation is geometry,
// so neither zoom nor hills require a new projected raster image.
export function createMapGpuTerrain(map,doc,art,{onUpdate}={}){
  const painter=createMapTerrainPainter(map,doc,art,{materialLimit:2048}),tiles=new Map(),chunks=new Map(),previews=new Map(),scheduler=doc.defaultView||globalThis;
  const colors=['#65804c','#baa781','#376a71','#c4b78e'],flat=colors.map(color=>{const c=doc.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return c;});
  let plan=[],handle=0,disposed=false,builds=0,workSlices=0,buildMs=0,pending=false,clock=0;
  function entry(tile){const id=tile.y*map.width+tile.x;let e=tiles.get(id);if(!e){
    const points=terrainTileCorners(map,tile.x,tile.y).map(p=>projectMap(map,p));let shade=0;
    if(map.elevations){const stride=map.width+1,i=tile.y*stride+tile.x,h=map.elevations,dx=(h[i+1]+h[i+stride+1]-h[i]-h[i+stride])/2,dy=(h[i+stride]+h[i+stride+1]-h[i]-h[i+1])/2;shade=Math.max(-.22,Math.min(.22,(dx+dy)*.5));}
    e={tile,points,image:null,shade,level:terrainHeightOffset(map,{x:tile.x+.5,y:tile.y+.5}),used:clock};tiles.set(id,e);
  }e.used=clock;return e;}
  const ready=e=>e.image&&e.image.width>1;
  function preview(e){const selected=artTerrainSelection(map,e.tile.terrain,e.tile.y*map.width+e.tile.x),source=art.image(selected?.id);if(!source)return flat[e.tile.terrain];if(previews.has(source))return previews.get(source);const c=doc.createElement('canvas');c.width=c.height=56;c.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0,56,56);previews.set(source,c);return c;}
  function work(){handle=0;if(disposed)return;const started=performance.now();let progressed=false;painter.beginFrame(1);for(const e of plan){if(ready(e)||e.untextured)continue;if(performance.now()-started>=3)break;const image=painter.prepareMaterial(e.tile);if(image){e.image=image;builds++;progressed=true;}else if(!painter.stats().pending){e.untextured=true;progressed=true;}}
    workSlices++;buildMs+=performance.now()-started;pending=plan.some(e=>!ready(e)&&!e.untextured);if(progressed)onUpdate?.();if(pending)schedule();
  }
  function schedule(){if(!handle&&!disposed&&pending)handle=scheduler.setTimeout(work,0);}
  return{
    draw(gpu,visible,{view}={}){
      clock++;plan=[];const wanted=new Map();
      for(const tile of visible){const e=entry(tile),p=e.points;if(view&&(Math.max(...p.map(v=>v.x))<view.x||Math.min(...p.map(v=>v.x))>view.x+view.width||Math.max(...p.map(v=>v.y))<view.y||Math.min(...p.map(v=>v.y))>view.y+view.height))continue;
        const x=Math.floor(tile.x/8)*8,y=Math.floor(tile.y/8)*8,key=`${x}:${y}:${e.level}`;if(wanted.has(key))continue;let chunk=chunks.get(key);
        if(!chunk){const entries=[];for(let gy=y;gy<Math.min(y+8,map.height);gy++)for(let gx=x;gx<Math.min(x+8,map.width);gx++){const candidate=entry({x:gx,y:gy,terrain:map.terrain[gy*map.width+gx]});if(candidate.level===e.level)entries.push(candidate);}
          chunk={x,y,level:e.level,entries,images:null,items:null};chunks.set(key,chunk);
        }chunk.used=clock;wanted.set(key,chunk);
      }
      for(const chunk of [...wanted.values()].sort((a,b)=>a.level-b.level||a.x+a.y-b.x-b.y)){
        plan.push(...chunk.entries);const images=chunk.entries.map(e=>ready(e)?e.image:preview(e));
        if(!chunk.images||images.some((image,i)=>image!==chunk.images[i])){
          chunk.images=images;chunk.items=chunk.entries.map((e,i)=>{const shade=e.shade,tint=shade<0?[1+shade*.92,1+shade*.84,1+shade*.87,1]:[1+shade*.12,1+shade*.08,1,1];return{image:images[i],points:e.points,inset:ready(e)?4/e.image.width:0,tint};});
        }gpu.drawQuads(chunk.items);
      }
      pending=plan.some(e=>!ready(e)&&!e.untextured);schedule();
      // Retain nearby geometry across camera reversals, with a fixed upper cap.
      if(tiles.size>12000){for(const [key,chunk]of chunks)if(chunk.used<clock){chunks.delete(key);for(const e of chunk.entries)tiles.delete(e.tile.y*map.width+e.tile.x);if(tiles.size<=10000)break;}}
    },
    stats(){const s=painter.stats();return{tiles:tiles.size,chunks:tiles.size,pixels:s.materials*56*56,materials:s.materials,builds,completed:builds,pending,maxPixels:2048*56*56,rasterScale:1,tilePixels:0,tileBuilds:builds,visibleChunks:plan.length,workingSetPixels:plan.length*56*56,workSlices,buildMs,staging:0,swaps:builds,resamples:0,previewBuilds:0};},
    clear(){if(handle)scheduler.clearTimeout(handle);handle=0;tiles.clear();chunks.clear();for(const c of previews.values())c.width=c.height=1;previews.clear();plan=[];pending=false;painter.clear();},
    dispose(){if(disposed)return;disposed=true;this.clear();painter.dispose();for(const c of flat)c.width=c.height=1;}
  };
}
