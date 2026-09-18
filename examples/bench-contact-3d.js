import {assertScene3D} from '../src/scene-3d-schema.js';

/** Stationary grip/support fixture, not a physical bench-press action.
 * Height changes rest proportions. Bench transform and named grips are scene
 * data; no renderer needs to know these joint IDs or reconstruct their depth. */
export function createBenchContact3D({height=1.75,benchPosition=[0,.45,0],benchYaw=0}={}){
 if(!Number.isFinite(height)||height<1||height>3)throw Error('Fixture height must be 1..3 meters.');
 if(!Array.isArray(benchPosition)||benchPosition.length!==3||!benchPosition.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000))throw Error('Bench position needs three finite meter coordinates within ±1000.');
 if(!Number.isFinite(benchYaw)||Math.abs(benchYaw)>Math.PI*2)throw Error('Bench yaw must be finite radians within ±2π.');
 const s=height/1.75,q=[0,Math.sin(benchYaw/2),0,Math.cos(benchYaw/2)],identity=()=>[0,0,0,1],joint=(id,parent,position)=>({id,parent,position:position.map(v=>v*s),rotation:identity()}),joints=[joint('pelvis',null,[0,0,0]),joint('torso','pelvis',[0,0,-.45]),joint('head','torso',[0,0,-.22])],chains={};
 for(const [side,sign]of [['left',-1],['right',1]]){
  joints.push(joint(side+'-shoulder','torso',[sign*.19,0,0]),joint(side+'-elbow',side+'-shoulder',[sign*.27,.14,0]),joint(side+'-wrist',side+'-elbow',[-sign*.07,.265,-.045]));
  chains[side+'-arm']={root:side+'-shoulder',middle:side+'-elbow',tip:side+'-wrist',pole:[sign*.8*s,-.15*s,-.4*s],bend:{min:.05,max:2.65}};
 }
 const offset=[Math.sin(benchYaw)*.42*s,.20*s,Math.cos(benchYaw)*.42*s],position=benchPosition.map((v,i)=>v+offset[i]);
 return assertScene3D({kind:'scene3d',schemaVersion:1,units:'meters',up:'Y',id:'bench-contact-3d',name:'Native 3D bench grip study',revision:0,rigs:{'bench-person':{joints,chains}},actors:[{id:'person',rig:'bench-person',transform:{position,rotation:q.slice(),scale:1},pose:{}}],objects:[{id:'bench',transform:{position:benchPosition.slice(),rotation:q.slice(),scale:1},geometry:{type:'box',size:[.65,.16,1.9]},anchors:{'bar-left':{position:[-.28,.60,-.20],rotation:identity()},'bar-right':{position:[.28,.60,-.20],rotation:identity()}}}],contacts:['left','right'].map(side=>({id:side+'-grip',actor:'person',chain:side+'-arm',target:{object:'bench',anchor:'bar-'+side},enabled:true})),camera:{position:[benchPosition[0]+3,benchPosition[1]+2.3,benchPosition[2]+3.5],target:[benchPosition[0],benchPosition[1]+.3,benchPosition[2]],projection:'orthographic',height:3.4}});
}
