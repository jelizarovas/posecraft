import {Float32BufferAttribute} from 'three';

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const aliases={blink:['blink','eyeBlinkLeft','eyeBlinkRight'],strain:['strain','browDownLeft','browDownRight'],happy:['happy','mouthSmileLeft','mouthSmileRight'],tired:['tired'],surprise:['surprise','browInnerUp'],breath:['breath','jawOpen']};
/** Facial controls deform the imported surfaces before skinning. Existing GLTF
 * morphs take precedence; the bundled eye/brow meshes have a small calibrated
 * control set. Unrecognized artwork is left untouched. */
export function createFaceControls3D(root){
 const bindings=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(!mesh.morphTargetInfluences?.length&&['Eyes','Eyebrows'].includes(mesh.name)){
   const geometry=mesh.geometry,p=geometry.attributes.position;geometry.computeBoundingBox();
   const {min,max}=geometry.boundingBox,h=max.y-min.y,w=max.x-min.x,midY=(max.y+min.y)/2,midX=(max.x+min.x)/2;
   const controls=mesh.name==='Eyes'?['blink','tired','happy']:['strain','happy','tired','surprise'];
   geometry.morphTargetsRelative=true;geometry.morphAttributes.position=controls.map(name=>{
    const values=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
     const x=p.getX(i)-midX,y=p.getY(i)-midY,inner=1-Math.min(1,Math.abs(x)/(w*.5));
     let dy=0;
     if(mesh.name==='Eyes')dy=-y*(name==='blink'?.97:name==='tired'?.48:.25);
     else if(name==='strain')dy=h*(.2-inner*.7);
     else if(name==='happy')dy=h*(.28+inner*.13);
     else if(name==='tired')dy=h*(inner*.32-.18);
     else dy=h*.55;
     values[i*3+1]=dy;
    }
    const attribute=new Float32BufferAttribute(values,3);attribute.name=name;return attribute;
   });mesh.updateMorphTargets();
  }
  if(mesh.morphTargetInfluences)for(const [control,names] of Object.entries(aliases))for(const name of names){const index=mesh.morphTargetDictionary?.[name];if(index!==undefined)bindings.push({mesh,index,control});}
 });
 return {controls:[...new Set(bindings.map(b=>b.control))],apply(face={}){for(const b of bindings)b.mesh.morphTargetInfluences[b.index]=clamp(face[b.control])*(b.mesh.name==='Eyes'&&b.control!=='blink'?1-clamp(face.blink):1);}};
}

/** Absolute-time acting is deterministic when seeking or sampling in a worker. */
export function workoutFace3D(frame,time,stats={}){
 const phase=frame.phase||'',exercise=/pull|press|stall|attempt/.test(phase),rest=/rest|recover/.test(phase),fatigue=clamp((stats.fatigue||0)/100);
 const effort=clamp(frame.expression?.strain??frame.exertion?.intensity??(exercise?frame.effort:0));
 const cycle=((time%4.7)+4.7)%4.7,blink=cycle<.17?Math.sin(cycle/.17*Math.PI)**2:0;
 return {blink,strain:effort*.9,happy:/release|complete/.test(phase)?(.3*(1-fatigue)):0,tired:fatigue*(rest?.8:.45),surprise:0,breath:clamp((.2+fatigue*.55+effort*.25)*(.5+.5*Math.sin(time*(rest?4.2:3.2))))};
}
