import {apply,axisRotation,mul,rad} from './joint-matrix.js';

// Shapes are authored relative to the joint socket, in units of part size.
export function collisionSpheres(part,joint){
  return part.space.collision.spheres.map(([x,y,z,r])=>{
    const p=apply(joint.m,x*part.size,y*part.size,z*part.size);
    return {x:joint.x+p.x,y:joint.y+p.y,z:joint.z+p.z,r:r*part.size};
  });
}

function descends(part,id,byId){
  while(part&&part.id!==id)part=byId.get(part.parent);
  return !!part;
}

export function compileSpriteContacts(parts){
  const byId=new Map(parts.map(p=>[p.id,p])),groups=new Map();
  for(const part of parts){
    const rule=part.space?.collision?.avoid;
    if(!rule)continue;
    const target=byId.get(rule.target),pivot=byId.get(rule.pivot);
    if(!target||!pivot||!descends(part,pivot.id,byId)||descends(target,pivot.id,byId))continue;
    const key=JSON.stringify([pivot.id,target.id,rule.side]);
    if(!groups.has(key))groups.set(key,{pivot,target,sign:rule.side==='behind'?-1:1,
      movers:[],branch:parts.filter(p=>descends(p,pivot.id,byId))});
    groups.get(key).movers.push(part);
  }
  return [...groups.values()];
}

// Rotate a whole limb about its shoulder, preserving the authored socket-to-
// socket distances and the relative bend and twist of all descendant joints.
export function solveSpriteContacts(groups,world){
  for(const {pivot,target,sign,movers,branch} of groups){
    const origin=world[pivot.id],solid=collisionSpheres(target,world[target.id]);
    const probes=movers.flatMap(part=>collisionSpheres(part,world[part.id]));
    // Pitch in the plane of the upper arm so the sleeve keeps its painted
    // exit angle. A folded forearm can put the hand on the other side of it.
    const tip=probes.at(-1),dx=origin.m[1],dy=origin.m[4],len=Math.hypot(dx,dy);
    const direction=((tip.x-origin.x)*dx+(tip.y-origin.y)*dy<0?-1:1)*sign;
    const axis=len>1e-6?[direction*dy/len,-direction*dx/len,0]:[sign,0,0];
    function clearance(angle){
      const m=angle&&axisRotation(axis,angle);
      let gap=Infinity;
      for(const p of probes){
        const d=m&&apply(m,p.x-origin.x,p.y-origin.y,p.z-origin.z);
        const x=m?origin.x+d.x:p.x,y=m?origin.y+d.y:p.y,z=m?origin.z+d.z:p.z;
        for(const q of solid){
          const sx=x-q.x,sy=y-q.y,sz=Math.max(0,sign*(z-q.z)),r=p.r+q.r;
          gap=Math.min(gap,sx*sx+sy*sy+sz*sz-r*r);
        }
      }
      return gap;
    }
    if(clearance(0)<0){
      let lo=0,hi=5;
      while(hi<85&&clearance(hi)<0){lo=hi;hi+=5;}
      if(clearance(hi)>=0){
        for(let i=0;i<10;i++){
          const mid=(lo+hi)/2;
          if(clearance(mid)<0)lo=mid;else hi=mid;
        }
        const m=axisRotation(axis,hi);
        for(const part of branch){
          const p=world[part.id],v=apply(m,p.x-origin.x,p.y-origin.y,p.z-origin.z);
          p.x=origin.x+v.x;p.y=origin.y+v.y;p.z=origin.z+v.z;p.m=mul(m,p.m);
          p.length=Math.hypot(p.m[1],p.m[4]);
          if(p.length>1e-6)p.rotation=Math.atan2(-p.m[1],p.m[4])/rad;
          p.bearing=Math.atan2(-p.m[6],p.m[8])/rad;
        }
      }else for(const part of movers)world[part.id].contactBlocked=true;
    }
    for(const part of movers){
      const probes=collisionSpheres(part,world[part.id]);
      if(probes.some(p=>solid.some(q=>(p.x-q.x)**2+(p.y-q.y)**2<=(p.r+q.r+.2*part.size)**2)))
        world[part.id].contactOrder={target:target.id,sign};
    }
  }
}
