import {forwardKinematics,sampleClip,interpolate,clamp} from './index.js';
import {skinnedTile} from './sprite-skin.js';
import {projectSpriteJoints,viewIndex} from './sprite-projection.js';

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
    if(part.space){
      const {aim,view,bearings,z,plant,limits,twist}=part.space;
      const range=r=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[0]!==r[1];
      require(z===undefined||Number.isFinite(z),'bind Z');
      require(!aim||typeof aim==='object'&&(!aim.channel||channels[aim.channel]?.length>1&&range(aim.range)),'facing driver');
      require(!view||channels[view.channel]&&range(view.range)&&(!view.joint||parts.some(p=>p.id===view.joint)),'directional view');
      require(!bearings||range(bearings.range)&&Object.entries(bearings.images).every(([base,list])=>atlas.images.includes(base)&&Array.isArray(list)&&list.length>=2&&list.every(n=>atlas.images.includes(n))),'directional drawings');
      require(!plant||Array.isArray(plant)&&plant.length===3&&plant.every(Number.isFinite),'plant target');
      require(!twist||parts.some(p=>p.parent===part.id&&p.id===twist.to)&&Number.isFinite(twist.neutral),'twist axis');
      if(limits)for(const [axis,stops] of Object.entries(limits)){
        require(['rotation','pitch','yaw','twist'].includes(axis)&&(axis!=='twist'||twist)&&
          Array.isArray(stops)&&stops.length===2&&stops.every(Number.isFinite)&&stops[0]<=stops[1],'joint limits '+part.id+'.'+axis);
      }
    }
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
  require(parts.filter(p=>p.space?.plant).length<=1,'support foot');
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
    const spatial=parts.find(p=>p.id===joint)?.space;
    require(options||ids.has(joint)&&(['x','y','rotation','depth'].includes(property)||spatial&&['yaw','pitch','z','plant'].includes(property)||spatial?.twist&&property==='twist')&&name===joint+'.'+property,'track '+name);
    require(Array.isArray(keys)&&keys.length,'keys '+name);
    let last=-1;
    for(const [time,value,ease] of keys){
      require(Number.isFinite(time)&&time>=0&&time<=clip.duration&&time>last&&Number.isFinite(value),'key '+name);
      if(property==='plant')require(spatial?.plant&&value>=0&&value<=1,'plant weight');
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
    joints.push({id:part.id,parent:parent||null,registration:part.registration,space:part.space,...turn(pivot.x-base.x,pivot.y-base.y,-base.rotation),
      rotation:part.rotation-base.rotation,length:0});
    const skinRest=part.skin?.joints.map(id=>doc.parts.find(p=>p.id===id).rotation-doc.parts.find(p=>p.id===part.id).rotation);
    const directional=new Map(Object.entries(part.space?.bearings?.images??{}).map(([base,list])=>[doc.atlas.images.indexOf(base),list.map(image=>doc.atlas.images.indexOf(image))]));
    pieces.push({...part,skinRest,directional,defaultTile:doc.atlas.images.indexOf(part.image),
      switches:part.variants.map(v=>({conditions:Object.entries(v.when),tile:doc.atlas.images.indexOf(v.image)}))});
  }
  const stops=[],tracks={...doc.clip.tracks};
  for(const joint of joints){
    if(joint.space?.twist){
      const child=joints.find(j=>j.id===joint.space.twist.to&&j.parent===joint.id);
      if(child){
        const axis=[child.x,child.y,child.space?.z??0],length=Math.hypot(...axis);
        if(length>1e-8)joint.twistAxis=axis.map(n=>n/length);
      }
    }
    const authored=doc.parts.find(p=>p.id===joint.id);
    const parent=doc.parts.find(p=>p.id===joint.parent);
    const bindOffset=parent&&parent.id===authored.parent?joint.rotation-(authored.rotation-parent.rotation):0;
    for(const [axis,range] of Object.entries(joint.space?.limits??{})){
      const name=joint.id+'.'+axis;
      // A player may have reassembled the limb in a bent pose. Keep the
      // authored anatomical stops fixed as that bind pose changes.
      const offset=axis==='rotation'?bindOffset:0;
      const min=range[0]-offset,max=range[1]-offset;
      const keys=tracks[name]?.map(([time,value,ease])=>[time,clamp(value,min,max),ease]);
      stops.push({name,min,max,keys});delete tracks[name];
    }
  }
  return {doc,joints,pieces,stops,clip:{...doc.clip,tracks},spatial:joints.some(j=>j.space)};
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
  const elapsed=Math.max(0,seconds),pose=sampleClip(rig.clip,elapsed);
  const time=rig.clip.loop?elapsed%rig.clip.duration:Math.min(elapsed,rig.clip.duration);
  for(const {name,min,max,keys} of rig.stops){
    // Hinge travel is signed. Crossing the other side of the circle would pass
    // through a physical stop, even when the alternative arc is shorter.
    const value=overrides?.[name]??(keys?interpolate(keys,time,'smooth',false):0);
    pose[name]=clamp(value,min,max);
  }
  const headings={};
  for(const name of Object.keys(doc.channels)){
    const input=overrides?.[name]??pose[name];
    const level=Math.max(0,Math.min(doc.channels[name].length-1,input??0));
    if(input!==undefined)headings[name]=level;
    pose[name]=Math.round(level);
  }
  for(const joint of joints){
    if(joint.registration&&!rig.spatial){
      const [x,y]=joint.registration.offsets[pose[joint.registration.channel]];
      pose[joint.id+'.x']=(pose[joint.id+'.x']??0)+x;
      pose[joint.id+'.y']=(pose[joint.id+'.y']??0)+y;
    }
    const key=joint.id+'.rotation';
    pose[key]=(pose[key]||0)+joint.rotation;
  }
  const world=rig.spatial?projectSpriteJoints(rig,pose,headings):forwardKinematics(joints,pose);
  const result=pieces.map(part=>{
    const joint=world[part.id],offset=turn(0,-part.pivot*part.size*(joint.length??1),joint.rotation);
    const view=part.space?.view,bearing=(world[view?.joint]??joint).bearing;
    const selected=channel=>view?.channel===channel?viewIndex(bearing,view.range,doc.channels[channel].length):pose[channel]??0;
    const drawing=part.switches.find(v=>v.conditions.every(([channel,value])=>selected(channel)===value));
    const base=drawing?.tile??part.defaultTile,angles=part.directional.get(base);
    const layers=part.layers?.map(l=>{
      const view=l.views[selected(l.viewChannel)];
      return {channel:l.channel,x:view.x+l.width*pose[l.channel],y:view.y,
        left:view.left,top:view.top,width:l.width,height:l.height,empty:l.emptyValue===pose[l.channel]};
    });
    let deformation;
    if(part.skin){
      const angles=part.skin.joints.map((id,i)=>world[id]?Math.round(world[id].rotation-joint.rotation-part.skinRest[i]):0);
      if(angles.some(Boolean))deformation={skin:part.skin,view:selected(part.skin.viewChannel),angles};
    }
    return {id:part.id,x:joint.x+offset.x,y:joint.y+offset.y,rotation:joint.rotation,layers,deformation,
      tile:angles?angles[viewIndex(joint.bearing,part.space.bearings.range,angles.length)]:base,size:part.size,
      ...(rig.spatial?{z:joint.z,bearing:joint.bearing,stretch:joint.length}:{}),
      depth:(pose[part.id+'.depth']??part.depth)+(joint.z??0)-(joint.m?.[7]??0)*part.pivot*part.size};
  });
  for(const [i,part] of pieces.entries()){
    const weight=pose[part.id+'.plant'];
    if(!part.space?.plant||!weight)continue;
    const dx=(part.x+part.space.plant[0]*part.size-result[i].x)*weight,dy=(part.y+part.space.plant[1]*part.size-result[i].y)*weight;
    const dz=(part.space.plant[2]-result[i].z)*weight;
    for(const frame of result){frame.x+=dx;frame.y+=dy;frame.z+=dz;frame.depth+=dz;}
    break;
  }
  return result;
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
    if(p.stretch!==undefined&&Math.abs(p.stretch-1)>1e-6)ctx.scale(1,p.stretch);
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


