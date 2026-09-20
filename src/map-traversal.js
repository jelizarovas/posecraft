import {continuousSegmentClear,propCollisionParts} from './map-collision.js';
import {groundHeight} from './map-art-layout.js';

export const traversalActivation=prop=>prop.traversal?.activation??'auto';
export const traversalEndpoints=prop=>prop.traversal?.endpoints?.map(p=>({x:prop.x+p.x,y:prop.y+p.y}))??null;
function supportPoint(index,prop){const parts=propCollisionParts(prop);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const p of parts)if(p.shape==='circle'){left=Math.min(left,p.x-p.radius);right=Math.max(right,p.x+p.radius);top=Math.min(top,p.y-p.radius);bottom=Math.max(bottom,p.y+p.radius);}else{left=Math.min(left,p.x);right=Math.max(right,p.x+p.width);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y+p.height);}const point={x:(left+right)/2,y:(top+bottom)/2};return{x:point.x,y:point.y,z:groundHeight(index.map,point)+prop.traversal.height};}

/** Resolve the authored entry and exit from the actor's current side. */
export function manualTraversalPlan(index,prop,actor){
 const endpoints=traversalEndpoints(prop);if(!endpoints||traversalActivation(prop)!=='click')return null;
 const [a,b]=endpoints,entry=Math.hypot(actor.x-a.x,actor.y-a.y)<=Math.hypot(actor.x-b.x,actor.y-b.y)?a:b,exit=entry===a?b:a,radius=index.map.navigation?.radius??0;
 if(!continuousSegmentClear(index,entry,entry,radius)||!continuousSegmentClear(index,exit,exit,radius)||!continuousSegmentClear(index,entry,exit,radius,{ignoreProp:prop.id,ignoreCliffs:prop.traversal.kind==='climb'}))return null;
 const startZ=groundHeight(index.map,entry),endZ=groundHeight(index.map,exit),kind=prop.traversal.kind;
 if(kind==='climb'&&Math.abs(endZ-startZ)<=.02)return null;
 const action=kind==='climb'?(endZ>startZ?'climb-up':'climb-down'):'vault';
 return{object:prop.id,entry,landing:exit,start:{...entry},elapsed:0,duration:kind==='climb'?Math.max(.65,Math.min(1.8,.55+Math.hypot(exit.x-entry.x,exit.y-entry.y)*.45)):Math.max(.5,Math.min(1.1,.35+Math.hypot(exit.x-entry.x,exit.y-entry.y)*.3)),height:prop.traversal.height,heading:Math.atan2(exit.y-entry.y,exit.x-entry.x),startZ,endZ,action,style:prop.traversal.style??(prop.kind==='rock'?'rock':'branch'),supportPoint:supportPoint(index,prop),manual:true};
}
