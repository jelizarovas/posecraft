// Opaque styled cap. Cached topology and clipped boundaries avoid fading,
// interior mesh strokes and rebuilding the surface for every animation frame.
const cache=new WeakMap();
const profiles={
 short:{front:1.10,back:2.23,crown:1.01},
 swept:{front:1.13,back:2.32,crown:1.10},
 curls:{front:1.20,back:2.40,crown:1.12},
 bob:{front:1.22,back:2.67,crown:1.03},
 ponytail:{front:1.06,back:2.27,crown:1.02}
};
function mesh(shell,style){
 style=Object.hasOwn(profiles,style)?style:'short';
 let styles=cache.get(shell);if(!styles){styles=new Map();cache.set(shell,styles);}if(styles.has(style))return styles.get(style);
 const profile=profiles[style],rx=shell.width,ry=shell.height,rz=shell.depth,around=40,rings=style==='curls'?12:8;
 const vertices=[{id:0,x:0,y:shell.y-ry*profile.crown,z:0,nx:0,ny:-1/ry,nz:0,n:0}],grid=[Array(around).fill(0)],faces=[];
 for(let r=1;r<=rings;r++){
  const row=[];
  for(let i=0;i<around;i++){
   const theta=i*Math.PI*2/around,c=Math.cos(theta),s=Math.sin(theta),front=(1+c)/2,frontWeight=front**1.5;
   // The forehead stays open. Side sections descend toward the temples and nape.
   let edge=profile.back+(profile.front-profile.back)*frontWeight;
   if(style==='short')edge+=.042*Math.cos(theta*5+.5)*frontWeight;
   if(style==='swept')edge+=(.25*s-.06*Math.cos(theta*2))*frontWeight;
   if(style==='curls')edge+=.105*Math.cos(theta*10+.4)*frontWeight;
   if(style==='bob')edge+=.38*s*s-.035*Math.cos(theta*3)*frontWeight;
   if(style==='ponytail')edge+=.075*Math.cos(theta*2)*frontWeight;
   const phi=r/rings*edge,sp=Math.sin(phi),cp=Math.cos(phi),ring=Math.sin(Math.min(Math.PI,phi));
   // Broad clumps change the outside contour, rather than adding painted detail
   // or separate front/back layers that would pop as the head turns.
   let volume=1,crown=profile.crown,sweep=0;
   if(style==='short')volume+=.027*Math.cos(theta*6+.6)*Math.sqrt(ring);
   if(style==='swept'){
    const crestHeight=phi-.45,crest=((1-s)/2)**2*Math.exp(-crestHeight*crestHeight/.16);
    crown+=.32*crest;sweep=-rx*.09*Math.sin(phi)*Math.max(0,cp);volume+=.035*Math.sin(theta*3)*ring;
   }
   if(style==='curls'){volume+=(.045*(1+Math.cos(theta*10+.8*Math.sin(phi*2)))+.065*(1+Math.cos(phi*12)))*Math.sqrt(ring);crown*=volume;}
   if(style==='bob')volume+=.035*Math.cos(theta*5)*ring*.5;
   if(style==='ponytail')volume+=.075*(1-front)*ring;
   const exponent=style==='curls'?.85:.60,radius=sp**exponent,normalRadius=sp**(2-exponent),x=rx*radius*s*volume+sweep,y=-ry*cp*crown,z=rz*radius*c*volume,id=vertices.length;
   // The smooth carrier normal keeps visibility clipping continuous across
   // decorative lobes. It avoids holes and overlapping stroked mesh islands.
   vertices.push({id,x,y:y+shell.y,z,nx:normalRadius*s/rx,ny:-cp/ry,nz:normalRadius*c/rz,n:0});row.push(id);
  }
  grid.push(row);
 }
 for(let r=0;r<rings;r++)for(let i=0;i<around;i++){const n=(i+1)%around;faces.push([...new Set([grid[r][i],grid[r][n],grid[r+1][n],grid[r+1][i]])]);}
 const value={vertices,faces};styles.set(style,value);return value;
}
export function hairShellPath(shell,m,style='short'){
 const source=mesh(shell,style);if(source.lastMatrix?.every((v,i)=>v===m[i]))return source.lastPath;
 const count=source.vertices.length,vertices=source.vertices,crossings=new Map(),edges=new Map();
 // Visibility distances are private scratch values on the cached mesh.
 for(const p of vertices)p.n=m[6]*p.nx+m[7]*p.ny+m[8]*p.nz;
 const crossing=(a,b)=>{const id=-(Math.min(a.id,b.id)*count+Math.max(a.id,b.id)+1);let p=crossings.get(id);if(!p){const t=a.n/(a.n-b.n);p={id,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};crossings.set(id,p);}return p;};
 const add=(a,b)=>{if(a.id===b.id)return;const key=a.id<b.id?a.id+','+b.id:b.id+','+a.id;if(edges.has(key))edges.delete(key);else edges.set(key,{a,b});};
 for(const face of source.faces){const clipped=[];for(let i=0;i<face.length;i++){const a=vertices[face[i]],b=vertices[face[(i+1)%face.length]],inside=a.n>=0,next=b.n>=0;if(inside)clipped.push(a);if(inside!==next)clipped.push(crossing(a,b));}for(let i=0;i<clipped.length;i++)add(clipped[i],clipped[(i+1)%clipped.length]);}
 const links=new Map();for(const e of edges.values())for(const p of [e.a,e.b]){if(!links.has(p.id))links.set(p.id,[]);links.get(p.id).push(e);}
 const used=new Set(),project=p=>[(m[0]*p.x+m[1]*p.y+m[2]*p.z).toFixed(4),(m[3]*p.x+m[4]*p.y+m[5]*p.z).toFixed(4)].join(' ');let path='';
 for(const first of edges.values()){
  if(used.has(first))continue;let edge=first,k=first.a.id;const contour=[first.a];
  while(edge&&!used.has(edge)){used.add(edge);const p=edge.a.id===k?edge.b:edge.a;k=p.id;contour.push(p);edge=links.get(k)?.find(e=>!used.has(e));}
  if(style==='curls'){
   if(contour.at(-1).id===contour[0].id)contour.pop();
   const points=contour.map(p=>project(p).split(' ').map(Number)),mid=(a,b)=>a.map((v,i)=>((v+b[i])/2).toFixed(4)).join(' ');
   path+='M'+mid(points.at(-1),points[0]);
   for(let i=0;i<points.length;i++)path+='Q'+points[i].join(' ')+' '+mid(points[i],points[(i+1)%points.length]);
  }else path+='M'+project(contour[0])+contour.slice(1).map(p=>'L'+project(p)).join('');
  path+='Z';
 }source.lastMatrix=Array.from(m);source.lastPath=path||'M0 0';return source.lastPath;
}
