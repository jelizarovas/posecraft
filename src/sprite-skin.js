// Rasterize the small painted tile in its own pixel space. Shared edges use the
// same UVs and pixel centers, so translucent antialiasing cannot open a seam.
const caches=new WeakMap();
const cacheBytes=20*1024*1024;
const degrees=Math.PI/180;

function surface(width,height){
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  return canvas;
}

function sourcePixels(atlas,doc,tile,steps,cache){
  const key=[doc.atlas.tile,doc.atlas.columns,tile,steps].join('/');
  if(cache.sources.has(key))return cache.sources.get(key);
  const {tile:size,columns}=doc.atlas;
  const canvas=surface(size,size),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(atlas,tile%columns*size,Math.floor(tile/columns)*size,size,size,0,0,size,size);
  const straight=ctx.getImageData(0,0,size,size).data,pixels=straight.slice();
  const visible=new Uint8Array(steps*steps);
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){
    // Include the neighboring texels sampled by bilinear filtering.
    const x0=Math.max(0,Math.floor(col*size/steps)-1),x1=Math.min(size,Math.ceil((col+1)*size/steps)+1);
    const y0=Math.max(0,Math.floor(row*size/steps)-1),y1=Math.min(size,Math.ceil((row+1)*size/steps)+1);
    for(let y=y0;y<y1&&!visible[row*steps+col];y++)for(let x=x0;x<x1;x++){
      if(straight[(y*size+x)*4+3]){visible[row*steps+col]=1;break;}
    }
  }
  // Premultiply before filtering at cutout edges.
  for(let i=0;i<pixels.length;i+=4){
    const alpha=pixels[i+3]/255;
    for(let k=0;k<3;k++)pixels[i+k]*=alpha;
  }
  if(cache.sources.size>=16)cache.sources.delete(cache.sources.keys().next().value);
  const source={pixels,colors:new Uint32Array(straight.buffer),visible};
  cache.sources.set(key,source);
  return source;
}

function paintTriangle(src,size,output,width,left,top,a,b,c){
  const bx=b.x-a.x,by=b.y-a.y,cx=c.x-a.x,cy=c.y-a.y,det=bx*cy-by*cx;
  if(det<=.001)return;
  const x0=Math.ceil(Math.min(a.x,b.x,c.x)-.5),x1=Math.floor(Math.max(a.x,b.x,c.x)-.5);
  const y0=Math.ceil(Math.min(a.y,b.y,c.y)-.5),y1=Math.floor(Math.max(a.y,b.y,c.y)-.5);
  for(let y=y0;y<=y1;y++){
    let u=((x0+.5-a.x)*cy-(y+.5-a.y)*cx)/det;
    let v=((y+.5-a.y)*bx-(x0+.5-a.x)*by)/det;
    for(let x=x0;x<=x1;x++,u+=cy/det,v-=by/det){
      if(u<-.00001||v<-.00001||u+v>1.00001)continue;
      const sx=Math.max(0,Math.min(size-1,a.s+u*(b.s-a.s)+v*(c.s-a.s)-.5));
      const sy=Math.max(0,Math.min(size-1,a.t+u*(b.t-a.t)+v*(c.t-a.t)-.5));
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
      const i=(iy*size+ix)*4,j=i+(ix+1<size?4:0),k=i+(iy+1<size?size*4:0),l=k+j-i;
      const wi=(1-fx)*(1-fy),wj=fx*(1-fy),wk=(1-fx)*fy,wl=fx*fy;
      const alpha=src[i+3]*wi+src[j+3]*wj+src[k+3]*wk+src[l+3]*wl;
      if(alpha<1)continue;
      const dest=((y-top)*width+x-left)*4;
      for(let ch=0;ch<3;ch++)output[dest+ch]=(src[i+ch]*wi+src[j+ch]*wj+src[k+ch]*wk+src[l+ch]*wl)*255/alpha;
      output[dest+3]=alpha;
    }
  }
}

