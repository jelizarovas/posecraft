import {projectMap} from './map.js';

// Clip before distributing arrows: a long route crossing a small viewport must
// cost the same as a short visible route, even at the map's maximum dimensions.
function visibleInterval(a,b,rect,pad){
 let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x-rect.x+pad],[dx,rect.x+rect.width+pad-a.x],[-dy,a.y-rect.y+pad],[dy,rect.y+rect.height+pad-a.y]]){
  if(Math.abs(p)<1e-9){if(q<0)return null;continue;}
  const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }
 return [lo,hi];
}

/** Project only visible route chevrons; animation moves in travel direction. */
export function mapRouteArrows(map,segments,rect,{zoom=1,time=0,reduced=false,maxArrows=240}={}){
 const arrows=[],spacing=.8*64/(map.tileSize.width*zoom),phase=reduced?spacing*.5:(time*.001*spacing)%spacing;
 let cumulative=0;
 for(const segment of segments||[]){
  const a=projectMap(map,segment.from),b=projectMap(map,segment.to),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(segment.to.x-segment.from.x,segment.to.y-segment.from.y);
  if(length<1e-7)continue;
  const start=segment.offset??cumulative;cumulative=start+length;
  const range=visibleInterval(a,b,rect,8/zoom);if(!range)continue;
  // Cumulative ground distance keeps spacing continuous around rounded corners
  // and anchors the arrows when the actor shortens the first route segment.
  const offset=((phase-start)%spacing+spacing)%spacing;
  let d=offset+Math.max(0,Math.ceil((range[0]*length-offset)/spacing))*spacing;
  for(;d<=range[1]*length;d+=spacing){
   arrows.push({x:a.x+dx*d/length,y:a.y+dy*d/length,angle:Math.atan2(dy,dx)});
   if(arrows.length>=maxArrows)return arrows;
  }
 }
 return arrows;
}

export function drawMapRoute(ctx,map,frame,rect,{zoom=1,time=0,reduced=false}={}){
 const arrows=mapRouteArrows(map,frame.routeSegments,rect,{zoom,time,reduced});
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const arrow of arrows){
  ctx.save();ctx.translate(arrow.x,arrow.y);ctx.rotate(arrow.angle);
  ctx.beginPath();ctx.moveTo(-3.5/zoom,-3.2/zoom);ctx.lineTo(1.8/zoom,0);ctx.lineTo(-3.5/zoom,3.2/zoom);
  ctx.strokeStyle='#32291acf';ctx.lineWidth=3.8/zoom;ctx.stroke();
  ctx.strokeStyle='#ffe1a0';ctx.lineWidth=1.8/zoom;ctx.stroke();ctx.restore();
 }
 if(frame.destination){
  const p=projectMap(map,frame.destination),size=(11+(reduced?0:Math.sin(time*.005)*1.4))/zoom;
  if(p.x>=rect.x-size&&p.x<=rect.x+rect.width+size&&p.y>=rect.y-size&&p.y<=rect.y+rect.height+size){
   ctx.beginPath();ctx.moveTo(p.x-size,p.y);ctx.lineTo(p.x,p.y-size*.5);ctx.lineTo(p.x+size,p.y);ctx.lineTo(p.x,p.y+size*.5);ctx.closePath();
   ctx.fillStyle='#f5bc422c';ctx.fill();ctx.strokeStyle='#30291cd9';ctx.lineWidth=4/zoom;ctx.stroke();ctx.strokeStyle='#ffe9ac';ctx.lineWidth=2/zoom;ctx.stroke();
   ctx.beginPath();ctx.arc(p.x,p.y,2/zoom,0,Math.PI*2);ctx.fillStyle='#fff6d7';ctx.fill();
  }
 }
 ctx.restore();return arrows.length;
}
