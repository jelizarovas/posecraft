import {sampleSpriteStop} from '../src/sprite-puppet.js';

const degrees=value=>Number(value.toFixed(1))+'°';
const radians=value=>(value-90)*Math.PI/180;

export function jointLimitGuide(id,track,slider,reading){
  return (ctx,centers,rig,time,overrides)=>{
    const stop=rig.stops.find(s=>s.name===track);
    if(!stop)return;
    const {min,max}=stop,angle=sampleSpriteStop(stop,time,overrides[track]);
    const distance=Math.min(angle-min,max-angle);
    const end=angle-min<max-angle?'minimum':'maximum';
    const locked=min===max,at=distance<1e-6,near=distance<=Math.min(10,(max-min)*.1);
    let label='within range';
    if(locked)label='locked';
    else if(at)label='at '+end;
    else if(near)label=(distance<.05?'<0.1°':degrees(distance))+' from '+end;
    const text=degrees(angle)+' · '+label;
    if(reading.textContent!==text)reading.textContent=text;
    const state=at?'at':near?'near':'free';
    if(reading.dataset.stop!==state)reading.dataset.stop=state;
    if(slider.valueAsNumber!==angle)slider.value=angle;
    if(slider.getAttribute('aria-valuetext')!==text)slider.setAttribute('aria-valuetext',text);

    // This dial reads in joint-local degrees, including when a twist axis is
    // edge-on to the camera. Its leader identifies the projected joint socket.
    const [x,y]=centers.get(id),socket=ctx.getTransform().transformPoint({x,y});
    const ratio=ctx.canvas.width/Math.max(1,ctx.canvas.clientWidth);
    const px=socket.x/ratio,py=socket.y/ratio,w=ctx.canvas.width/ratio,h=ctx.canvas.height/ratio;
    const radius=19,gap=radius+6;
    const cx=Math.max(gap,Math.min(w-gap,px+(px>w/2?40:-40)));
    const cy=Math.max(gap,Math.min(h-gap,py-22));
    ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.strokeStyle='#d6e6df';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(cx,cy);ctx.stroke();
    ctx.beginPath();ctx.arc(px,py,3,0,2*Math.PI);ctx.fillStyle='#243332';ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,radius+4,0,2*Math.PI);ctx.fillStyle='#182423ed';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,radius,0,2*Math.PI);ctx.strokeStyle='#63746d';ctx.stroke();
    ctx.strokeStyle='#9ddab7';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(cx,cy,radius,radians(min),radians(max));ctx.stroke();
    function spoke(value,start,finish){
      const a=radians(value),dx=Math.cos(a),dy=Math.sin(a);
      ctx.beginPath();ctx.moveTo(cx+start*dx,cy+start*dy);ctx.lineTo(cx+finish*dx,cy+finish*dy);ctx.stroke();
    }
    ctx.lineWidth=2;spoke(min,radius-4,radius+3);spoke(max,radius-4,radius+3);
    ctx.strokeStyle=at?'#ffac98':near?'#ffd38a':'white';ctx.lineWidth=3;
    spoke(angle,0,radius);ctx.restore();
  };
}