export function skinnedTile(atlas,doc,frame){
  const {skin,view,angles}=frame.deformation;
  let cache=caches.get(atlas);
  if(!cache){cache={sources:new Map(),frames:new Map(),skins:new WeakMap(),nextId:0,bytes:0};caches.set(atlas,cache);}
  if(!cache.skins.has(skin))cache.skins.set(skin,cache.nextId++);
  const key=[cache.skins.get(skin),frame.tile,view,...angles].join('/');
  const hit=cache.frames.get(key);
  if(hit){cache.frames.delete(key);cache.frames.set(key,hit);return hit;}
  const size=doc.atlas.tile,steps=skin.intervals,stride=steps+1;
  const {pivots,weights}=skin.views[view],count=pivots.length,points=[];
  const encoded=atob(weights);
  for(let row=0;row<=steps;row++)for(let col=0;col<=steps;col++){
    const s=col*size/steps,t=row*size/steps,offset=points.length*count;
    let x=s,y=t;
    for(let j=0;j<count;j++){
      const angle=encoded.charCodeAt(offset+j)/255*angles[j]*degrees;
      if(!angle)continue;
      const dx=s-pivots[j][0],dy=t-pivots[j][1],cos=Math.cos(angle)-1,sin=Math.sin(angle);
      x+=cos*dx-sin*dy;y+=sin*dx+cos*dy;
    }
    points.push({x,y,s,t});
  }
  const src=sourcePixels(atlas,doc,frame.tile,steps,cache);
  // Cache the painted bounds only. Padded, transparent grid corners can swing
  // well outside the sleeve and used to evict frames mid-loop in a crowded lot.
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){
    if(!src.visible[row*steps+col])continue;
    const i=row*stride+col;
    for(const p of [points[i],points[i+1],points[i+stride],points[i+stride+1]]){
      left=Math.min(left,Math.floor(p.x));top=Math.min(top,Math.floor(p.y));
      right=Math.max(right,Math.ceil(p.x));bottom=Math.max(bottom,Math.ceil(p.y));
    }
  }
  if(!Number.isFinite(left)){left=top=0;right=bottom=1;}
  const width=right-left,height=bottom-top,bitmap=new ImageData(width,height),out=new Uint32Array(bitmap.data.buffer);
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){
    if(!src.visible[row*steps+col])continue;
    const i=row*stride+col,a=points[i],b=points[i+1],c=points[i+stride],d=points[i+stride+1];
    if(a.x===a.s&&a.y===a.t&&b.x===b.s&&b.y===b.t&&c.x===c.s&&c.y===c.t&&d.x===d.s&&d.y===d.t){
      const x0=Math.ceil(a.s-.5),x1=Math.ceil(d.s-.5),y1=Math.ceil(d.t-.5);
      for(let y=Math.ceil(a.t-.5);y<y1;y++)for(let x=x0;x<x1;x++){
        const color=src.colors[y*size+x];
        if(color)out[(y-top)*width+x-left]=color;
      }
    }else{
      paintTriangle(src.pixels,size,bitmap.data,width,left,top,a,b,d);
      paintTriangle(src.pixels,size,bitmap.data,width,left,top,a,d,c);
    }
  }
  let x0=width,y0=height,x1=-1,y1=-1;
  for(let y=0;y<height;y++){
    const row=y*width;
    let start=0,end=width-1;
    while(start<width&&!out[row+start])start++;
    if(start===width)continue;
    while(!out[row+end])end--;
    x0=Math.min(x0,start);x1=Math.max(x1,end);y0=Math.min(y0,y);y1=y;
  }
  const canvas=surface(Math.max(1,x1-x0+1),Math.max(1,y1-y0+1));
  canvas.getContext('2d').putImageData(bitmap,-x0,-y0);
  const bytes=canvas.width*canvas.height*4;
  const result={canvas:canvas.transferToImageBitmap?.()??canvas,left:left+x0,top:top+y0,bytes};
  while(cache.bytes+bytes>cacheBytes&&cache.frames.size){
    const oldest=cache.frames.keys().next().value,entry=cache.frames.get(oldest);
    cache.bytes-=entry.bytes;entry.canvas.close?.();cache.frames.delete(oldest);
  }
  cache.frames.set(key,result);cache.bytes+=bytes;
  return result;
}
