import {terrainTileCorners} from './map-cliffs.js';
import {projectMap} from './map.js';
import {artTerrainSelection} from './map-art-layout.js';
import {createMapTerrainMasks} from './map-terrain-masks.js';

const PAD=4;
/** Bounded, lazy material and projected-tile caches. Never rasterize the entire map. */
export function createMapTerrainPainter(map,doc,art){
  let SIZE=48;const materials=new Map(),tiles=new Map();let pixels=0,builds=0,pending=false,spent=0,rasterScale=1,maxPixels=4*1024*1024;
  const layer=doc.createElement('canvas'),masks=createMapTerrainMasks(doc);layer.width=layer.height=SIZE;
  // Software-backed intermediate surfaces avoid repeated small GPU uploads
  // during texture construction. Removing this hint regressed frame pacing.
  const layerCtx=layer.getContext('2d',{willReadFrequently:true});
  const evict=()=>{while(pixels>maxPixels&&tiles.size){const first=tiles.keys().next().value,old=tiles.get(first);pixels-=old.pixels;old.surface.width=old.surface.height=1;tiles.delete(first);}};
  const clamped=(x,y)=>({x:Math.max(0,Math.min(map.width-1,x)),y:Math.max(0,Math.min(map.height-1,y))});
  const value=(x,y)=>{const p=clamped(x,y);return map.terrain[p.y*map.width+p.x];};
  const paint=(x,y)=>{const p=clamped(x,y);return map.groundPaint?.[p.y*map.width+p.x]??null;};
  const material=(tile)=>{
    const neighbors=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)neighbors.push(value(tile.x+x,tile.y+y));
    const painted=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)painted.push(paint(tile.x+x,tile.y+y));
    // World phase is preserved for arbitrary authored repeat sizes.
    const selections=[0,1,2,3].map(t=>artTerrainSelection(map,t));
    const effective=artTerrainSelection(map,tile.terrain,tile.y*map.width+tile.x);
    if(!effective||!art.image(effective.id))return null;
    const needed=new Set([0,...neighbors]);const phase=selections.map((s,i)=>s&&needed.has(i)?[tile.x%(s.image.width/64),tile.y%(s.image.height/64)]:[]);
    const paintPhase=[...new Set(painted.filter(Boolean))].sort().map(id=>{const image=map.art.images[id];return[id,tile.x%(image.width/64),tile.y%(image.height/64)];});
    const key=JSON.stringify([SIZE,neighbors,phase,painted,paintPhase]);
    if(materials.has(key)){const result=materials.get(key);materials.delete(key);materials.set(key,result);return result;}
    if(spent>=6){pending=true;return null;}
    const started=performance.now(),output=doc.createElement('canvas');output.width=output.height=SIZE;const ctx=output.getContext('2d',{willReadFrequently:true});
    function texture(c,id){c.save();c.scale(SIZE,SIZE);c.translate(-tile.x,-tile.y);c.fillStyle=art.pattern(c,id);c.fillRect(tile.x,tile.y,1,1);c.restore();}
    const base=selections[0]&&art.image(selections[0].id)?selections[0]:selections[tile.terrain]&&art.image(selections[tile.terrain].id)?selections[tile.terrain]:effective;texture(ctx,base.id);
    for(const kind of [3,2,1]){
      const selected=selections[kind],belongs=v=>kind===3?v===2||v===3:v===kind;
      if(!selected||!art.image(selected.id)||!neighbors.some(belongs))continue;
      if(neighbors.every(belongs)){texture(ctx,selected.id);continue;}
      layerCtx.clearRect(0,0,SIZE,SIZE);texture(layerCtx,selected.id);
      const membership=neighbors.reduce((bits,value,i)=>bits|(belongs(value)?1<<i:0),0);
      layerCtx.globalCompositeOperation='destination-in';layerCtx.drawImage(masks.get(SIZE,membership),0,0);layerCtx.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0);
    }
    // Sparse visual paint is a second ground layer. It never changes terrain
    // cost or collision, and only blends across cells with the same base kind.
    const variants=[...new Set(painted.filter(Boolean))].sort();
    for(const id of variants){
      if(!art.image(id))continue;
      const membership=painted.reduce((bits,value,i)=>bits|(value===id&&neighbors[i]===tile.terrain?1<<i:0),0);
      if(!membership)continue;
      layerCtx.clearRect(0,0,SIZE,SIZE);texture(layerCtx,id);
      layerCtx.globalCompositeOperation='destination-in';layerCtx.drawImage(masks.get(SIZE,membership),0,0);layerCtx.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0);
    }
    if(tile.terrain===1){
      // Continuous cart ruts follow road edges, not the orientation of a texture.
      // Each edge lane carries one wheel track; junctions remain unmarked.
      const horizontal=neighbors[3]===1&&neighbors[5]===1&&(neighbors[1]!==1||neighbors[7]!==1);
      const vertical=neighbors[1]===1&&neighbors[7]===1&&(neighbors[3]!==1||neighbors[5]!==1);
      if(horizontal!==vertical){
        ctx.save();if(vertical){ctx.translate(SIZE,0);ctx.rotate(Math.PI/2);}
        const edge=horizontal?(neighbors[1]!==1):(neighbors[5]!==1),y=SIZE*(edge?.67:.33);
        ctx.strokeStyle='#49382745';ctx.lineWidth=SIZE*.035;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(SIZE,y);ctx.stroke();
        ctx.strokeStyle='#f0d5a02b';ctx.lineWidth=SIZE*.015;ctx.beginPath();ctx.moveTo(0,y+SIZE*.035);ctx.lineTo(SIZE,y+SIZE*.035);ctx.stroke();ctx.restore();
      }
    }
    // Extrude actual edge texels. Stretching the material changes its coordinate
    // phase and leaves partially transparent samples along projected joins.
    const padded=doc.createElement('canvas');padded.width=padded.height=SIZE+PAD*2;const edge=padded.getContext('2d',{willReadFrequently:true});
    edge.drawImage(output,PAD,PAD);
    edge.drawImage(output,0,0,SIZE,1,PAD,0,SIZE,PAD);edge.drawImage(output,0,SIZE-1,SIZE,1,PAD,SIZE+PAD,SIZE,PAD);
    edge.drawImage(output,0,0,1,SIZE,0,PAD,PAD,SIZE);edge.drawImage(output,SIZE-1,0,1,SIZE,SIZE+PAD,PAD,PAD,SIZE);
    for(const x of [0,1])for(const y of [0,1])edge.drawImage(output,x*(SIZE-1),y*(SIZE-1),1,1,x*(SIZE+PAD),y*(SIZE+PAD),PAD,PAD);
    output.width=output.height=1;padded.materialKey=key;materials.set(key,padded);
    if(materials.size>256){const first=materials.keys().next().value,old=materials.get(first);old.width=old.height=1;materials.delete(first);}
    spent+=performance.now()-started;return padded;
  };
  function triangle(ctx,image,p0,p1,p2,first){
    const points=[p0,p1,p2],sign=Math.sign((p1.x-p0.x)*(p2.y-p0.y)-(p1.y-p0.y)*(p2.x-p0.x))||1;
    const edges=points.map((p,i)=>{const q=points[(i+1)%3],dx=q.x-p.x,dy=q.y-p.y,n=Math.hypot(dx,dy);return{x:p.x+sign*dy/n,y:p.y-sign*dx/n,dx,dy};});
    // Offset each edge by one world pixel and intersect its neighboring lines.
    const expanded=edges.map((b,i)=>{const a=edges[(i+2)%3],cross=a.dx*b.dy-a.dy*b.dx,t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/cross;return{x:a.x+t*a.dx,y:a.y+t*a.dy};});
    ctx.save();ctx.beginPath();expanded.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
    if(first)ctx.transform((p1.x-p0.x)/SIZE,(p1.y-p0.y)/SIZE,(p2.x-p1.x)/SIZE,(p2.y-p1.y)/SIZE,p0.x,p0.y);
    else ctx.transform((p1.x-p2.x)/SIZE,(p1.y-p2.y)/SIZE,(p2.x-p0.x)/SIZE,(p2.y-p0.y)/SIZE,p0.x,p0.y);
    ctx.drawImage(image,-PAD,-PAD);ctx.restore();
  }
  return{
    beginFrame(scale=1,viewportPixels=0){const size=scale>2.5?96:48;if(size!==SIZE){SIZE=size;layer.width=layer.height=SIZE;}spent=0;pending=false;rasterScale=scale>2.5?4:scale>1.25?2:1;maxPixels=Math.max(4*1024*1024,Math.min(8*1024*1024,viewportPixels*2));evict();},
    drawReady(ctx,tile,{direct=false}={}){
      const image=material(tile);if(!image){
        return pending?null:false;
      }
      const corners=terrainTileCorners(map,tile.x,tile.y),origin=projectMap(map,corners[0]);
      const points=corners.map(corner=>{const p=projectMap(map,corner);return{x:p.x-origin.x,y:p.y-origin.y};});
      if(direct){
        // The caller already retains a terrain chunk. Avoid allocating another
        // projected canvas for every distinct hill slope inside that chunk.
        const started=performance.now();ctx.save();ctx.translate(origin.x,origin.y);
        triangle(ctx,image,points[0],points[1],points[2],true);triangle(ctx,image,points[0],points[2],points[3],false);
        if(map.elevations){
          const stride=map.width+1,i=tile.y*stride+tile.x,h=map.elevations,dx=(h[i+1]+h[i+stride+1]-h[i]-h[i+stride])/2,dy=(h[i+stride]+h[i+stride+1]-h[i]-h[i+1])/2;
          const shade=Math.max(-.22,Math.min(.22,(dx+dy)*.5));
          ctx.beginPath();points.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=shade>0?`rgba(255,244,200,${shade})`:`rgba(20,42,34,${-shade})`;ctx.fill();
        }
        ctx.restore();spent+=performance.now()-started;builds++;return true;
      }
      const key=image.materialKey+':'+rasterScale+':'+points.map(p=>(Math.round(p.y*32)/32).toFixed(5)).join(',');let cached=tiles.get(key);
      if(cached){tiles.delete(key);tiles.set(key,cached);}
      else{
        if(spent>=6){pending=true;return null;}
        const started=performance.now();
        const left=Math.floor(Math.min(...points.map(p=>p.x)))-1,top=Math.floor(Math.min(...points.map(p=>p.y)))-1;
        const width=Math.ceil(Math.max(...points.map(p=>p.x)))-left+1,height=Math.ceil(Math.max(...points.map(p=>p.y)))-top+1;
        const surface=doc.createElement('canvas');surface.width=width*rasterScale;surface.height=height*rasterScale;const c=surface.getContext('2d',{willReadFrequently:true});c.scale(rasterScale,rasterScale);c.translate(-left,-top);
        triangle(c,image,points[0],points[1],points[2],true);triangle(c,image,points[0],points[2],points[3],false);
        if(map.elevations){
          const stride=map.width+1,i=tile.y*stride+tile.x,h=map.elevations,dx=(h[i+1]+h[i+stride+1]-h[i]-h[i+stride])/2,dy=(h[i+stride]+h[i+stride+1]-h[i]-h[i+1])/2;
          const shade=Math.max(-.22,Math.min(.22,(dx+dy)*.5));
          c.globalCompositeOperation='source-atop';c.fillStyle=shade>0?`rgba(255,244,200,${shade})`:`rgba(20,42,34,${-shade})`;c.fillRect(left,top,width,height);
        }
        cached={surface,left,top,width,height,pixels:surface.width*surface.height};tiles.set(key,cached);pixels+=cached.pixels;builds++;
        spent+=performance.now()-started;
        evict();
      }
      ctx.drawImage(cached.surface,origin.x+cached.left,origin.y+cached.top,cached.width,cached.height);return true;
    },
    draw(ctx,tile){const result=this.drawReady(ctx,tile);if(result!==null)return result;const points=terrainTileCorners(map,tile.x,tile.y).map(p=>projectMap(map,p));ctx.save();ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=['#65804c','#baa781','#376a71','#c4b78e'][tile.terrain];ctx.fill();ctx.restore();return true;},
    clear(){for(const t of tiles.values())t.surface.width=t.surface.height=1;for(const image of materials.values())image.width=image.height=1;tiles.clear();materials.clear();masks.clear();pixels=0;},
    stats(){return{tiles:tiles.size,pixels,materials:materials.size,builds,pending,maxPixels,rasterScale,...masks.stats()};},
    dispose(){this.clear();layer.width=layer.height=1;}
  };
}
