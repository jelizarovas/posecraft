import {I,rad,mul,apply,rotationMatrix,axisRotation} from './joint-matrix.js';

const camera={x:0,y:0,z:0,rotation:0,bearing:0,m:I};
export function viewIndex(angle,range,count){
  return Math.round(Math.max(0,Math.min(1,(angle-range[0])/(range[1]-range[0])))*(count-1));
}

export function projectSpriteJoints(rig,pose,headings){
  const world={};
  for(const joint of rig.joints){
    const parent=world[joint.parent]??camera,id=joint.id,space=joint.space??{};
    const roll=pose[id+'.rotation'],yaw=pose[id+'.yaw']??0,pitch=pose[id+'.pitch']??0;
    let m;
    if(space.aim){
      // An aimed wrist or head can hold its facing as the chest turns.
      const {channel,range}=space.aim;
      const heading=channel&&headings[channel]!==undefined?range[0]+(range[1]-range[0])*headings[channel]/(rig.doc.channels[channel].length-1):0;
      m=rotationMatrix({rotation:parent.rotation+roll,yaw:heading+yaw,pitch});
    }else m=mul(parent.m,rotationMatrix({rotation:roll,yaw,pitch}));
    if(joint.twistAxis)m=mul(m,axisRotation(joint.twistAxis,(space.twist.neutral??0)+(pose[id+'.twist']??0)));
    const x=joint.x+(pose[id+'.x']??0),y=joint.y+(pose[id+'.y']??0);
    const offset=apply(parent.m,x,y,(space.z??0)+(pose[id+'.z']??0));
    if(joint.registration){
      // These sockets are measured in the parent drawing. The 3D bone still
      // supplies their depth, including the far shoulder during a profile turn.
      const {channel,offsets}=joint.registration;
      const range=parent.view?.channel===channel?parent.view.range:undefined;
      const index=headings[channel]===undefined?0:range?viewIndex(parent.bearing,range,offsets.length):Math.round(pose[channel]??0);
      const [dx,dy]=offsets[index],r=parent.rotation*rad;
      // The drawing includes horizontal foreshortening. Recover physical depth
      // from the frontal socket before applying the measured screen correction.
      const front=range?viewIndex(0,range,offsets.length):0;
      offset.z+=parent.m[6]*offsets[front][0]+parent.m[7]*offsets[front][1];
      offset.x=(x+dx)*Math.cos(r)-(y+dy)*Math.sin(r);
      offset.y=(x+dx)*Math.sin(r)+(y+dy)*Math.cos(r);
    }
    const length=Math.hypot(m[1],m[4]);
    world[id]={x:parent.x+offset.x,y:parent.y+offset.y,z:parent.z+offset.z,m,view:space.view,
      rotation:length>1e-6?Math.atan2(-m[1],m[4])/rad:parent.rotation,length,
      bearing:Math.atan2(-m[6],m[8])/rad};
  }
  return world;
}
