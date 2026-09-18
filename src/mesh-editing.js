import {spatialKinematics} from './spatial.js';
const copy=value=>structuredClone(value);
const finite=(value,min,max,label)=>{if(!Number.isFinite(value)||value<min||value>max)throw Error(`${label} must be within ${min}..${max}.`);return value;};
const vertexAt=(mesh,index)=>{if(!Number.isInteger(index)||!mesh.vertices[index])throw Error('Choose an existing vertex.');return mesh.vertices[index];};
const influenceAt=(mesh,vertex,index)=>{const value=vertexAt(mesh,vertex).weights[index];if(!Number.isInteger(index)||!value)throw Error('Choose an existing joint influence.');return value;};
const point=(w,p)=>({x:w.x+w.m[0]*p.x+w.m[1]*p.y+w.m[2]*(p.z||0),y:w.y+w.m[3]*p.x+w.m[4]*p.y+w.m[5]*(p.z||0),z:w.z+w.m[6]*p.x+w.m[7]*p.y+w.m[8]*(p.z||0)});
const local=(w,p)=>{const x=p.x-w.x,y=p.y-w.y,z=p.z-w.z;return {x:w.m[0]*x+w.m[3]*y+w.m[6]*z,y:w.m[1]*x+w.m[4]*y+w.m[7]*z,z:w.m[2]*x+w.m[5]*y+w.m[8]*z};};
function normalize(weights){const total=weights.reduce((sum,w)=>sum+w.weight,0);weights.forEach(w=>w.weight/=total);}
/** Keep every influence positive and normalize the unedited weights together. */
export function editMeshInfluence(mesh,vertex,index,patch){
 const next=copy(mesh),weights=vertexAt(next,vertex).weights,item=influenceAt(next,vertex,index);
 for(const axis of ['x','y','z'])if(patch[axis]!==undefined)item[axis]=finite(patch[axis],-10000,10000,'Bind coordinate');
 if(patch.weight!==undefined){const weight=finite(patch.weight,.000001,1,'Weight');if(weights.length===1)item.weight=1;else{if(weight===1)throw Error('Remove the other influences before assigning full weight.');const rest=weights.reduce((sum,w,i)=>sum+(i===index?0:w.weight),0);weights.forEach((w,i)=>w.weight=i===index?weight:w.weight/rest*(1-weight));}}
 return next;
}
/** New/reassigned joints retain the same rest-space point, including rotated parents. */
export function bindMeshJoint(pack,mesh,vertex,joint,replaceIndex){
 const next=copy(mesh),weights=vertexAt(next,vertex).weights,world=spatialKinematics(pack,{}),target=world[joint];
 if(!target)throw Error('Choose an existing joint.');if(weights.some((w,i)=>w.joint===joint&&i!==replaceIndex))throw Error('That joint already influences this vertex.');
 let position;
 if(replaceIndex!==undefined)position=point(world[influenceAt(next,vertex,replaceIndex).joint],weights[replaceIndex]);
 else{if(weights.length>=4)throw Error('A vertex can have at most four joint influences.');position={x:0,y:0,z:0};for(const w of weights){const p=point(world[w.joint],w);for(const axis of ['x','y','z'])position[axis]+=p[axis]*w.weight;}}
 const coordinates=local(target,position);for(const axis of ['x','y','z'])finite(coordinates[axis],-10000,10000,'Bind coordinate');
 if(replaceIndex!==undefined)weights[replaceIndex]={...weights[replaceIndex],joint,...coordinates};
 else{weights.forEach(w=>w.weight*=.75);weights.push({joint,...coordinates,weight:.25});}
 return next;
}
export function removeMeshInfluence(mesh,vertex,index){const next=copy(mesh),weights=vertexAt(next,vertex).weights;influenceAt(next,vertex,index);if(weights.length===1)throw Error('Keep at least one influence.');weights.splice(index,1);normalize(weights);return next;}
export function setMeshVertexCorrection(mesh,corrective,vertex,offset){
 const next=copy(mesh),driver=next.correctives?.[corrective];vertexAt(next,vertex);if(!driver)throw Error('Choose an existing correction.');
 const value={vertex};for(const axis of ['x','y','z'])value[axis]=finite(offset[axis]??0,-4096,4096,'Correction offset');
 const rest=driver.offsets.filter(o=>o.vertex!==vertex);if(value.x||value.y||value.z)rest.push(value);driver.offsets=rest;return next;
}
