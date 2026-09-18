// A piecewise-linear shear preserves area while allowing a curved free surface.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0))*.5;
const path=p=>p.length?'M'+p.map(q=>`${+q.x.toFixed(5)} ${+q.y.toFixed(5)}`).join('L')+'Z':'';
const octagon=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));
const inside=(q,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.y>q.y)!==(b.y>q.y)&&q.x<(b.x-a.x)*(q.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
const clip=(p,level)=>{const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=a.y-level,db=b.y-level;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,y:level});}}return out;};
const clippedArea=(p,level)=>{let firstX=0,firstY=0,lastX=0,lastY=0,sum=0,count=0;const append=(x,y)=>{if(count++)sum+=lastX*y-x*lastY;else{firstX=x;firstY=y;}lastX=x;lastY=y;};for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=a.y-level,db=b.y-level;if(da>=0)append(a.x,a.y);if((da>=0)!==(db>=0))append(a.x+(b.x-a.x)*da/(da-db),level);}return Math.abs(sum+lastX*firstY-firstX*lastY)*.5;};
function subdivide(a,b,low,step,count){const points=[a],dx=b.x-a.x;if(Math.abs(dx)>1e-9){const first=Math.max(1,Math.ceil((Math.min(a.x,b.x)-low)/step)),last=Math.min(count-2,Math.floor((Math.max(a.x,b.x)-low)/step)),direction=dx>0?1:-1;for(let i=direction>0?first:last;direction>0?i<=last:i>=first;i+=direction){const x=low+i*step,t=(x-a.x)/dx;if(t>1e-9&&t<1-1e-9)points.push({x,y:a.y+(b.y-a.y)*t});}}return points;}

export class LiquidWaves {
 constructor(){this.reset();}
 reset(){this.heights=new Float64Array(33);this.velocities=new Float64Array(33);this.next=new Float64Array(33);this.drops=[];this.serial=0;this.spawn=0;this.energy=0;}
 impulse(strength){for(let i=0;i<this.velocities.length;i++)this.velocities[i]=clamp(this.velocities[i]+strength*(.15*Math.cos(i/32*Math.PI)+1.8*Math.sin(i/32*Math.PI*4)),-85,85);}
 tick(dt,{force,turn,damping}){
  const h=this.heights,v=this.velocities,next=this.next,drive=clamp(force*.04+turn*1.1,-70,70);
  for(let i=0;i<h.length;i++){const left=h[Math.max(0,i-1)],right=h[Math.min(h.length-1,i+1)],u=i/(h.length-1);next[i]=clamp(v[i]+((left+right-2*h[i])*155-h[i]*2.4-v[i]*(1.2+damping*1.7)+drive*(.15*Math.cos(u*Math.PI)+1.4*Math.sin(u*4*Math.PI)+.25*Math.cos(u*7*Math.PI)))*dt,-85,85);}
  let mean=0;for(let i=0;i<h.length;i++){v[i]=next[i];h[i]=clamp(h[i]+v[i]*dt,-18,18);mean+=h[i];}mean/=h.length;for(let i=0;i<h.length;i++)h[i]-=mean;
  this.energy=0;for(let i=0;i<h.length;i++)this.energy=Math.max(this.energy,Math.abs(h[i]));
 }
 splash(dt,surface,boundary,excitation){
  const n=surface.normal,t={x:n.y,y:-n.x};
  this.drops=this.drops.filter(d=>{d.vx+=n.x*190*dt;d.vy+=n.y*190*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.life-=dt;const u=dot(d,t);return d.life>0&&dot(d,n)+d.radius<surface.level+surface.heightAt(u)&&this.dropPolygon(d).every(p=>inside(p,boundary));});
  this.spawn=Math.min(1,this.spawn+dt*Math.max(0,excitation-.16)*13);
  if(this.spawn>=1&&this.drops.length<16&&this.energy>.7){this.spawn-=1;const id=this.serial++,u=surface.low+(surface.high-surface.low)*(.15+.7*((id*.61803398875)%1)),q=surface.level+surface.heightAt(u),radius=1.8+(id%4)*.55,side=id%2?1:-1,d={x:t.x*u+n.x*(q-radius-2),y:t.y*u+n.y*(q-radius-2),vx:t.x*side*(20+excitation*30)-n.x*(45+excitation*48),vy:t.y*side*(20+excitation*30)-n.y*(45+excitation*48),radius,life:1.1};if(this.dropPolygon(d).every(p=>inside(p,boundary)))this.drops.push(d);}
 }
 dropPolygon(d){return octagon.map(p=>({x:d.x+p.x*d.radius,y:d.y+p.y*d.radius}));}
 get splashArea(){return this.drops.reduce((sum,d)=>sum+2*Math.SQRT2*d.radius*d.radius,0);}
 get splashPath(){return this.drops.map(d=>path(this.dropPolygon(d))).join('');}
}

