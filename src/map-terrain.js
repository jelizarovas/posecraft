import {terrainTileCorners} from './map-cliffs.js';
import {projectMap} from './map.js';
import {artTerrainSelection} from './map-art-layout.js';
import {createMapTerrainMasks} from './map-terrain-masks.js';

const PAD=4;
const smooth=v=>{v=v<0?0:v>1?1:v;return v*v*(3-2*v);};
const SHADE_COLORS=Array.from({length:45},(_,i)=>{
  const s=(i-22)/100;
  return s>0?`rgba(255,244,200,${s.toFixed(2)})`:s<0?`rgba(20,42,34,${(-s).toFixed(2)})`:'';
});

/** Bounded, lazy material and projected-tile caches. Never rasterize the entire map. */
export function createMapTerrainPainter(map,doc,art,{materialLimit=256}={}){
  let SIZE=48;const materials=new Map(),tiles=new Map();let pixels=0,builds=0,pending=false,spent=0,rasterScale=1,maxPixels=4*1024*1024;
  const layer=doc.createElement('canvas'),output=doc.createElement('canvas'),paddedScratch=doc.createElement('canvas'),masks=createMapTerrainMasks(doc,256);layer.width=layer.height=output.width=output.height=SIZE;paddedScratch.width=paddedScratch.height=SIZE+PAD*2;
  // Software-backed intermediate surfaces avoid repeated small GPU uploads
  // during texture construction. Removing this hint regressed frame pacing.
  const layerCtx=layer.getContext('2d',{willReadFrequently:true}),outputCtx=output.getContext('2d',{willReadFrequently:true}),paddedScratchCtx=paddedScratch.getContext('2d',{willReadFrequently:true});
  const selections=[0,1,2,3].map(t=>artTerrainSelection(map,t));
  const repeatW=selections.map(s=>s?s.image.width/64:1),repeatH=selections.map(s=>s?s.image.height/64:1);
  const terrainNames=['grass','road','water','sand'];
  const uniformKind=[0,1,2,3].map(k=>typeof map.art?.terrain?.[terrainNames[k]]==='string'&&Number.isInteger(repeatW[k])&&Number.isInteger(repeatH[k])&&repeatW[k]>0&&repeatH[k]>0);
  const hasPaint=!!map.groundPaint,w=map.width,h=map.height,terrain=map.terrain,groundPaint=map.groundPaint;
  const halfW=map.tileSize.width/2,halfH=map.tileSize.height/2,th=map.tileSize.height,elev=map.elevations,stride=w+1;
  const evict=()=>{while(pixels>maxPixels&&tiles.size){const first=tiles.keys().next().value,old=tiles.get(first);pixels-=old.pixels;old.surface.width=old.surface.height=1;tiles.delete(first);}};
  const neighbors=new Array(9),painted=new Array(9);

  // Fast-path resources for direct chunk painting: 4 wrapped GPU terrain sheets
  // (pure tiles) + a batched software-to-GPU transition atlas (border/painted tiles).
  // This path re-implements `material()` blending in software. Any change to
  // terrain blending, paint or shading must keep both paths in agreement;
  // `npm run test:map-terrain-parity` compares them on woodland art.
  let fastSize=0,sheets=[null,null,null,null],swPixels=[null,null,null,null];
  const paintPixels=new Map();
  let swAtlas=null,swAtlasCtx=null,swAtlasImg=null,gpuAtlas=null,gpuAtlasCtx=null;
  let atlasCols=0,atlasSlots=0,maskOffsets=null,maskWeights=null;
  const transMap=new Map(),batchChunks=[],batchSlots=[];
  function clearFast(){
    for(let k=0;k<4;k++){if(sheets[k]){sheets[k].canvas.width=sheets[k].canvas.height=1;sheets[k]=null;}swPixels[k]=null;}
    paintPixels.clear();
    if(swAtlas){swAtlas.width=swAtlas.height=1;swAtlas=swAtlasCtx=swAtlasImg=null;}
    if(gpuAtlas){gpuAtlas.width=gpuAtlas.height=1;gpuAtlas=gpuAtlasCtx=null;}
    transMap.clear();atlasSlots=0;atlasCols=0;fastSize=0;maskOffsets=null;maskWeights=null;
  }
  function ensureFast(){
    if(fastSize===SIZE&&maskOffsets)return;
    clearFast();fastSize=SIZE;
    maskOffsets=new Int8Array(SIZE);maskWeights=new Float32Array(SIZE);
    for(let i=0;i<SIZE;i++){const g=(i+.5)/SIZE-.5,cell=Math.floor(g);maskOffsets[i]=cell;maskWeights[i]=smooth((g-cell-.30)/.40);}
    const cell=SIZE+PAD*2;
    atlasCols=Math.max(8,Math.floor(1024/cell));
    swAtlas=doc.createElement('canvas');swAtlas.width=swAtlas.height=atlasCols*cell;
    swAtlasCtx=swAtlas.getContext('2d',{willReadFrequently:true});
    swAtlasImg=swAtlasCtx.createImageData(swAtlas.width,swAtlas.height);
    gpuAtlas=doc.createElement('canvas');gpuAtlas.width=gpuAtlas.height=atlasCols*cell;
    gpuAtlasCtx=gpuAtlas.getContext('2d');
  }
  function ensureSheet(k){
    if(sheets[k])return sheets[k];
    if(!uniformKind[k]||!selections[k])return null;
    const img=art.image(selections[k].id);if(!img||!img.naturalWidth||!img.naturalHeight)return null;
    const rx=repeatW[k],ry=repeatH[k],sw=rx*SIZE,sh=ry*SIZE;
    const tmp=doc.createElement('canvas');tmp.width=sw;tmp.height=sh;
    const tctx=tmp.getContext('2d',{willReadFrequently:true});
    tctx.drawImage(img,0,0,sw,sh);
    swPixels[k]={data:tctx.getImageData(0,0,sw,sh).data,w:sw,rx,ry};
    const gc=doc.createElement('canvas');gc.width=sw+PAD*2;gc.height=sh+PAD*2;
    const gctx=gc.getContext('2d');
    for(let oy=-sh;oy<=sh;oy+=sh)for(let ox=-sw;ox<=sw;ox+=sw)gctx.drawImage(tmp,ox+PAD,oy+PAD);
    tmp.width=tmp.height=1;
    sheets[k]={canvas:gc,rx,ry};
    return sheets[k];
  }
  function ensurePaint(id){
    if(paintPixels.has(id))return paintPixels.get(id);
    const img=art.image(id),spec=map.art?.images?.[id];
    if(!img||!spec||!img.naturalWidth||!img.naturalHeight)return null;
    const rx=spec.width/64,ry=spec.height/64;
    if(!Number.isInteger(rx)||!Number.isInteger(ry)||rx<=0||ry<=0)return null;
    const sw=rx*SIZE,sh=ry*SIZE,tmp=doc.createElement('canvas');tmp.width=sw;tmp.height=sh;
    const tctx=tmp.getContext('2d',{willReadFrequently:true});
    tctx.drawImage(img,0,0,sw,sh);
    const entry={data:tctx.getImageData(0,0,sw,sh).data,w:sw,rx,ry};
    tmp.width=tmp.height=1;
    paintPixels.set(id,entry);
    return entry;
  }
  function blendLayer(dst,aw,ax,ay,src,tx,ty,membership,respectSrcAlpha){
    const sData=src.data,sw=src.w,sx0=(((tx%src.rx)+src.rx)%src.rx)*SIZE,sy0=(((ty%src.ry)+src.ry)%src.ry)*SIZE;
    if(membership===511&&!respectSrcAlpha){
      for(let y=0;y<SIZE;y++){
        let dOff=((ay+PAD+y)*aw+(ax+PAD))*4,sOff=((sy0+y)*sw+sx0)*4;
        for(let x=0;x<SIZE;x++,dOff+=4,sOff+=4){dst[dOff]=sData[sOff];dst[dOff+1]=sData[sOff+1];dst[dOff+2]=sData[sOff+2];dst[dOff+3]=255;}
      }
      return;
    }
    const b0=membership&1,b1=(membership>>1)&1,b2=(membership>>2)&1,b3=(membership>>3)&1,b4=(membership>>4)&1,b5=(membership>>5)&1,b6=(membership>>6)&1,b7=(membership>>7)&1,b8=(membership>>8)&1;
    for(let y=0;y<SIZE;y++){
      const oy=maskOffsets[y]+1,sy=maskWeights[y];
      const r0a=oy===0?b0:oy===1?b3:b6,r0b=oy===0?b1:oy===1?b4:b7,r0c=oy===0?b2:oy===1?b5:b8;
      const r1a=oy===0?b3:b6,r1b=oy===0?b4:b7,r1c=oy===0?b5:b8;
      let dOff=((ay+PAD+y)*aw+(ax+PAD))*4,sOff=((sy0+y)*sw+sx0)*4;
      for(let x=0;x<SIZE;x++,dOff+=4,sOff+=4){
        const ox=maskOffsets[x]+1,sx=maskWeights[x];
        const v00=ox===0?r0a:r0b,v10=ox===0?r0b:r0c,v01=ox===0?r1a:r1b,v11=ox===0?r1b:r1c;
        let a=(v00*(1-sx)+v10*sx)*(1-sy)+(v01*(1-sx)+v11*sx)*sy;
        if(respectSrcAlpha)a*=sData[sOff+3]/255;
        if(a<=0)continue;
        if(a>=1){dst[dOff]=sData[sOff];dst[dOff+1]=sData[sOff+1];dst[dOff+2]=sData[sOff+2];}
        else{const ia=1-a;dst[dOff]=dst[dOff]*ia+sData[sOff]*a+.5;dst[dOff+1]=dst[dOff+1]*ia+sData[sOff+1]*a+.5;dst[dOff+2]=dst[dOff+2]*ia+sData[sOff+2]*a+.5;}
      }
    }
  }
  function blendTransitionIntoAtlas(ax,ay,tx,ty,tv,nBits,paintIds){
    const cell=SIZE+PAD*2,aw=swAtlas.width,dst=swAtlasImg.data;
    const baseKind=swPixels[0]?0:tv,baseSrc=swPixels[baseKind];
    if(!baseSrc)return false;
    const bData=baseSrc.data,bw=baseSrc.w,bx0=(tx%baseSrc.rx)*SIZE,by0=(ty%baseSrc.ry)*SIZE;
    for(let y=0;y<SIZE;y++){
      let dOff=((ay+PAD+y)*aw+(ax+PAD))*4,sOff=((by0+y)*bw+bx0)*4;
      for(let x=0;x<SIZE;x++,dOff+=4,sOff+=4){
        dst[dOff]=bData[sOff];dst[dOff+1]=bData[sOff+1];dst[dOff+2]=bData[sOff+2];dst[dOff+3]=255;
      }
    }
    for(let ki=0;ki<3;ki++){
      const kind=ki===0?3:ki===1?2:1;
      if(kind===3?!(nBits&12):!(nBits&(1<<kind)))continue;
      const src=swPixels[kind];if(!src)continue;
      let membership=0;
      for(let i=0;i<9;i++){const v=neighbors[i];if(kind===3?(v===2||v===3):v===kind)membership|=1<<i;}
      if(membership)blendLayer(dst,aw,ax,ay,src,tx,ty,membership,false);
    }
    if(paintIds){
      for(let pi=0;pi<paintIds.length;pi++){
        const id=paintIds[pi],src=ensurePaint(id);if(!src)continue;
        let membership=0;
        for(let i=0;i<9;i++)if(painted[i]===id&&neighbors[i]===tv)membership|=1<<i;
        if(membership)blendLayer(dst,aw,ax,ay,src,tx,ty,membership,true);
      }
    }
    if(tv===1){
      const horizontal=neighbors[3]===1&&neighbors[5]===1&&(neighbors[1]!==1||neighbors[7]!==1);
      const vertical=neighbors[1]===1&&neighbors[7]===1&&(neighbors[3]!==1||neighbors[5]!==1);
      if(horizontal!==vertical){
        const edge=horizontal?(neighbors[1]!==1):(neighbors[5]!==1);
        const pos=Math.round(SIZE*(edge?.67:.33));
        const darkW=Math.max(1,Math.round(SIZE*.035));
        const blendLine=(coord,r,g,b,alpha)=>{
          if(coord<0||coord>=SIZE)return;
          const ia=1-alpha;
          for(let i=0;i<SIZE;i++){
            const px=vertical?SIZE-1-coord:i,py=vertical?i:coord;
            const dOff=((ay+PAD+py)*aw+(ax+PAD+px))*4;
            dst[dOff]=dst[dOff]*ia+r*alpha+.5;dst[dOff+1]=dst[dOff+1]*ia+g*alpha+.5;dst[dOff+2]=dst[dOff+2]*ia+b*alpha+.5;
          }
        };
        for(let w0=0;w0<darkW;w0++)blendLine(pos+w0-Math.floor(darkW/2),0x49,0x38,0x27,0x45/255);
        blendLine(pos+darkW,0xf0,0xd5,0xa0,0x2b/255);
      }
    }
    // Extrude edge texels into the PAD border so projected tile joins stay seamless.
    for(let y=0;y<SIZE;y++){
      const rowOff=((ay+PAD+y)*aw)*4;
      const lOff=rowOff+(ax+PAD)*4,rOff=rowOff+(ax+PAD+SIZE-1)*4;
      for(let p=0;p<PAD;p++){
        const lo=rowOff+(ax+p)*4,ro=rowOff+(ax+PAD+SIZE+p)*4;
        dst[lo]=dst[lOff];dst[lo+1]=dst[lOff+1];dst[lo+2]=dst[lOff+2];dst[lo+3]=255;
        dst[ro]=dst[rOff];dst[ro+1]=dst[rOff+1];dst[ro+2]=dst[rOff+2];dst[ro+3]=255;
      }
    }
    const topSrc=(ay+PAD)*aw*4+ax*4,botSrc=(ay+PAD+SIZE-1)*aw*4+ax*4,rowBytes=cell*4;
    for(let p=0;p<PAD;p++){
      dst.copyWithin((ay+p)*aw*4+ax*4,topSrc,topSrc+rowBytes);
      dst.copyWithin((ay+PAD+SIZE+p)*aw*4+ax*4,botSrc,botSrc+rowBytes);
    }
    return true;
  }

  const material=(tile,reuseScratch=false)=>{
    const tx=tile.x,ty=tile.y,effective=artTerrainSelection(map,tile.terrain,ty*w+tx);
    if(!effective||!art.image(effective.id))return null;
    let nBits=1,allSame=true,nKey='',pKey='',hasAnyPaint=false;
    for(let dy=-1,i=0;dy<=1;dy++){
      const ny=ty+dy<0?0:ty+dy>=h?h-1:ty+dy,row=ny*w;
      for(let dx=-1;dx<=1;dx++,i++){
        const nx=tx+dx<0?0:tx+dx>=w?w-1:tx+dx,v=terrain[row+nx];
        neighbors[i]=v;nBits|=1<<v;if(v!==tile.terrain)allSame=false;nKey+=v;
        const pv=hasPaint?(groundPaint[row+nx]??null):null;
        painted[i]=pv;if(pv){hasAnyPaint=true;pKey+=i+':'+pv+',';}
      }
    }
    let key=SIZE+'|'+nKey+'|';
    for(let i=0;i<4;i++)if(selections[i]&&(nBits&(1<<i)))key+=(tx%repeatW[i])+','+(ty%repeatH[i])+';';
    if(hasAnyPaint){
      const variants=[...new Set(painted.filter(Boolean))].sort();
      key+='|'+pKey+'|';
      for(const id of variants){const image=map.art.images[id];key+=id+':'+(tx%(image.width/64))+','+(ty%(image.height/64))+';';}
    }
    if(materials.has(key)){const result=materials.get(key);materials.delete(key);materials.set(key,result);return result;}
    if(spent>=6){pending=true;return null;}
    const started=performance.now(),ctx=outputCtx;ctx.clearRect(0,0,SIZE,SIZE);
    function texture(c,id){
      const img=art.image(id),spec=map.art?.images?.[id];
      if(img&&spec&&img.naturalWidth&&img.naturalHeight){
        const rx=spec.width/64,ry=spec.height/64;
        if(Number.isInteger(rx)&&Number.isInteger(ry)&&rx>0&&ry>0){
          const sw=img.naturalWidth/rx,sh=img.naturalHeight/ry;
          c.drawImage(img,(((tx%rx)+rx)%rx)*sw,(((ty%ry)+ry)%ry)*sh,sw,sh,0,0,SIZE,SIZE);return;
        }
      }
      c.save();c.scale(SIZE,SIZE);c.translate(-tx,-ty);c.fillStyle=art.pattern(c,id);c.fillRect(tx,ty,1,1);c.restore();
    }
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
    const cacheable=!reuseScratch||(allSame&&!hasAnyPaint);
    const padded=cacheable?doc.createElement('canvas'):paddedScratch;
    if(cacheable)padded.width=padded.height=SIZE+PAD*2;
    const edge=cacheable?padded.getContext('2d',{willReadFrequently:true}):paddedScratchCtx;
    edge.drawImage(output,PAD,PAD);
    edge.drawImage(output,0,0,SIZE,1,PAD,0,SIZE,PAD);edge.drawImage(output,0,SIZE-1,SIZE,1,PAD,SIZE+PAD,SIZE,PAD);
    edge.drawImage(output,0,0,1,SIZE,0,PAD,PAD,SIZE);edge.drawImage(output,SIZE-1,0,1,SIZE,SIZE+PAD,PAD,PAD,SIZE);
    for(const x of [0,1])for(const y of [0,1])edge.drawImage(output,x*(SIZE-1),y*(SIZE-1),1,1,x*(SIZE+PAD),y*(SIZE+PAD),PAD,PAD);
    padded.materialKey=key;
    if(cacheable){
      materials.set(key,padded);
      if(materials.size>materialLimit){const first=materials.keys().next().value,old=materials.get(first);old.width=old.height=1;materials.delete(first);}
    }
    spent+=performance.now()-started;return padded;
  };
  function triangle(ctx,image,p0,p1,p2,first,sx=0,sy=0){
    const points=[p0,p1,p2],sign=Math.sign((p1.x-p0.x)*(p2.y-p0.y)-(p1.y-p0.y)*(p2.x-p0.x))||1;
    const edges=points.map((p,i)=>{const q=points[(i+1)%3],dx=q.x-p.x,dy=q.y-p.y,n=Math.hypot(dx,dy);return{x:p.x+sign*dy/n,y:p.y-sign*dx/n,dx,dy};});
    // Offset each edge by one world pixel and intersect its neighboring lines.
    const expanded=edges.map((b,i)=>{const a=edges[(i+2)%3],cross=a.dx*b.dy-a.dy*b.dx,t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/cross;return{x:a.x+t*a.dx,y:a.y+t*a.dy};});
    const cell=SIZE+PAD*2;
    ctx.save();ctx.beginPath();expanded.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
    if(first)ctx.transform((p1.x-p0.x)/SIZE,(p1.y-p0.y)/SIZE,(p2.x-p1.x)/SIZE,(p2.y-p1.y)/SIZE,p0.x,p0.y);
    else ctx.transform((p1.x-p2.x)/SIZE,(p1.y-p2.y)/SIZE,(p2.x-p0.x)/SIZE,(p2.y-p0.y)/SIZE,p0.x,p0.y);
    if(sx||sy)ctx.drawImage(image,sx,sy,cell,cell,-PAD,-PAD,cell,cell);
    else ctx.drawImage(image,-PAD,-PAD);
    ctx.restore();
  }
  return{
    // Share compiled materials with GPU terrain, which projects its own geometry.
    prepareMaterial:material,
    beginFrame(scale=1,viewportPixels=0){const size=scale>2.5?96:scale>.55?48:24;if(size!==SIZE){SIZE=size;layer.width=layer.height=output.width=output.height=SIZE;paddedScratch.width=paddedScratch.height=SIZE+PAD*2;}spent=0;pending=false;rasterScale=scale>2.5?4:scale>1.25?2:1;maxPixels=Math.max(4*1024*1024,Math.min(8*1024*1024,viewportPixels*2));evict();},
    drawChunks(entries,budgetMs,started,fallback,terraceOffsets){
      if(!entries.length)return;
      ensureFast();
      const cell=SIZE+PAD*2,maxSlots=atlasCols*atlasCols;
      let dirtyMinY=Infinity,dirtyMaxY=0,slotTotal=0,atlasFull=false;
      batchChunks.length=0;batchSlots.length=0;
      // Phase A (CPU): prepare all missing transition/paint tiles across the slice's
      // chunk batch into swAtlas so we perform at most ONE GPU upload per slice.
      for(let ei=0;ei<entries.length&&!atlasFull;ei++){
        const entry=entries[ei],list=entry.tiles,startCursor=entry.cursor,total=list.length;
        const offset=slotTotal;
        let count=0;
        while(startCursor+count<total){
          const tile=list[startCursor+count],tx=tile.x,ty=tile.y,tv=tile.terrain;
          let nBits=1<<tv,allSame=true,nKey='',pKey='',hasAnyPaint=false;
          for(let dy=-1,i=0;dy<=1;dy++){
            const ny=ty+dy<0?0:ty+dy>=h?h-1:ty+dy,row=ny*w;
            for(let dx=-1;dx<=1;dx++,i++){
              const nx=tx+dx<0?0:tx+dx>=w?w-1:tx+dx,v=terrain[row+nx];
              neighbors[i]=v;nBits|=1<<v;if(v!==tv)allSame=false;nKey+=v;
              const pv=hasPaint?(groundPaint[row+nx]??null):null;
              painted[i]=pv;if(pv){hasAnyPaint=true;pKey+=i+':'+pv+',';}
            }
          }
          if(allSame&&!hasAnyPaint){
            const sheet=ensureSheet(tv);
            batchSlots[slotTotal++]=sheet?{canvas:sheet.canvas,sx:(tx%sheet.rx)*SIZE,sy:(ty%sheet.ry)*SIZE}:null;
            count++;continue;
          }
          let ok=true;
          if(selections[0]&&!ensureSheet(0))ok=false;
          for(let k=1;k<4&&ok;k++)if((nBits&(1<<k))&&selections[k]&&!ensureSheet(k))ok=false;
          if(ok&&!swPixels[0]&&!swPixels[tv])ok=false;
          let paintIds=null;
          if(ok&&hasAnyPaint){
            paintIds=[...new Set(painted.filter(Boolean))].sort();
            for(let pi=0;pi<paintIds.length;pi++)if(!ensurePaint(paintIds[pi])){ok=false;break;}
          }
          if(!ok){batchSlots[slotTotal++]=null;count++;continue;}
          let key=nKey+'|';
          for(let i=0;i<4;i++)if(selections[i]&&(nBits&(1<<i)))key+=(tx%repeatW[i])+','+(ty%repeatH[i])+';';
          if(paintIds){
            key+='|'+pKey+'|';
            for(let pi=0;pi<paintIds.length;pi++){const id=paintIds[pi],p=paintPixels.get(id);key+=id+':'+(tx%p.rx)+','+(ty%p.ry)+';';}
          }
          let slot=transMap.get(key);
          if(!slot){
            if(atlasSlots>=maxSlots){
              if(slotTotal>0){atlasFull=true;break;}
              transMap.clear();atlasSlots=0;
            }
            const ax=(atlasSlots%atlasCols)*cell,ay=Math.floor(atlasSlots/atlasCols)*cell;
            if(!blendTransitionIntoAtlas(ax,ay,tx,ty,tv,nBits,paintIds)){batchSlots[slotTotal++]=null;count++;continue;}
            atlasSlots++;
            if(ay<dirtyMinY)dirtyMinY=ay;
            if(ay+cell>dirtyMaxY)dirtyMaxY=ay+cell;
            slot={canvas:gpuAtlas,sx:ax,sy:ay};
            transMap.set(key,slot);
          }
          batchSlots[slotTotal++]=slot;count++;
        }
        if(count>0)batchChunks.push({entry,startCursor,offset,count});
      }
      if(dirtyMinY<dirtyMaxY){
        const dh=dirtyMaxY-dirtyMinY;
        swAtlasCtx.putImageData(swAtlasImg,0,0,0,dirtyMinY,swAtlas.width,dh);
        gpuAtlasCtx.drawImage(swAtlas,0,dirtyMinY,swAtlas.width,dh,0,dirtyMinY,swAtlas.width,dh);
      }
      // Phase B (GPU): draw prepared chunks with ZERO atlas writes interleaved.
      for(let ci=0;ci<batchChunks.length;ci++){
        if(performance.now()-started>=budgetMs)break;
        const {entry,startCursor,offset,count}=batchChunks[ci],list=entry.tiles;
        const scale=entry.scale,ox=-entry.left*scale,oy=-entry.top*scale,ctx=entry.ctx;
        for(let bi=0;bi<count;bi++){
          const tile=list[startCursor+bi],slot=batchSlots[offset+bi];
          if(!slot){
            ctx.setTransform(scale,0,0,scale,ox,oy);
            const result=this.drawReady(ctx,tile,{direct:true});
            if(result===null)break;
            if(result===false){if(fallback)fallback(ctx,tile);else{const pts=terrainTileCorners(map,tile.x,tile.y).map(p=>projectMap(map,p));ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=['#65804c','#baa781','#376a71','#c4b78e'][tile.terrain];ctx.fill();}}
            entry.cursor++;
            if(performance.now()-started>=budgetMs)break;
            continue;
          }
          const tx=tile.x,ty=tile.y,tOff=terraceOffsets?terraceOffsets[ty*w+tx]:0;
          const idx=ty*stride+tx;
          const h0=(elev?elev[idx]:0)+tOff,h1=(elev?elev[idx+1]:0)+tOff,h2=(elev?elev[idx+stride+1]:0)+tOff,h3=(elev?elev[idx+stride]:0)+tOff;
          const x0=(tx-ty)*halfW,y0=(tx+ty)*halfH-h0*th;
          const x1=x0+halfW,y1=(tx+1+ty)*halfH-h1*th;
          const x2=x0,y2=(tx+1+ty+1)*halfH-h2*th;
          const x3=x0-halfW,y3=(tx+ty+1)*halfH-h3*th;
          if(Math.abs((x1-x0)-(x2-x3))<.3&&Math.abs((y1-y0)-(y2-y3))<.3){
            const expand=Math.min(PAD,SIZE/Math.max(1,Math.hypot(x1-x0,y1-y0))*1.25);
            ctx.setTransform((x1-x0)/SIZE*scale,(y1-y0)/SIZE*scale,(x2-x1)/SIZE*scale,(y2-y1)/SIZE*scale,x0*scale+ox,y0*scale+oy);
            ctx.drawImage(slot.canvas,slot.sx+PAD-expand,slot.sy+PAD-expand,SIZE+expand*2,SIZE+expand*2,-expand,-expand,SIZE+expand*2,SIZE+expand*2);
            if(elev){
              const dx=(h1+h2-h0-h3)*.5,dy=(h3+h2-h0-h1)*.5,sh=Math.max(-.22,Math.min(.22,(dx+dy)*.5));
              const si=Math.round(sh*100)+22;
              if(si!==22){ctx.fillStyle=SHADE_COLORS[si];ctx.fillRect(0,0,SIZE,SIZE);}
            }
          }else{
            ctx.setTransform(scale,0,0,scale,ox,oy);
            const p0={x:0,y:0},p1={x:x1-x0,y:y1-y0},p2={x:x2-x0,y:y2-y0},p3={x:x3-x0,y:y3-y0};
            ctx.save();ctx.translate(x0,y0);
            triangle(ctx,slot.canvas,p0,p1,p2,true,slot.sx,slot.sy);
            triangle(ctx,slot.canvas,p0,p2,p3,false,slot.sx,slot.sy);
            if(elev){
              const dx=(h1+h2-h0-h3)*.5,dy=(h3+h2-h0-h1)*.5,sh=Math.max(-.22,Math.min(.22,(dx+dy)*.5));
              const si=Math.round(sh*100)+22;
              if(si!==22){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.fillStyle=SHADE_COLORS[si];ctx.fill();}
            }
            ctx.restore();
          }
          builds++;entry.cursor++;
          if((bi&15)===15&&performance.now()-started>=budgetMs)break;
        }
        ctx.setTransform(scale,0,0,scale,ox,oy);
      }
    },
    drawReady(ctx,tile,{direct=false}={}){
      const image=material(tile,direct);if(!image){
        return pending?null:false;
      }
      const corners=terrainTileCorners(map,tile.x,tile.y),origin=projectMap(map,corners[0]);
      const points=corners.map(corner=>{const p=projectMap(map,corner);return{x:p.x-origin.x,y:p.y-origin.y};});
      if(direct){
        // The caller already retains a terrain chunk. Avoid allocating another
        // projected canvas for every distinct hill slope inside that chunk.
        const started=performance.now();ctx.save();ctx.translate(origin.x,origin.y);
        const p0=points[0],p1=points[1],p2=points[2],p3=points[3];
        if(Math.abs((p1.x-p0.x)-(p2.x-p3.x))<.3&&Math.abs((p1.y-p0.y)-(p2.y-p3.y))<.3){
          const expand=Math.min(PAD,SIZE/Math.max(1,Math.hypot(p1.x-p0.x,p1.y-p0.y))*1.25);
          ctx.save();ctx.transform((p1.x-p0.x)/SIZE,(p1.y-p0.y)/SIZE,(p2.x-p1.x)/SIZE,(p2.y-p1.y)/SIZE,p0.x,p0.y);
          ctx.drawImage(image,PAD-expand,PAD-expand,SIZE+expand*2,SIZE+expand*2,-expand,-expand,SIZE+expand*2,SIZE+expand*2);ctx.restore();
        }else{triangle(ctx,image,p0,p1,p2,true);triangle(ctx,image,p0,p2,p3,false);}
        if(map.elevations){
          const i=tile.y*stride+tile.x,dx=(elev[i+1]+elev[i+stride+1]-elev[i]-elev[i+stride])/2,dy=(elev[i+stride]+elev[i+stride+1]-elev[i]-elev[i+1])/2;
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
          const i=tile.y*stride+tile.x,dx=(elev[i+1]+elev[i+stride+1]-elev[i]-elev[i+stride])/2,dy=(elev[i+stride]+elev[i+stride+1]-elev[i]-elev[i+1])/2;
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
    clear(){clearFast();for(const t of tiles.values())t.surface.width=t.surface.height=1;for(const image of materials.values())image.width=image.height=1;tiles.clear();materials.clear();masks.clear();pixels=0;},
    stats(){return{tiles:tiles.size,pixels,materials:materials.size,builds,pending,maxPixels,rasterScale,...masks.stats()};},
    dispose(){this.clear();layer.width=layer.height=output.width=output.height=paddedScratch.width=paddedScratch.height=1;}
  };
}
