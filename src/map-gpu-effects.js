import {mapRouteArrows} from './map-route-overlay.js';
import {projectMap} from './map.js';
import {terrainTileCorners} from './map-cliffs.js';

export function drawGpuRoute(gpu,map,frame,rect,{zoom,time,reduced}){
  const arrows=mapRouteArrows(map,frame.routeSegments,rect,{zoom,time,reduced});
  for(const a of arrows){const cos=Math.cos(a.angle),sin=Math.sin(a.angle),points=[[-3.5,-3.2],[1.8,0],[-3.5,3.2]].map(([x,y])=>({x:a.x+(x*cos-y*sin)/zoom,y:a.y+(x*sin+y*cos)/zoom}));gpu.line(points,[.196,.161,.102,.81],3.8/zoom);gpu.line(points,[1,.882,.627,1],1.8/zoom);}
  if(frame.destination){const p=projectMap(map,frame.destination),r=(11+(reduced?0:Math.sin(time*.005)*1.4))/zoom;if(p.x<rect.x-r||p.x>rect.x+rect.width+r||p.y<rect.y-r||p.y>rect.y+rect.height+r)return;
    const points=[{x:p.x-r,y:p.y},{x:p.x,y:p.y-r/2},{x:p.x+r,y:p.y},{x:p.x,y:p.y+r/2}];gpu.polygon(points,[.96,.737,.259,.17]);gpu.line([...points,points[0]],[.188,.161,.11,.85],4/zoom);gpu.line([...points,points[0]],[1,.914,.675,1],2/zoom);
    gpu.polygon(Array.from({length:12},(_,i)=>({x:p.x+Math.cos(i*Math.PI/6)*2/zoom,y:p.y+Math.sin(i*Math.PI/6)*2/zoom})),[1,.965,.843,1]);
  }
}

// Short world-space ripples remain inside each water tile. No texture upload
// or per-frame intermediate canvas is required for these animated overlays.
export function drawGpuRiver(gpu,map,tiles,rect,time,{reduced}){
  let visible=0;const s=map.tileSize.width/64,t=reduced?0:time;
  for(const tile of tiles){if(tile.terrain!==2)continue;const p=terrainTileCorners(map,tile.x,tile.y).map(v=>projectMap(map,v));
    if(Math.max(...p.map(v=>v.x))<rect.x||Math.min(...p.map(v=>v.x))>rect.x+rect.width||Math.max(...p.map(v=>v.y))<rect.y||Math.min(...p.map(v=>v.y))>rect.y+rect.height)continue;visible++;
    for(let i=0;i<2;i++){const u=.16+((t*.24+tile.x*.371+tile.y*.183+i*.5)%1)*.68,v=.16+((tile.x*.127+tile.y*.281+i*.43)%1)*.68;
      const x=p[0].x+(p[1].x-p[0].x)*u+(p[3].x-p[0].x)*v,y=p[0].y+(p[1].y-p[0].y)*u+(p[3].y-p[0].y)*v;
      gpu.line([{x:x-2*s,y},{x,y:y+.5*s},{x:x+2*s,y}],[.792,.929,.929,.12+Math.sin(u*Math.PI)*.12],.8*s);
    }
  }return visible;
}
