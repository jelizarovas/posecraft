import {projectMap} from './map.js';
import {createMapTerrainPainter} from './map-terrain.js';

const CELLS=8,MIB=1024*1024,COLORS=['#65804c','#baa781','#376a71','#c4b78e'];

/** World-space terrain chunks. Camera motion only composites retained surfaces. */
export function createMapTerrainChunks(map,doc,art,fallback){
  const painter=createMapTerrainPainter(map,doc,art),cache=new Map(),descriptors=new Map();
  let pixels=0,maxPixels=4*MIB,rasterScale=1,builds=0,completed=0,pending=false,lastTiles=null,plan=[],planPixels=0,disposed=false;
  function release(entry){pixels-=entry.pixels;entry.canvas.width=entry.canvas.height=1;cache.delete(entry.key);}
  function descriptor(cx,cy){
    const id=`${cx}:${cy}`;if(descriptors.has(id))return descriptors.get(id);
    const x=cx*CELLS,y=cy*CELLS,right=Math.min(map.width,x+CELLS),bottom=Math.min(map.height,y+CELLS),points=[],tiles=[];
    for(let gy=y;gy<=bottom;gy++)for(let gx=x;gx<=right;gx++)points.push(projectMap(map,{x:gx,y:gy}));
    for(let gy=y;gy<bottom;gy++)for(let gx=x;gx<right;gx++)tiles.push({x:gx,y:gy,terrain:map.terrain[gy*map.width+gx]});
    tiles.sort((a,b)=>a.x+a.y-b.x-b.y);
    const left=Math.floor(Math.min(...points.map(p=>p.x)))-2,top=Math.floor(Math.min(...points.map(p=>p.y)))-2;
    const width=Math.ceil(Math.max(...points.map(p=>p.x)))-left+2,height=Math.ceil(Math.max(...points.map(p=>p.y)))-top+2;
    const border=[];for(let gx=x;gx<=right;gx++)border.push(projectMap(map,{x:gx,y}));for(let gy=y+1;gy<=bottom;gy++)border.push(projectMap(map,{x:right,y:gy}));for(let gx=right-1;gx>=x;gx--)border.push(projectMap(map,{x:gx,y:bottom}));for(let gy=bottom-1;gy>y;gy--)border.push(projectMap(map,{x,y:gy}));
    const result={id,x,y,left,top,width,height,tiles,border,depth:projectMap(map,{x:right,y:bottom}).y};descriptors.set(id,result);return result;
  }
  function flat(ctx,tile){const points=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>projectMap(map,{x:tile.x+x,y:tile.y+y}));ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=COLORS[tile.terrain];ctx.fill();}
  function configure(tiles,scale,viewportPixels){
    const budget=Math.max(4*MIB,Math.min(12*MIB,Math.max(0,viewportPixels)*5));
    if(lastTiles===tiles&&maxPixels===budget&&plan.requestedScale===scale)return;
    const hadPlan=lastTiles!==null,previousScale=rasterScale;
    lastTiles=tiles;maxPixels=budget;const wanted=new Map();
    for(const tile of tiles){const cx=Math.floor(tile.x/CELLS),cy=Math.floor(tile.y/CELLS),id=`${cx}:${cy}`;if(!wanted.has(id))wanted.set(id,descriptor(cx,cy));}
    const list=[...wanted.values()].sort((a,b)=>a.depth-b.depth);
    // Fit the entire visible working set before allocating. LRU alone would
    // repeatedly discard chunks that the same viewport needs next frame.
    const cost=s=>list.reduce((sum,d)=>sum+Math.max(1,Math.ceil(d.width*s))*Math.max(1,Math.ceil(d.height*s)),0);
    rasterScale=scale>1.25?2:1;while(cost(rasterScale)>maxPixels&&rasterScale>1/64)rasterScale/=2;
    // Avoid rebuilding every visible chunk when a small camera move makes a
    // higher resolution only barely fit. Upgrade once there is real headroom.
    if(hadPlan&&rasterScale>previousScale&&cost(rasterScale)>maxPixels*.65)rasterScale=previousScale;
    plan=list.map(d=>({...d,key:`${d.id}@${rasterScale}`}));plan.requestedScale=scale;planPixels=cost(rasterScale);
    const pinned=new Set(plan.map(d=>d.key));
    const newPixels=plan.filter(d=>!cache.has(d.key)).reduce((sum,d)=>sum+Math.ceil(d.width*rasterScale)*Math.ceil(d.height*rasterScale),0);
    for(const entry of [...cache.values()])if(!pinned.has(entry.key)&&pixels+newPixels>maxPixels)release(entry);
    // Drop old zoom surfaces immediately when the new budget becomes smaller.
    for(const entry of [...cache.values()])if(pixels>maxPixels&&!pinned.has(entry.key))release(entry);
  }
  function preview(ctx,d){ctx.beginPath();d.border.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=COLORS[0];ctx.fill();}
  function allocate(d){
    const canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.ceil(d.width*rasterScale));canvas.height=Math.max(1,Math.ceil(d.height*rasterScale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.setTransform(rasterScale,0,0,rasterScale,-d.left*rasterScale,-d.top*rasterScale);
    // An inexpensive ground preview remains visible while this chunk is built.
    for(const tile of d.tiles)flat(ctx,tile);
    const entry={...d,canvas,ctx,cursor:0,pixels:canvas.width*canvas.height};cache.set(d.key,entry);pixels+=entry.pixels;builds++;return entry;
  }
  return{
    draw(ctx,tiles,{scale=1,viewportPixels=0}={}){
      if(disposed)return false;configure(tiles,scale,viewportPixels);painter.beginFrame(rasterScale,Math.min(viewportPixels,2*MIB));
      const started=performance.now();pending=false;
      for(const d of plan){
        let entry=cache.get(d.key);if(!entry){if(performance.now()-started>=6){preview(ctx,d);pending=true;continue;}entry=allocate(d);}else{cache.delete(d.key);cache.set(d.key,entry);}
        while(entry.cursor<entry.tiles.length){
          if(performance.now()-started>=6){pending=true;break;}
          const tile=entry.tiles[entry.cursor],result=painter.drawReady(entry.ctx,tile);
          if(result===null){pending=true;break;}
          if(result===false){if(fallback)fallback(entry.ctx,tile);else flat(entry.ctx,tile);}
          entry.cursor++;if(entry.cursor===entry.tiles.length)completed++;
        }
        if(entry.cursor<entry.tiles.length)pending=true;
        ctx.drawImage(entry.canvas,d.left,d.top,d.width,d.height);
      }
      return true;
    },
    stats(){const inner=painter.stats();return{tiles:cache.size,chunks:cache.size,pixels,materials:inner.materials,builds,completed,pending,maxPixels,rasterScale,tilePixels:inner.pixels,tileBuilds:inner.builds,visibleChunks:plan.length,workingSetPixels:planPixels};},
    clear(){for(const entry of [...cache.values()])release(entry);descriptors.clear();plan=[];lastTiles=null;planPixels=0;pending=false;painter.clear();},
    dispose(){if(disposed)return;this.clear();painter.dispose();disposed=true;}
  };
}
