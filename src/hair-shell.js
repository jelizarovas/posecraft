// Opaque ellipsoid cap. Cached topology and clipped boundaries avoid fading,
// interior mesh strokes and rebuilding the surface for every animation frame.
const cache=new WeakMap();
function mesh(shell,style){
 let styles=cache.get(shell);if(!styles){styles=new Map();cache.set(shell,styles);}if(styles.has(style))return styles.get(style);
 const rx=shell.width,ry=shell.height,rz=shell.depth,around=32,rings=6,vertices=[{id:0,x:0,y:shell.y-ry,z:0,nx:0,ny:-1/ry,nz:0}],grid=[Array(around).fill(0)],faces=[];
 for(let r=1;r<=rings;r++){const row=[];for(let i=0;i<around;i++){const theta=i*Math.PI*2/around,front=(1+Math.cos(theta))/2,fringe=(style==='curls'?Math.sin(theta*9)*.12:style==='swept'?Math.sin(theta)*.12:Math.sin(theta*3)*.025)*front,phi=r/rings*(2.62-.98*front+fringe),x=rx*Math.sin(phi)*Math.sin(theta),y=-ry*Math.cos(phi),z=rz*Math.sin(phi)*Math.cos(theta),id=vertices.length;vertices.push({id,x,y:y+shell.y,z,nx:x/(rx*rx),ny:y/(ry*ry),nz:z/(rz*rz)});row.push(id);}grid.push(row);}
 for(let r=0;r<rings;r++)for(let i=0;i<around;i++){const n=(i+1)%around;faces.push([...new Set([grid[r][i],grid[r][n],grid[r+1][n],grid[r+1][i]])]);}
 const value={vertices,faces};styles.set(style,value);return value;
}
export function hairShellPath(shell,m,style='short'){
 const source=mesh(shell,style),count=source.vertices.length,vertices=source.vertices.map(p=>({...p,n:m[6]*p.nx+m[7]*p.ny+m[8]*p.nz})),crossings=new Map(),edges=new Map();
 const crossing=(a,b)=>{const id=-(Math.min(a.id,b.id)*count+Math.max(a.id,b.id)+1);let p=crossings.get(id);if(!p){const t=a.n/(a.n-b.n);p={id,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};crossings.set(id,p);}return p;};
 const add=(a,b)=>{if(a.id===b.id)return;const key=a.id<b.id?a.id+','+b.id:b.id+','+a.id;if(edges.has(key))edges.delete(key);else edges.set(key,{a,b});};
 for(const face of source.faces){const clipped=[];for(let i=0;i<face.length;i++){const a=vertices[face[i]],b=vertices[face[(i+1)%face.length]],inside=a.n>=0,next=b.n>=0;if(inside)clipped.push(a);if(inside!==next)clipped.push(crossing(a,b));}for(let i=0;i<clipped.length;i++)add(clipped[i],clipped[(i+1)%clipped.length]);}
 const links=new Map();for(const e of edges.values())for(const p of [e.a,e.b]){if(!links.has(p.id))links.set(p.id,[]);links.get(p.id).push(e);}
 const used=new Set(),project=p=>[(m[0]*p.x+m[1]*p.y+m[2]*p.z).toFixed(4),(m[3]*p.x+m[4]*p.y+m[5]*p.z).toFixed(4)].join(' ');let path='';
 for(const first of edges.values()){if(used.has(first))continue;let edge=first,k=first.a.id;path+='M'+project(first.a);while(edge&&!used.has(edge)){used.add(edge);const p=edge.a.id===k?edge.b:edge.a;k=p.id;path+='L'+project(p);edge=links.get(k)?.find(e=>!used.has(e));}path+='Z';}return path||'M0 0';
}
