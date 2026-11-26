import {compileSpritePuppet,drawSpritePuppet,sampleSpritePuppet} from '../src/sprite-puppet.js';

export async function spritePlayer(canvas,document,onTime){
  const rig=compileSpritePuppet(document),atlas=new Image();
  atlas.src=document.atlas.src;await atlas.decode();
  const {tile,columns,images}=document.atlas;
  if(atlas.width!==tile*columns||atlas.height!==(document.atlas.height??tile*Math.ceil(images.length/columns)))throw Error('Atlas dimensions do not match its cells.');
  const ctx=canvas.getContext('2d');
  let overrides={},focus=null,skeleton='',guide=null;
  let collider=null,sphereIndex=0;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,time=0,previous=null,playing=!reduce.matches,visible=true;
  function draw(){
    const span=focus?12*rig.pieces.find(p=>p.id===focus).size:0;
    const [left,top,w,h]=focus?[-span/2,-span/2,span,span]:document.bounds;
    const fit=Math.min(canvas.width/w,canvas.height/h);
    // Inspect the original paint without magnifying a small sprite to stage width.
    const scale=focus?Math.min(fit,1.5*tile/(.75*span)):fit;
    ctx.resetTransform();ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(scale,0,0,scale,(canvas.width-scale*w)/2-left*scale,(canvas.height-scale*h)/2-top*scale);
    if(skeleton!=='side')drawSpritePuppet(ctx,atlas,rig,time,overrides,focus);
    if(skeleton||guide||collider){
      const pose=sampleSpritePuppet(rig,time,overrides,!!collider),centers=new Map();
      const origin=focus&&pose.find(p=>p.id===focus);
      if(origin)ctx.translate(-(skeleton==='side'?origin.z:origin.x),-origin.y);
      ctx.lineWidth=1.5/scale;ctx.strokeStyle='#ffdf80';ctx.fillStyle='#593915';
      for(const [i,p] of pose.entries()){
        const part=rig.pieces[i],r=p.rotation*Math.PI/180,offset=part.pivot*p.size*(p.stretch??1);
        const x=skeleton==='side'?p.z:p.x-offset*Math.sin(r),y=p.y+offset*Math.cos(r);
        const parent=centers.get(part.parent);
        if(skeleton){
          if(parent){ctx.beginPath();ctx.moveTo(...parent);ctx.lineTo(x,y);ctx.stroke();}
          ctx.beginPath();ctx.arc(x,y,3/scale,0,2*Math.PI);ctx.fill();ctx.stroke();
        }
        centers.set(p.id,[x,y]);
      }
      if(collider)for(const part of pose){
        for(const [i,s] of (part.collision??[]).entries()){
          const selected=part.id===collider&&i===sphereIndex;
          ctx.beginPath();ctx.arc(skeleton==='side'?s.z:s.x,s.y,s.r,0,2*Math.PI);
          ctx.fillStyle=selected?'#fcba4844':'#75dcca18';ctx.fill();
          ctx.strokeStyle=part.contactBlocked?'#ff8475':selected?'#ffcc67':'#9de1d1';ctx.stroke();
        }
      }
      guide?.(ctx,centers,rig,document.clip.loop?time%document.clip.duration:time,overrides);
    }
    onTime?.(time,playing);
  }
  function tick(now){
    frame=0;
    if(previous!==null)time+=(now-previous)/1000;
    if(time>=document.clip.duration){
      if(document.clip.loop)time%=document.clip.duration;
      else {time=document.clip.duration;playing=false;}
    }
    previous=now;draw();schedule();
  }
  function schedule(){
    cancelAnimationFrame(frame);frame=0;
    if(playing&&visible&&!canvas.ownerDocument.hidden)frame=requestAnimationFrame(tick);
    else previous=null;
  }
  const resize=new ResizeObserver(()=>{
    canvas.width=Math.max(1,Math.round(canvas.clientWidth*Math.min(devicePixelRatio,2)));
    canvas.height=Math.max(1,Math.round(canvas.clientHeight*Math.min(devicePixelRatio,2)));draw();
  });
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();});
  const preference=()=>{playing=!reduce.matches;schedule();draw();};
  resize.observe(canvas);intersection.observe(canvas);reduce.addEventListener('change',preference);
  canvas.ownerDocument.addEventListener('visibilitychange',schedule);draw();schedule();
  return {
    collisions(part,index){collider=part;sphereIndex=index;draw();},
    guide(callback){guide=callback;draw();},
    skeleton(mode){skeleton=mode;draw();},
    preview(values,part){overrides=values;focus=part;draw();},
    seek(value){playing=false;time=Math.max(0,Math.min(document.clip.duration,value));schedule();draw();},
    toggle(){playing=!playing;if(playing&&time===document.clip.duration)time=0;schedule();draw();},
    dispose(){playing=false;schedule();resize.disconnect();intersection.disconnect();reduce.removeEventListener('change',preference);canvas.ownerDocument.removeEventListener('visibilitychange',schedule);}
  };
}
