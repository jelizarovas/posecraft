import {groundHeight} from './map-art-layout.js';

const RAIL_HEIGHTS=[.28,.62];
const POST_HEIGHT=.9;
const COLLISION_THICKNESS=.14;
const projectMap=(map,p)=>({x:(p.x-p.y)*map.tileSize.width/2,y:(p.x+p.y)*map.tileSize.height/2-(p.z??groundHeight(map,p))*map.tileSize.height});
const timberPatterns=new WeakMap();
const ownedPostCache=new WeakMap();
const raised=(map,node,height)=>({...node,z:groundHeight(map,node)+height});

export function isMapFence(prop){return !!prop?.fence;}

export function fenceWorldNodes(prop){return prop.fence.nodes.map(node=>({x:prop.x+node.x,y:prop.y+node.y}));}

/** Topology posts plus evenly spaced supports. Endpoints are keyed once across every link. */
function rawFenceWorldPosts(prop){
 const nodes=fenceWorldNodes(prop),posts=new Map(nodes.map(node=>[`${node.x}:${node.y}`,node]));
 for(const [from,to] of prop.fence.links){const a=nodes[from],b=nodes[to],length=Math.hypot(b.x-a.x,b.y-a.y),spans=Math.max(1,Math.ceil(length/2));for(let i=1;i<spans;i++){const t=i/spans,node={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};posts.set(`${node.x}:${node.y}`,node);}}
 return [...posts.values()];
}
export function fenceWorldPosts(prop,map){
 const posts=rawFenceWorldPosts(prop);if(!map)return posts;
 let cache=ownedPostCache.get(map);
 if(!cache){
  cache=new Map();const owners=new Map();
  for(const candidate of map.props.filter(value=>value.fence).sort((a,b)=>a.id.localeCompare(b.id)))for(const post of rawFenceWorldPosts(candidate)){const key=`${post.x}:${post.y}`;if(!owners.has(key))owners.set(key,candidate.id);}
  for(const candidate of map.props.filter(value=>value.fence))cache.set(candidate.id,rawFenceWorldPosts(candidate).filter(post=>owners.get(`${post.x}:${post.y}`)===candidate.id));
  ownedPostCache.set(map,cache);
 }
 return cache.get(prop.id)||posts;
}

export function fenceCollisionParts(prop){
 const nodes=fenceWorldNodes(prop),half=COLLISION_THICKNESS/2;
 return prop.fence.links.map(([from,to])=>{
  const a=nodes[from],b=nodes[to];
  return Math.abs(a.x-b.x)<1e-8
   ?{shape:'rect',x:a.x-half,y:Math.min(a.y,b.y),width:COLLISION_THICKNESS,height:Math.abs(b.y-a.y)}
   :{shape:'rect',x:Math.min(a.x,b.x),y:a.y-half,width:Math.abs(b.x-a.x),height:COLLISION_THICKNESS};
 });
}

export function mapFenceBounds(map,prop){
 const nodes=fenceWorldNodes(prop),scale=map.tileSize.width/64,points=[];
 for(const node of nodes){points.push(projectMap(map,node),projectMap(map,raised(map,node,POST_HEIGHT)));}
 const left=Math.min(...points.map(p=>p.x))-6*scale,right=Math.max(...points.map(p=>p.x))+6*scale;
 const top=Math.min(...points.map(p=>p.y))-5*scale,bottom=Math.max(...points.map(p=>p.y))+5*scale;
 return{x:left,y:top,width:right-left,height:bottom-top};
}

