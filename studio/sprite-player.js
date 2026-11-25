import {compileSpritePuppet,drawSpritePuppet} from '../src/sprite-puppet.js';

export async function spritePlayer(canvas,document,onTime){
  const rig=compileSpritePuppet(document),atlas=new Image();
  atlas.src=document.atlas.src;await atlas.decode();
  const {tile,columns,images}=document.atlas;
  if(atlas.width!==tile*columns||atlas.height!==tile*Math.ceil(images.length/columns))throw Error('Atlas dimensions do not match its cells.');
  const ctx=canvas.getContext('2d'),[left,top,w,h]=document.bounds;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,time=0,previous=null,playing=!reduce.matches,visible=true;
  function draw(){
    const scale=Math.min(canvas.width/w,canvas.height/h);
    ctx.resetTransform();ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(scale,0,0,scale,(canvas.width-scale*w)/2-left*scale,(canvas.height-scale*h)/2-top*scale);
    drawSpritePuppet(ctx,atlas,rig,time);onTime?.(time,playing);
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
    seek(value){playing=false;time=Math.max(0,Math.min(document.clip.duration,value));schedule();draw();},
    toggle(){playing=!playing;if(playing&&time===document.clip.duration)time=0;schedule();draw();},
    dispose(){playing=false;schedule();resize.disconnect();intersection.disconnect();reduce.removeEventListener('change',preference);canvas.ownerDocument.removeEventListener('visibilitychange',schedule);}
  };
}
