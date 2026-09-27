/** Authored floor depth is independent of the artwork's height above the floor. */
export function sceneDepth(anchor,actor,evaluated,spatial){
 if(!anchor)return null;if(anchor.value!==undefined)return anchor.value+(anchor.channel?(evaluated?.pose?.[anchor.channel]??0):0);
 const joint=spatial?.world[anchor.joint]||evaluated?.world[anchor.joint];if(!joint)return null;
 const p=evaluated.placement||actor.transform,angle=p.rotation*Math.PI/180;
 return p.y+p.scale*(joint.x*Math.sin(angle)+(joint.y+(anchor.offset||0))*Math.cos(angle));
}
/** Legacy entries keep their exact slots; opted-in entries sort stably among them. */
export function sortSceneDepth(entries){
 const sorted=entries.filter(e=>e.depth!==null&&e.depth!==undefined).map((entry,index)=>({entry,index})).sort((a,b)=>a.entry.depth-b.entry.depth||a.index-b.index);let i=0;
 return entries.map(e=>e.depth===null||e.depth===undefined?e:sorted[i++].entry);
}
export function partSceneDepth(pack,part){return part.spatial?.surfaceOf?pack.parts.find(p=>p.id===part.spatial.surfaceOf)?.spatial?.sceneDepth:part.spatial?.sceneDepth;}
export function partDepthSplit(pack,part){return part.spatial?.surfaceOf?pack.parts.find(p=>p.id===part.spatial.surfaceOf)?.spatial?.depthSplit:part.spatial?.depthSplit;}
export function sceneGroupContains(group,partId,fragmentId){return group.parts.includes(partId)||group.fragments.includes(fragmentId);}
export function scenePartGroups(pack){
 const groups=new Map();
 const add=(id,depth,part,fragment)=>{const key=JSON.stringify(depth);if(!groups.has(key))groups.set(key,{id,depth,parts:[],fragments:[]});groups.get(key)[fragment?'fragments':'parts'].push(fragment||part);};
 for(const part of pack.parts){const split=partDepthSplit(pack,part);if(split){for(const region of ['low','high']){const id=part.id+'--depth-'+region;add(id,split[region],part.id,id);}}else{const depth=partSceneDepth(pack,part);if(depth)add(part.id,depth,part.id);}}
 return [...groups.values()];
}
