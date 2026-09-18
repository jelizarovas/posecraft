import {spatialParts} from './spatial.js';
import {nodeVisible} from './scene-graph.js';

export const fragmentList=(pack,spatial)=>spatial?.fragmentOrder?spatial.fragmentOrder.map(id=>({id,view:spatial.fragments.get(id),part:pack.parts[spatial.fragments.get(id).index]})):(spatial?.order||pack.parts.map(p=>p.id)).map(id=>({id,view:spatial?.parts.get(id),part:pack.parts.find(p=>p.id===id)}));
export function appearance(part,actor,evaluated,pack,spatial){
 const variant=part.variants?.[evaluated.inputs?.[part.variantInput]]||{},host=part.spatial?.surfaceOf&&pack?.parts.find(p=>p.id===part.spatial.surfaceOf),hostPaint=host?appearance(host,actor,evaluated):null,hostView=host&&spatial?.parts.get(host.id);
 return {d:variant.d||part.d,fill:actor.appearance?.[part.channel]||part.fill,transform:`${variant.transform||''} ${part.transform||''}`.trim(),visible:variant.visible!==false&&(!part.showWhen||evaluated.inputs?.[part.showWhen.input]===part.showWhen.equals)&&(!host||hostPaint.visible&&hostView?.visible!==false),opacity:host?(host.opacityChannel&&host.opacityChannel!==part.opacityChannel?(evaluated.pose[host.opacityChannel]??1):1)*(hostView?.opacity??1):1};
}
/** The same evaluated geometry/material stage feeds SVG and Canvas. */
export function evaluateActorDrawing(pack,actor,evaluated){if(!evaluated)throw Error('Missing evaluated actor '+actor.id);const spatial=spatialParts(pack,evaluated);return {spatial,fragments:fragmentList(pack,spatial)};}
export function evaluatedObjects(document,frame){const states=new Map((frame.objects||[]).map(object=>[object.id,object]));return (document.objects||[]).map(source=>{const object={...source,...states.get(source.id)};return {...object,rotation:object.rotation||0,depth:object.depth??document.objectPhysics?.floorY??(document.bounds.height-10),visible:object.enabled!==false&&object.visible!==false&&nodeVisible(document,source)};});}
