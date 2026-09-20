import {continuousSegmentClear,propCollisionParts,propHitsSegment} from './map-collision.js';
import {groundHeight} from './map-art-layout.js';

function traversalGeometry(prop,ux,uy,radius){
 const parts=propCollisionParts(prop);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const part of parts)if(part.shape==='circle'){left=Math.min(left,part.x-part.radius);right=Math.max(right,part.x+part.radius);top=Math.min(top,part.y-part.radius);bottom=Math.max(bottom,part.y+part.radius);}else{left=Math.min(left,part.x);right=Math.max(right,part.x+part.width);top=Math.min(top,part.y);bottom=Math.max(bottom,part.y+part.height);}
 const center={x:(left+right)/2,y:(top+bottom)/2};return{center,reach:Math.abs(ux)*(right-left)/2+Math.abs(uy)*(bottom-top)/2+radius};
}

/** Find a nearby route crossing with a clear takeoff, flight corridor and landing. */
export function planMapVault(index,actor,route,routeIndex,gait){
 const radius=index.map.navigation.radius,running=gait==='run',lead=running?1.0:.38,look=lead+.8;
 let from=actor,walked=0;
 for(let i=routeIndex;i<route.length&&walked<look;i++){
  const end=route[i],dx=end.x-from.x,dy=end.y-from.y,length=Math.hypot(dx,dy);if(length<1e-8){from=end;continue;}
  const ux=dx/length,uy=dy/length,scan=Math.min(length,look-walked),to={x:from.x+ux*scan,y:from.y+uy*scan},seen=new Set();
  const candidates=[];
  for(let y=Math.floor(Math.min(from.y,to.y))-1;y<=Math.floor(Math.max(from.y,to.y))+1;y++)for(let x=Math.floor(Math.min(from.x,to.x))-1;x<=Math.floor(Math.max(from.x,to.x))+1;x++)for(const prop of index.propsAt(x,y)){
   if(seen.has(prop.id)||prop.traversal?.kind!=='vault'||(prop.traversal.activation??'auto')!=='auto')continue;seen.add(prop.id);
   if(!propHitsSegment(prop,from,to,radius))continue;
   const {center}=traversalGeometry(prop,ux,uy,radius),along=(center.x-from.x)*ux+(center.y-from.y)*uy;
   if(along<0)continue;candidates.push({prop,along});
  }
  candidates.sort((a,b)=>a.along-b.along);
  for(const {prop,along}of candidates){
   const {center,reach}=traversalGeometry(prop,ux,uy,radius);
   if(walked+along>reach+lead)continue;
   const landingDistance=Math.min(length,along+reach+(running?.55:.35));
   const landing={x:from.x+ux*landingDistance,y:from.y+uy*landingDistance};
   if(!continuousSegmentClear(index,landing,landing,radius)||!continuousSegmentClear(index,actor,landing,radius,{ignoreProp:prop.id}))continue;
   const distance=Math.hypot(landing.x-actor.x,landing.y-actor.y),speed=actor.speed*(running?1.8:1);
   if(distance<.15)continue;
   const vx=(landing.x-actor.x)/distance,vy=(landing.y-actor.y)/distance,projection=(center.x-actor.x)*vx+(center.y-actor.y)*vy,startZ=groundHeight(index.map,actor),endZ=groundHeight(index.map,landing);
   let height=prop.traversal.height+(running?.65:.35),valid=true;
   for(const t of [(projection-reach)/distance,(projection+reach)/distance]){
    if(t<=.01||t>=.99){valid=false;break;}
    const clearance=groundHeight(index.map,center)+prop.traversal.height+.06-(startZ+(endZ-startZ)*t);
    height=Math.max(height,clearance/(4*t*(1-t)));
   }
   if(!valid||height>(running?1.8:1.35))continue;
   const style=prop.traversal.style??(prop.kind==='rock'?'rock':'branch');
   const duration=style==='branch'?Math.max(running?.88:1,Math.min(1.25,distance/speed)):Math.max(.38,Math.min(.8,distance/speed));
   return{object:prop.id,start:{x:actor.x,y:actor.y},landing,elapsed:0,duration,height,heading:Math.atan2(landing.y-actor.y,landing.x-actor.x),startZ,endZ,action:style==='rock'?null:'vault',style,supportPoint:{x:center.x,y:center.y,z:groundHeight(index.map,center)+prop.traversal.height}};
  }
  walked+=length;from=end;
 }
 return null;
}
