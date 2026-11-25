import {forwardKinematics,sampleClip} from './index.js';

const radians=Math.PI/180;
const turn=(x,y,degrees)=>({
  x:x*Math.cos(degrees*radians)-y*Math.sin(degrees*radians),
  y:x*Math.sin(degrees*radians)+y*Math.cos(degrees*radians),
});

export function validateSpritePuppet(doc){
  const require=(condition,field)=>{if(!condition)throw TypeError('Invalid sprite puppet '+field);};
  require(doc?.format==='posecraft-sprite-puppet'&&doc.version===1,'format');
  require(typeof doc.name==='string'&&doc.name.trim(),'name');
  require(doc.bounds?.length===4&&doc.bounds.every(Number.isFinite)&&doc.bounds[2]>0&&doc.bounds[3]>0,'bounds');
  const {atlas,clip,parts,channels}=doc;
  require(atlas&&Number.isInteger(atlas.tile)&&atlas.tile>0&&Number.isInteger(atlas.columns)&&atlas.columns>0&&
    Array.isArray(atlas.images)&&atlas.images.length&&new Set(atlas.images).size===atlas.images.length&&
    /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(atlas.src),'atlas');
  require(clip&&Number.isFinite(clip.duration)&&clip.duration>0&&typeof clip.loop==='boolean'&&clip.tracks,'clip');
  require(channels&&Object.values(channels).every(options=>Array.isArray(options)&&options.length&&options.every(s=>typeof s==='string')),'drawing channels');
  const ids=new Set();
  require(Array.isArray(parts)&&parts.length>0,'parts');
  for(const part of parts){
    require(/^[a-zA-Z][\w-]*$/.test(part.id)&&!ids.has(part.id)&&(!part.parent||ids.has(part.parent)), 'joint '+part.id);
    ids.add(part.id);
    require([part.x,part.y,part.rotation,part.pivot,part.size,part.depth].every(Number.isFinite)&&part.size>0,'registration');
    require(atlas.images.includes(part.image)&&Array.isArray(part.variants),'drawing '+part.id);
    for(const {image,when} of part.variants){
      require(atlas.images.includes(image)&&when&&Object.entries(when).every(([name,value])=>Number.isInteger(value)&&channels[name]?.[value]!==undefined),'variant '+image);
    }
  }
  for(const [name,keys] of Object.entries(clip.tracks)){
    const options=channels[name];
    const [joint,property]=name.split('.');
    require(options||ids.has(joint)&&['x','y','rotation'].includes(property)&&name===joint+'.'+property,'track '+name);
    require(Array.isArray(keys)&&keys.length,'keys '+name);
    let last=-1;
    for(const [time,value,ease] of keys){
      require(Number.isFinite(time)&&time>=0&&time<=clip.duration&&time>last&&Number.isFinite(value),'key '+name);
      require(options?Number.isInteger(value)&&options[value]!==undefined&&ease==='step':
        ease===undefined||['linear','step','smooth'].includes(ease),'interpolation '+name);
      last=time;
    }
  }
  return doc;
}

// Bind in the saved rest pose. Clip angles are offsets, so an edited elbow
// keeps its bend when a performance starts. Missing joints inherit the nearest
// available ancestor, e.g. a toy made with a single piece for each arm.
export function compileSpritePuppet(doc,bindings){
  validateSpritePuppet(doc);
  const parents=new Map(doc.parts.map(p=>[p.id,p.parent]));
  const pivots=new Map(),joints=[],pieces=[];
  const pending=doc.parts.filter(p=>!bindings||bindings[p.id]).map(p=>({...p,...bindings?.[p.id]}));
  for(const part of pending){
    if(![part.x,part.y,part.size,part.rotation].every(Number.isFinite)||part.size<=0)throw TypeError('Invalid bind pose '+part.id);
    if(part.parent&&!parents.has(part.parent))throw TypeError('Unknown bind parent '+part.parent);
    while(part.parent&&bindings&&!bindings[part.parent])part.parent=parents.get(part.parent);
  }
  while(pending.length){
    const available=pending.findIndex(p=>!p.parent||pivots.has(p.parent));
    if(available<0)throw TypeError('Cyclic puppet bind pose');
    const [part]=pending.splice(available,1);
    const offset=turn(0,part.pivot*part.size,part.rotation);
    const pivot={x:part.x+offset.x,y:part.y+offset.y,rotation:part.rotation};
    const parent=part.parent;
    const base=pivots.get(parent)||{x:0,y:0,rotation:0};
    pivots.set(part.id,pivot);
    joints.push({id:part.id,parent:parent||null,...turn(pivot.x-base.x,pivot.y-base.y,-base.rotation),
      rotation:part.rotation-base.rotation,length:0});
    pieces.push({...part,defaultTile:doc.atlas.images.indexOf(part.image),
      switches:part.variants.map(v=>({conditions:Object.entries(v.when),tile:doc.atlas.images.indexOf(v.image)}))});
  }
  return {doc,joints,pieces};
}

export function sampleSpritePuppet(rig,seconds){
  const {doc,joints,pieces}=rig;
  const pose=sampleClip(doc.clip,Math.max(0,seconds));
  for(const joint of joints){
    const key=joint.id+'.rotation';
    pose[key]=(pose[key]||0)+joint.rotation;
  }
  const world=forwardKinematics(joints,pose);
  return pieces.map(part=>{
    const joint=world[part.id],offset=turn(0,-part.pivot*part.size,joint.rotation);
    const drawing=part.switches.find(v=>v.conditions.every(([channel,value])=>(pose[channel]??0)===value));
    return {id:part.id,x:joint.x+offset.x,y:joint.y+offset.y,rotation:joint.rotation,
      tile:drawing?.tile??part.defaultTile,size:part.size,depth:part.depth};
  });
}

export function drawSpritePuppet(ctx,atlas,rig,seconds){
  const {tile,columns}=rig.doc.atlas;
  for(const p of sampleSpritePuppet(rig,seconds).sort((a,b)=>a.depth-b.depth)){
    const size=9*p.size;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*radians);
    ctx.drawImage(atlas,p.tile%columns*tile,Math.floor(p.tile/columns)*tile,tile,tile,-size/2,-size/2,size,size);
    ctx.restore();
  }
}
