import {forwardKinematics,sampleClip} from './index.js';
import {skinnedTile} from './sprite-skin.js';

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
  const baseHeight=Math.ceil(atlas.images.length/atlas.columns)*atlas.tile;
  require(atlas.height===undefined||Number.isInteger(atlas.height)&&atlas.height>=baseHeight,'atlas height');
  require(doc.interpolated===undefined||Array.isArray(doc.interpolated)&&doc.interpolated.every(name=>Object.hasOwn(channels,name)),'interpolated channels');
  const ids=new Set();
  require(Array.isArray(parts)&&parts.length>0,'parts');
  for(const part of parts){
    require(/^[a-zA-Z][\w-]*$/.test(part.id)&&!ids.has(part.id)&&(!part.parent||ids.has(part.parent)), 'joint '+part.id);
    ids.add(part.id);
    require([part.x,part.y,part.rotation,part.pivot,part.size,part.depth].every(Number.isFinite)&&part.size>0,'registration');
    require(atlas.images.includes(part.image)&&Array.isArray(part.variants),'drawing '+part.id);
    if(part.registration){
      const {channel,offsets}=part.registration;
      require(channels[channel]&&Array.isArray(offsets)&&offsets.length===channels[channel].length&&
        offsets.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)),'view registration '+part.id);
    }
    const layers=part.layers??[];
    require(Array.isArray(layers)&&new Set(layers.map(l=>l.channel)).size===layers.length,'layers '+part.id);
    for(const l of layers){
      require(channels[l.channel]&&channels[l.viewChannel]&&l.views?.length===channels[l.viewChannel].length,'layer channels');
      require(l.emptyValue===undefined||Number.isInteger(l.emptyValue)&&channels[l.channel][l.emptyValue]!==undefined,'empty layer value');
      require([l.width,l.height].every(n=>Number.isInteger(n)&&n>0&&n<=atlas.tile),'layer size');
      for(const v of l.views){
        require([v.x,v.y,v.left,v.top].every(Number.isInteger)&&v.x>=0&&v.y>=0&&
          v.x+l.width*channels[l.channel].length<=atlas.columns*atlas.tile&&v.y+l.height<=atlas.height,'layer strip');
      }
    }
    for(const {image,when} of part.variants){
      require(atlas.images.includes(image)&&when&&Object.entries(when).every(([name,value])=>Number.isInteger(value)&&channels[name]?.[value]!==undefined),'variant '+image);
    }
  }
  for(const part of parts){
    const skin=part.skin;
    if(!skin)continue;
    require(atlas.tile<=256&&Number.isInteger(skin.intervals)&&skin.intervals>=1&&skin.intervals<=32,'skin grid');
    require(Array.isArray(skin.joints)&&skin.joints.length>0&&skin.joints.length<=4&&skin.joints.every(id=>parts.some(p=>p.id===id&&p.parent===part.id)),'skin joints');
    require(channels[skin.viewChannel]&&Array.isArray(skin.views)&&skin.views.length===channels[skin.viewChannel].length,'skin views');
    for(const v of skin.views){
      require(Array.isArray(v.pivots)&&v.pivots.length===skin.joints.length&&v.pivots.every(p=>p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=atlas.tile)),'skin pivots');
      require(typeof v.weights==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(v.weights)&&atob(v.weights).length===(skin.intervals+1)**2*skin.joints.length,'skin weights');
    }
  }
  for(const [name,keys] of Object.entries(clip.tracks)){
    const options=channels[name];
    const [joint,property]=name.split('.');
    require(options||ids.has(joint)&&['x','y','rotation','depth'].includes(property)&&name===joint+'.'+property,'track '+name);
    require(Array.isArray(keys)&&keys.length,'keys '+name);
    let last=-1;
    for(const [time,value,ease] of keys){
      require(Number.isFinite(time)&&time>=0&&time<=clip.duration&&time>last&&Number.isFinite(value),'key '+name);
      require(options?Number.isInteger(value)&&options[value]!==undefined&&(ease==='step'||doc.interpolated?.includes(name)&&['linear','smooth'].includes(ease)):
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
    joints.push({id:part.id,parent:parent||null,registration:part.registration,...turn(pivot.x-base.x,pivot.y-base.y,-base.rotation),
      rotation:part.rotation-base.rotation,length:0});
    const skinRest=part.skin?.joints.map(id=>doc.parts.find(p=>p.id===id).rotation-doc.parts.find(p=>p.id===part.id).rotation);
    pieces.push({...part,skinRest,defaultTile:doc.atlas.images.indexOf(part.image),
      switches:part.variants.map(v=>({conditions:Object.entries(v.when),tile:doc.atlas.images.indexOf(v.image)}))});
  }
  return {doc,joints,pieces};
}

// Times at which a rounded drawing index crosses into its next registered cell.
// The DOM player can schedule exact holds without quantizing a blink to the joint bake rate.
export function spriteDrawingTimes(doc){
  const times=new Set();
  for(const channel of doc.interpolated??[]){
    const keys=doc.clip.tracks[channel]??[];
    for(let i=1;i<keys.length;i++){
      const [start,from,ease]=keys[i-1],[end,to]=keys[i],count=Math.abs(to-from);
      if(ease==='step'){times.add(end);continue;}
      for(let n=0;n<count;n++){
        const fraction=(n+.5)/count;
        // Inverse of 3u² - 2u³ on [0,1].
        const u=ease==='linear'?fraction:.5-Math.sin(Math.asin(1-2*fraction)/3);
        times.add(Math.min(end,start+(end-start)*u+1e-7));
      }
    }
  }
  return [...times].sort((a,b)=>a-b);
}

export function sampleSpritePuppet(rig,seconds,overrides){
  const {doc,joints,pieces}=rig;
  const pose=sampleClip(doc.clip,Math.max(0,seconds));
  for(const name of Object.keys(doc.channels)){
    pose[name]=Math.round(Math.max(0,Math.min(doc.channels[name].length-1,overrides?.[name]??pose[name]??0)));
  }
  for(const joint of joints){
    if(joint.registration){
      const [x,y]=joint.registration.offsets[pose[joint.registration.channel]];
      pose[joint.id+'.x']=(pose[joint.id+'.x']??0)+x;
      pose[joint.id+'.y']=(pose[joint.id+'.y']??0)+y;
    }
    const key=joint.id+'.rotation';
    pose[key]=(pose[key]||0)+joint.rotation;
  }
  const world=forwardKinematics(joints,pose);
  return pieces.map(part=>{
    const joint=world[part.id],offset=turn(0,-part.pivot*part.size,joint.rotation);
    const drawing=part.switches.find(v=>v.conditions.every(([channel,value])=>(pose[channel]??0)===value));
    const layers=part.layers?.map(l=>{
      const view=l.views[pose[l.viewChannel]];
      return {channel:l.channel,x:view.x+l.width*pose[l.channel],y:view.y,
        left:view.left,top:view.top,width:l.width,height:l.height,empty:l.emptyValue===pose[l.channel]};
    });
    let deformation;
    if(part.skin){
      const angles=part.skin.joints.map((id,i)=>world[id]?Math.round(world[id].rotation-joint.rotation-part.skinRest[i]):0);
      if(angles.some(Boolean))deformation={skin:part.skin,view:pose[part.skin.viewChannel],angles};
    }
    return {id:part.id,x:joint.x+offset.x,y:joint.y+offset.y,rotation:joint.rotation,layers,deformation,
      tile:drawing?.tile??part.defaultTile,size:part.size,depth:pose[part.id+'.depth']??part.depth};
  });
}

export function drawSpritePuppet(ctx,atlas,rig,seconds,overrides,focus){
  const pose=sampleSpritePuppet(rig,seconds,overrides).sort((a,b)=>a.depth-b.depth);
  const focused=focus&&pose.find(p=>p.id===focus);
  ctx.save();
  if(focused)ctx.translate(-focused.x,-focused.y);
  drawSpriteFrame(ctx,atlas,rig.doc,pose);
  ctx.restore();
}

// The host can share sampled, depth-sorted poses across identical bind poses.
export function drawSpriteFrame(ctx,atlas,doc,pose,baked){
  const {tile,columns}=doc.atlas;
  for(const p of pose){
    const size=9*p.size;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*radians);
    const region=p.deformation&&baked?.frames[[p.id,p.tile,p.deformation.view,...p.deformation.angles].join('/')];
    if(region){
      const [x,y,w,h,left,top]=region,scale=size/tile;
      ctx.drawImage(baked.image,x,y,w,h,left*scale-size/2,top*scale-size/2,w*scale,h*scale);
    }else if(p.deformation){
      const {canvas,left,top}=skinnedTile(atlas,doc,p),scale=size/tile;
      ctx.drawImage(canvas,left*scale-size/2,top*scale-size/2,canvas.width*scale,canvas.height*scale);
    }else ctx.drawImage(atlas,p.tile%columns*tile,Math.floor(p.tile/columns)*tile,tile,tile,-size/2,-size/2,size,size);
    for(const r of p.layers??[]){
      if(r.empty)continue;
      const scale=size/tile;
      ctx.drawImage(atlas,r.x,r.y,r.width,r.height,r.left*scale-size/2,r.top*scale-size/2,r.width*scale,r.height*scale);
    }
    ctx.restore();
  }
}