// Pack already solved poses into a transferable list for a crowd renderer.
// Each 11-float entry selects an atlas rectangle and maps its unit square
// into the moving root's coordinate system. All actors of one bind share it.
export function compileSpriteDrawList(doc,frames,rootId,baked){
  const values=[],offsets=new Uint32Array(frames.length+1);
  const {tile,columns}=doc.atlas;
  for(let i=0;i<frames.length;i++){
    offsets[i]=values.length;
    const pose=frames[i],root=pose.find(p=>p.id===rootId);
    const angle=-root.rotation*radians,c=Math.cos(angle),s=Math.sin(angle);
    for(const p of pose){
      const dx=p.x-root.x,dy=p.y-root.y,x=c*dx-s*dy,y=s*dx+c*dy;
      const turn=(p.rotation-root.rotation)*radians,a=Math.cos(turn),b=Math.sin(turn);
      const stretch=p.stretch??1,ax=-b*stretch,ay=a*stretch;
      const size=9*p.size,scale=size/tile;
      const add=(source,sx,sy,w,h,left,top)=>{
        const u=left*scale-size/2,v=top*scale-size/2;
        values.push(source,sx,sy,w,h,a*w*scale,b*w*scale,ax*h*scale,ay*h*scale,x+a*u+ax*v,y+b*u+ay*v);
      };
      if(p.deformation){
        const region=baked?.[[p.id,p.tile,p.deformation.view,...p.deformation.angles].join('/')];
        if(!region)return null;
        add(1,...region);
      }else add(0,p.tile%columns*tile,Math.floor(p.tile/columns)*tile,tile,tile,0,0);
      for(const r of p.layers??[])if(!r.empty)add(0,r.x,r.y,r.width,r.height,r.left,r.top);
    }
  }
  offsets[frames.length]=values.length;
  return {offsets,commands:Float32Array.from(values)};
}

export function drawSpriteListFrame(ctx,list,index,atlas,cloth,side,span){
  const v=list.commands,scale=side/span,center=side/2;
  ctx.resetTransform();ctx.clearRect(0,0,side,side);
  for(let i=list.offsets[index],end=list.offsets[index+1];i<end;i+=11){
    ctx.setTransform(scale*v[i+5],scale*v[i+6],scale*v[i+7],scale*v[i+8],center+scale*v[i+9],center+scale*v[i+10]);
    ctx.drawImage(v[i]?cloth:atlas,v[i+1],v[i+2],v[i+3],v[i+4],0,0,1,1);
  }
}
