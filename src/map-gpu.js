// WebGL2 compositor for immutable world-space chunk images. Texture arrays
// batch adjacent chunks without atlas bleed; mipmaps handle camera minification.
const MIB=1024*1024,STRIDE=9,MAX_VERTICES=131072;
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec2 position;
layout(location=1) in vec3 texcoord;
layout(location=2) in vec4 color;
uniform vec2 camera; uniform vec2 viewport; uniform float zoom;
out vec3 uv; out vec4 tint;
void main(){vec2 p=(position-camera)*zoom/viewport*2.;gl_Position=vec4(p.x,-p.y,0.,1.);uv=texcoord;tint=color;}`;
const fragment=`#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 uv; in vec4 tint; uniform sampler2DArray images;
out vec4 result;
void main(){result=texture(images,uv)*tint;}`;
const bucketSize=n=>n<=4?n:Math.ceil(n/8)*8;

export function createMapGpu(canvas,{maxTextureBytes=64*MIB,onLost=()=>{}}={}){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false});
  if(!gl)return null;
  const maxTextureSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const shaders=[],pages=[],textures=new Map(),meshes=new Map(),vertices=new Float32Array(MAX_VERTICES*STRIDE);
  let geometryBytes=0,geometryBuilds=0;
  let program,buffer,vao,count=0,batchStart=0,commands=[],active=null,frame=0,bytes=0,uploads=0,uploadBytes=0,drawCalls=0,quads=0,disposed=false,lost=false,evictions=0;
  const lostHandler=e=>{e.preventDefault();lost=true;onLost();};canvas.addEventListener('webglcontextlost',lostHandler);
  function shader(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function drop(page){for(const entry of page.entries)if(entry)textures.delete(entry.image);gl.deleteTexture(page.texture);bytes-=page.bytes;pages.splice(pages.indexOf(page),1);evictions++;}
  function pageFor(width,height){
    const side=Math.max(width,height);
    let page=pages.find(p=>p.width===width&&p.height===height&&p.free.length);if(page)return page;
    // Reuse an unreferenced layer before allocating a new array. Partially
    // occupied pages otherwise keep old camera regions resident indefinitely.
    const layers=side<=64?128:side<=256?16:2,levels=Math.floor(Math.log2(side))+1,cost=Array.from({length:levels},(_,i)=>Math.max(1,width>>i)*Math.max(1,height>>i)*4*layers).reduce((a,b)=>a+b,0);
    if(bytes+cost>maxTextureBytes)for(const p of pages)if(p.width===width&&p.height===height){const entry=p.entries.filter(e=>e&&e.frame<frame).sort((a,b)=>a.frame-b.frame)[0];if(entry){textures.delete(entry.image);p.entries[entry.layer]=null;p.free.push(entry.layer);evictions++;return p;}}
    while(bytes+cost>maxTextureBytes){const old=pages.filter(p=>p.frame!==frame&&p!==active).sort((a,b)=>a.frame-b.frame)[0];if(!old)throw Error('Map GPU texture budget exceeded');drop(old);}
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,levels,gl.RGBA8,width,height,layers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    page={texture,side,width,height,layers,bytes:cost,entries:Array(layers).fill(null),free:Array.from({length:layers},(_,i)=>layers-1-i),dirty:false,frame};pages.push(page);bytes+=cost;return page;
  }
  function textureFor(image){
    let entry=textures.get(image);if(entry){entry.frame=frame;entry.page.frame=frame;return entry;}
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,side=bucketSize(Math.max(width,height));
    if(side>maxTextureSize)throw Error('Map chunk exceeds GPU texture size');
    const page=pageFor(bucketSize(width),bucketSize(height)),layer=page.free.pop();page.frame=frame;
    // Resample once into a whole array layer. No neighboring sprite can bleed
    // through its mip chain, and rectangular pages avoid square-texture waste.
    let source=image;
    if(width!==page.width||height!==page.height){uploadCanvas.width=page.width;uploadCanvas.height=page.height;uploadContext.drawImage(image,0,0,page.width,page.height);source=uploadCanvas;}
    gl.bindTexture(gl.TEXTURE_2D_ARRAY,page.texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,layer,page.width,page.height,1,gl.RGBA,gl.UNSIGNED_BYTE,source);
    entry={image,page,layer,width,height,frame};page.entries[layer]=entry;page.dirty=true;textures.set(image,entry);uploads++;uploadBytes+=width*height*4;return entry;
  }
  function flush(){if(count>batchStart){commands.push({page:active,start:batchStart,count:count-batchStart});batchStart=count;}}
  function use(page,n){if(count+n>MAX_VERTICES)throw Error('Map GPU vertex budget exceeded');if(active!==page){flush();active=page;}page.frame=frame;}
  function push(x,y,u,v,layer,tint){const o=count++*STRIDE;vertices[o]=x;vertices[o+1]=y;vertices[o+2]=u;vertices[o+3]=v;vertices[o+4]=layer;vertices[o+5]=tint[0];vertices[o+6]=tint[1];vertices[o+7]=tint[2];vertices[o+8]=tint[3];}
  function drawImage(image,x,y,w,h){
    if(disposed||lost)return;const e=textureFor(image),s=e.page.side;use(e.page,6);
    const u0=0,v0=0,u1=1,v1=1,c=[1,1,1,1];
    push(x,y,u0,v0,e.layer,c);push(x+w,y,u1,v0,e.layer,c);push(x+w,y+h,u1,v1,e.layer,c);
    push(x,y,u0,v0,e.layer,c);push(x+w,y+h,u1,v1,e.layer,c);push(x,y+h,u0,v1,e.layer,c);quads++;
  }
  function drawQuad(image,points,{inset=0,tint=[1,1,1,1]}={}){
    emitQuad(textureFor(image),points,inset,tint);
  }
  function emitQuad(e,points,inset,tint){use(e.page,6);const a=inset,b=1-inset;
    for(const [i,u,v]of [[0,a,a],[1,b,a],[2,b,b],[0,a,a],[2,b,b],[3,a,b]])push(points[i].x,points[i].y,u,v,e.layer,tint);quads++;
  }
  // Call only for non-overlapping geometry within one terrain height level.
  // Scenery keeps its painter order and is never globally texture-sorted.
  function releaseMesh(key,mesh){gl.deleteBuffer(mesh.buffer);gl.deleteVertexArray(mesh.vao);geometryBytes-=mesh.bytes;meshes.delete(key);}
  function attributes(){for(const [location,size,offset]of [[0,2,0],[1,3,2],[2,4,5]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,STRIDE*4,offset*4);}}
  function drawQuads(items){
    const entries=items.map(item=>textureFor(item.image));let mesh=meshes.get(items);
    if(mesh&&entries.some((entry,i)=>entry!==mesh.entries[i])){releaseMesh(items,mesh);mesh=null;}
    if(!mesh){
      const data=new Float32Array(items.length*6*STRIDE),groups=new Map(),batches=[];let cursor=0;
      for(let i=0;i<items.length;i++){const e=entries[i];let group=groups.get(e.page);if(!group){group=[];groups.set(e.page,group);}group.push(i);}
      for(const [page,indices]of groups){const start=cursor/STRIDE;
        for(const i of indices){const item=items[i],e=entries[i],a=item.inset??0,b=1-a,tint=item.tint??[1,1,1,1];for(const [j,u,v]of [[0,a,a],[1,b,a],[2,b,b],[0,a,a],[2,b,b],[3,a,b]]){data.set([item.points[j].x,item.points[j].y,u,v,e.layer,...tint],cursor);cursor+=STRIDE;}}
        batches.push({page,start,count:cursor/STRIDE-start});
      }
      const meshVao=gl.createVertexArray(),meshBuffer=gl.createBuffer();gl.bindVertexArray(meshVao);gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);attributes();
      mesh={entries,batches,buffer:meshBuffer,vao:meshVao,bytes:data.byteLength,frame};meshes.set(items,mesh);geometryBytes+=mesh.bytes;geometryBuilds++;
    }
    mesh.frame=frame;flush();for(const batch of mesh.batches)commands.push({...batch,vao:mesh.vao});quads+=items.length;
  }
  const uploadCanvas=canvas.ownerDocument.createElement('canvas'),uploadContext=uploadCanvas.getContext('2d',{willReadFrequently:true});
  const white=canvas.ownerDocument.createElement('canvas');white.width=white.height=1;const c=white.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1,1);
  function polygon(points,color){const e=textureFor(white),uv=.5,tint=[color[0]*color[3],color[1]*color[3],color[2]*color[3],color[3]];use(e.page,(points.length-2)*3);for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]])push(p.x,p.y,uv,uv,e.layer,tint);}
  function line(points,color,width){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1,x=-dy/n*width/2,y=dx/n*width/2;polygon([{x:a.x+x,y:a.y+y},{x:b.x+x,y:b.y+y},{x:b.x-x,y:b.y-y},{x:a.x-x,y:a.y-y}],color);}}
  function dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lostHandler);for(const page of [...pages])drop(page);for(const [key,mesh]of meshes)releaseMesh(key,mesh);gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);textures.clear();white.width=white.height=1;uploadCanvas.width=uploadCanvas.height=1;if(!gl.isContextLost())gl.getExtension('WEBGL_lose_context')?.loseContext();}
  try{
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    vao=gl.createVertexArray();gl.bindVertexArray(vao);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices.byteLength,gl.DYNAMIC_DRAW);
    attributes();
  }catch(error){dispose();throw error;}
  const cameraUniform=gl.getUniformLocation(program,'camera'),viewportUniform=gl.getUniformLocation(program,'viewport'),zoomUniform=gl.getUniformLocation(program,'zoom');
  return{
    drawImage,drawQuad,drawQuads,polygon,line,
    begin({width,height,dpr,camera,zoom}){
      if(disposed||lost)throw Error('Map GPU context unavailable');frame++;count=batchStart=0;commands=[];active=null;drawCalls=quads=0;
      for(const [key,mesh]of meshes)if(mesh.frame<frame-3&&geometryBytes>8*MIB)releaseMesh(key,mesh);
      for(const [image,e]of textures)if(image.width===1&&image.height===1&&(e.width!==1||e.height!==1)){textures.delete(image);e.page.entries[e.layer]=null;e.page.free.push(e.layer);}
      const w=Math.round(width*dpr),h=Math.round(height*dpr);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
      gl.viewport(0,0,w,h);gl.clearColor(218/255,228/255,212/255,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(cameraUniform,camera.x,camera.y);gl.uniform2f(viewportUniform,width,height);gl.uniform1f(zoomUniform,zoom);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    },
    end(){
      flush();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices.subarray(0,count*STRIDE));
      // Uploads finish before any draw. Each touched array gets one mip rebuild,
      // even when its images occur in several separate painter-order batches.
      for(const page of pages)if(page.dirty){gl.bindTexture(gl.TEXTURE_2D_ARRAY,page.texture);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);page.dirty=false;}
      for(const command of commands){gl.bindVertexArray(command.vao??vao);gl.bindTexture(gl.TEXTURE_2D_ARRAY,command.page.texture);gl.drawArrays(gl.TRIANGLES,command.start,command.count);drawCalls++;}
    },
    stats(){return{textureBytes:bytes,maxTextureBytes,geometryBytes,geometryBuilds,pages:pages.length,textures:textures.size,uploads,uploadBytes,drawCalls,quads,evictions};},
    clear(){for(const p of [...pages])drop(p);for(const [key,mesh]of meshes)releaseMesh(key,mesh);commands=[];count=batchStart=0;active=null;},
    dispose
  };
}