export function wavedSurface(boundary,normal,fill,heights,splashArea=0){
 const tangent={x:normal.y,y:-normal.x},projected=boundary.map(p=>({x:dot(p,tangent),y:dot(p,normal)})),low=Math.min(...projected.map(p=>p.x)),high=Math.max(...projected.map(p=>p.x)),step=(high-low)/(heights.length-1);
 const heightAt=u=>{const f=clamp((u-low)/step,0,heights.length-1),i=Math.min(heights.length-2,Math.floor(f));return heights[i]+(heights[i+1]-heights[i])*(f-i);};
 const slopeAt=u=>{const i=clamp(Math.floor((u-low)/step),0,heights.length-2);return (heights[i+1]-heights[i])/step;};
 const warped=[];for(let i=0;i<projected.length;i++)for(const p of subdivide(projected[i],projected[(i+1)%projected.length],low,step,heights.length))warped.push({x:p.x,y:p.y-heightAt(p.x)});
 const targetArea=area(boundary)*fill,bulkTarget=Math.max(0,targetArea-splashArea);let a=Math.min(...warped.map(p=>p.y)),b=Math.max(...warped.map(p=>p.y));for(let i=0;i<29;i++){const mid=(a+b)*.5;if(clippedArea(warped,mid)>bulkTarget)a=mid;else b=mid;}const level=(a+b)*.5,clipped=clip(warped,level),polygon=[];
 const unwarp=p=>{const q=p.y+heightAt(p.x);return {x:tangent.x*p.x+normal.x*q,y:tangent.y*p.x+normal.y*q};};
 const cuts=[];for(let i=0;i<warped.length;i++){const p=warped[i],q=warped[(i+1)%warped.length];if((p.y>=level)!==(q.y>=level))cuts.push(p.x+(q.x-p.x)*(level-p.y)/(q.y-p.y));}cuts.sort((a,b)=>a-b);
 for(let i=0;i<clipped.length;i++){const start=clipped[i],end=clipped[(i+1)%clipped.length];if(Math.abs(start.y-level)<1e-8&&Math.abs(end.y-level)<1e-8){const direction=Math.sign(end.x-start.x),between=cuts.filter(x=>(x-start.x)*direction>1e-8&&(end.x-x)*direction>1e-8).sort((a,b)=>(a-b)*direction),points=[start,...between.map(x=>({x,y:level})),end];for(let j=0;j<points.length-1;j++){const p=points[j],q=points[j+1],wet=inside({x:(p.x+q.x)*.5,y:level},warped);for(const v of wet?subdivide(p,q,low,step,heights.length):[p])polygon.push(unwarp(v));}}else polygon.push(unwarp(start));}
 const surfaceSamples=[],surfaceCommands=[],foamSegments=[];for(let i=1;i<cuts.length;i++){const start={x:cuts[i-1],y:level},end={x:cuts[i],y:level};if(!inside({x:(start.x+end.x)*.5,y:level},warped))continue;const samples=[...subdivide(start,end,low,step,heights.length),end];let previous=null;for(const p of samples){const q=unwarp(p);surfaceSamples.push(q);surfaceCommands.push({command:previous?'L':'M',point:q});if(previous&&heightAt((previous.x+p.x)*.5)<-1)foamSegments.push([unwarp(previous),q]);previous=p;}}
 let waterPath,surfacePath,foamPath;const bulkArea=area(polygon);return {normal,level,polygon,area:bulkArea+splashArea,bulkArea,splashArea,targetArea,get waterPath(){return waterPath??=path(polygon);},get surfacePath(){return surfacePath??=surfaceCommands.map(({command,point:q})=>command+q.x.toFixed(5)+' '+q.y.toFixed(5)).join('');},get foamPath(){return foamPath??=foamSegments.map(([p,q])=>`M${p.x.toFixed(5)} ${p.y.toFixed(5)}L${q.x.toFixed(5)} ${q.y.toFixed(5)}`).join('');},surfaceSamples,heightAt,slopeAt,low,high};
}