function stroke(ctx,a,b,color,width){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
function post(ctx,map,node,scale,timber){
 const foot=projectMap(map,node),top=projectMap(map,raised(map,node,POST_HEIGHT));
 const left=2.5*scale,right=2.3*scale,bevel=1.2*scale;
 ctx.beginPath();ctx.moveTo(top.x-left,top.y+bevel);ctx.lineTo(top.x+right,top.y);ctx.lineTo(foot.x+right,foot.y);ctx.lineTo(foot.x-left,foot.y+bevel);ctx.closePath();ctx.fillStyle=timber||'#75604a';ctx.fill();ctx.strokeStyle='#49372b';ctx.lineWidth=.8*scale;ctx.stroke();
 ctx.beginPath();ctx.moveTo(top.x-left,top.y+bevel);ctx.lineTo(top.x-bevel,top.y-bevel);ctx.lineTo(top.x+right,top.y);ctx.lineTo(top.x+.4*scale,top.y+2.1*scale);ctx.closePath();ctx.fillStyle='#ad936d';ctx.fill();ctx.strokeStyle='#49372b';ctx.stroke();
 stroke(ctx,{x:top.x-left+.8*scale,y:top.y+bevel},{x:foot.x-left+.8*scale,y:foot.y},'#b29a75aa',.8*scale);
}

/** Draw projected timber. Posts belong to graph nodes, so a corner or divider never stacks duplicate posts. */
export function drawMapFence(ctx,map,prop,art,part){
 const nodes=part?.nodes??fenceWorldNodes(prop),scale=map.tileSize.width/64;
 const source=art?.image?.('farm-fence-timber');let timber=source&&timberPatterns.get(ctx);
 if(source&&!timber){timber=ctx.createPattern(source,'repeat');timber?.setTransform?.({a:32/source.naturalWidth,d:32/source.naturalHeight,b:0,c:0,e:0,f:0});if(timber)timberPatterns.set(ctx,timber);}
 for(const [from,to] of part?.links??prop.fence.links){
  const a=nodes[from],b=nodes[to];
  for(const height of RAIL_HEIGHTS){
   const p=projectMap(map,raised(map,a,height)),q=projectMap(map,raised(map,b,height));
   stroke(ctx,{x:p.x+1.6*scale,y:p.y+2.2*scale},{x:q.x+1.6*scale,y:q.y+2.2*scale},'#403127',5.8*scale);
   stroke(ctx,p,q,timber||(height>.5?'#80694f':'#725c45'),5.1*scale);
   stroke(ctx,{x:p.x,y:p.y-1.1*scale},{x:q.x,y:q.y-1.1*scale},'#b19a73',1.1*scale);
   const length=Math.hypot(q.x-p.x,q.y-p.y),marks=Math.max(1,Math.floor(length/(30*scale)));
   for(let i=1;i<=marks;i++){const t=i/(marks+1),x=p.x+(q.x-p.x)*t,y=p.y+(q.y-p.y)*t;stroke(ctx,{x:x-1.2*scale,y:y-1.4*scale},{x:x+1.2*scale,y:y+1.1*scale},'#59453599',.7*scale);}
  }
 }
 for(const node of part?.posts??fenceWorldPosts(prop,map).sort((a,b)=>a.x+a.y-b.x-b.y))post(ctx,map,node,scale,timber);
}

/** Small ground-space draw pieces let long rails pass behind and in front of other props. */
export function fenceRenderParts(map,prop){
 const nodes=fenceWorldNodes(prop),parts=[];
 const append=part=>{const points=part.nodes.length?part.nodes:part.posts;const bounds=mapFenceBounds(map,{x:0,y:0,fence:{nodes:points}});parts.push({...part,bounds,depth:points.reduce((sum,p)=>sum+p.x+p.y,0)/points.length});};
 for(const [from,to]of prop.fence.links){
  const a=nodes[from],b=nodes[to],count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2));
  const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  for(let i=0;i<count;i++)append({nodes:[at(i/count),at((i+1)/count)],links:[[0,1]],posts:[]});
 }
 for(const node of fenceWorldPosts(prop,map))append({nodes:[],links:[],posts:[node]});
 return parts;
}

export function drawMapFenceShadow(ctx,map,prop){
 const nodes=fenceWorldNodes(prop),scale=map.tileSize.width/64;
 ctx.save();ctx.globalAlpha=.2;
 for(const [from,to] of prop.fence.links){const a=projectMap(map,nodes[from]),b=projectMap(map,nodes[to]);stroke(ctx,{x:a.x+10*scale,y:a.y+4*scale},{x:b.x+10*scale,y:b.y+4*scale},'#18281c',6*scale);}
 for(const node of nodes){const p=projectMap(map,node);ctx.beginPath();ctx.ellipse(p.x+5*scale,p.y+2*scale,7*scale,2.7*scale,.15,0,Math.PI*2);ctx.fillStyle='#18281c';ctx.fill();}
 ctx.restore();
}

export function fencePiece(id,label,connections){
 const directions={n:[.5,0],e:[1,.5],s:[.5,1],w:[0,.5]},nodes=[{x:.5,y:.5}],links=[];
 if(connections.length===2&&((connections.includes('n')&&connections.includes('s'))||(connections.includes('e')&&connections.includes('w')))){
  return{id,label,prop:{kind:'decoration',width:1,height:1,fence:{nodes:connections.map(direction=>({x:directions[direction][0],y:directions[direction][1]})),links:[[0,1]]}}};
 }
 for(const direction of connections){nodes.push({x:directions[direction][0],y:directions[direction][1]});links.push([0,nodes.length-1]);}
 return{id,label,prop:{kind:'decoration',width:1,height:1,fence:{nodes,links}}};
}
