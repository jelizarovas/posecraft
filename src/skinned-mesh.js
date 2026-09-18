const limits={vertices:512,triangles:1024,weights:4,correctives:32,offsets:2048};
const topologyCache=new WeakMap(),identity=[1,0,0,0,1,0,0,0,1],epsilon=1e-9;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=value=>Math.max(0,Math.min(1,value));
const point=(m,x,y,z)=>({x:m[0]*x+m[1]*y+m[2]*z,y:m[3]*x+m[4]*y+m[5]*z,z:m[6]*x+m[7]*y+m[8]*z});
const number=value=>String(+value.toFixed(4));
const pair=p=>number(p.x)+' '+number(p.y);
const path=(vertices,indices,closed=false)=>'M'+indices.map(i=>pair(vertices[i])).join('L')+(closed?'Z':'');

function topology(mesh){
 const old=topologyCache.get(mesh);
 if(old&&old.vertexCount===mesh.vertices.length&&old.triangles.length===mesh.triangles.length&&old.triangles.every((t,i)=>t.every((n,j)=>n===mesh.triangles[i][j])&&mesh.triangles[i].length===3))return old.edges;
 const edges=new Map();
 mesh.triangles.forEach((triangle,face)=>{
  if(triangle.length!==3||new Set(triangle).size!==3||triangle.some(i=>!Number.isInteger(i)||i<0||i>=mesh.vertices.length))throw new RangeError('Mesh triangles must reference three distinct existing vertices.');
  for(let k=0;k<3;k++){const a=triangle[k],b=triangle[(k+1)%3],indices=a<b?[a,b]:[b,a],id=indices.join(':');let edge=edges.get(id);if(!edge){edge={indices,faces:[]};edges.set(id,edge);}edge.faces.push(face);}
 });
 const result=[...edges.values()];topologyCache.set(mesh,{vertexCount:mesh.vertices.length,triangles:mesh.triangles.map(t=>[...t]),edges:result});return result;
}

/** Evaluate a joint-weighted mesh in actor coordinates. Physical z shapes the
 * surface; authored joint layer depth affects drawing order without distorting it. */
export function evaluateSkinnedMesh(mesh,world,pose={}){
 if(!mesh||!Array.isArray(mesh.vertices)||!Array.isArray(mesh.triangles)||mesh.vertices.length>limits.vertices||mesh.triangles.length>limits.triangles)throw new RangeError('Mesh exceeds its bounded vertex or triangle budget.');
 const edges=topology(mesh),vertices=mesh.vertices.map(vertex=>{
  if(!Array.isArray(vertex.weights)||!vertex.weights.length||vertex.weights.length>limits.weights)throw new RangeError('Mesh vertices require one to four joint weights.');
  let x=0,y=0,z=0,layer=0,total=0;
  for(const weight of vertex.weights){const joint=world[weight.joint];if(!joint)throw new RangeError('Missing mesh joint '+weight.joint);if(![weight.x,weight.y,weight.z??0,weight.weight].every(finite)||weight.weight<0)throw new RangeError('Mesh weights and local coordinates must be finite and nonnegative weights.');const p=point(joint.m||identity,weight.x,weight.y,weight.z??0),w=weight.weight;x+=(joint.x+p.x)*w;y+=(joint.y+p.y)*w;z+=((joint.z||0)+p.z)*w;layer+=(joint.layerDepth||0)*w;total+=w;}
  if(total<=epsilon)throw new RangeError('Mesh vertex weights must have positive total weight.');return {x:x/total,y:y/total,z:z/total,depth:(z+layer)/total};
 });
 const correctives=mesh.correctives||[];if(correctives.length>limits.correctives||correctives.reduce((n,c)=>n+c.offsets.length,0)>limits.offsets)throw new RangeError('Mesh exceeds its corrective budget.');
 for(const corrective of correctives){const joint=world[corrective.joint];if(!joint||!finite(corrective.min)||!finite(corrective.max)||corrective.max<=corrective.min)throw new RangeError('Mesh corrective needs a joint and increasing finite limits.');let amount=clamp(((pose[corrective.joint+'.'+corrective.channel]??0)-corrective.min)/(corrective.max-corrective.min));amount=amount*amount*(3-2*amount);
  for(const offset of corrective.offsets){if(!Number.isInteger(offset.vertex)||!vertices[offset.vertex]||![offset.x??0,offset.y??0,offset.z??0].every(finite))throw new RangeError('Mesh corrective offsets must reference finite vertex displacements.');if(!amount)continue;const delta=point(joint.m||identity,offset.x??0,offset.y??0,offset.z??0),vertex=vertices[offset.vertex];vertex.x+=delta.x*amount;vertex.y+=delta.y*amount;vertex.z+=delta.z*amount;vertex.depth+=delta.z*amount;}
 }
 const faces=mesh.triangles.map((indices,index)=>{
  const [a,b,c]=indices.map(i=>vertices[i]),u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},normal={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x},length=Math.hypot(normal.x,normal.y,normal.z),facing=Math.abs(normal.z)<=epsilon*Math.max(1,length)?0:Math.sign(normal.z);
  return {index,indices:[...indices],d:path(vertices,indices,true),depth:(a.depth+b.depth+c.depth)/3,frontFacing:facing>0,facing,visible:facing!==0,normal:length>epsilon?{x:normal.x/length,y:normal.y/length,z:normal.z/length}:{x:0,y:0,z:0}};
 });
 const outlines=[];let silhouettePath='',boundaryPath='',creasePath='';
 for(const edge of edges){const adjacent=edge.faces.map(index=>faces[index]);let kind;
  if(adjacent.length===1)kind='boundary';else if(adjacent.some(face=>face.facing>0)&&adjacent.some(face=>face.facing<0))kind='silhouette';
  else if(finite(mesh.creaseAngle)&&mesh.creaseAngle>=0&&mesh.creaseAngle<180&&adjacent.length===2){const a=adjacent[0].normal,b=adjacent[1].normal,cosine=Math.max(-1,Math.min(1,a.x*b.x+a.y*b.y+a.z*b.z));if(Math.acos(cosine)*180/Math.PI>mesh.creaseAngle+1e-7)kind='crease';}
  const [a,b]=edge.indices.map(i=>vertices[i]),visible=!!kind&&Math.hypot(b.x-a.x,b.y-a.y)>=epsilon,d=path(vertices,edge.indices);outlines.push({id:edge.indices.join('-'),indices:[...edge.indices],faces:[...edge.faces],kind:kind||'internal',visible,d,depth:(a.depth+b.depth)/2+.01});if(!visible)continue;if(kind==='crease')creasePath+=d;else silhouettePath+=d;if(kind==='boundary')boundaryPath+=d;
 }
 const bounds=vertices.length?{minX:Math.min(...vertices.map(v=>v.x)),minY:Math.min(...vertices.map(v=>v.y)),minZ:Math.min(...vertices.map(v=>v.z)),maxX:Math.max(...vertices.map(v=>v.x)),maxY:Math.max(...vertices.map(v=>v.y)),maxZ:Math.max(...vertices.map(v=>v.z))}:{minX:0,minY:0,minZ:0,maxX:0,maxY:0,maxZ:0};
 return {vertices,faces,edges:outlines,silhouettePath,boundaryPath,creasePath,bounds};
}
