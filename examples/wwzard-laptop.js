// One projected deck plane, shared by the keys, palm rest and lid hinge.
const A=[195,326],U=[113,-64],V=[93,50];
const point=(u,v)=>[A[0]+U[0]*u+V[0]*v,A[1]+U[1]*u+V[1]*v];
const path=points=>'M'+points.map(p=>p.map(n=>+n.toFixed(3)).join(' ')).join('L')+'Z';
const rect=(u,v,w,h)=>path([point(u,v),point(u+w,v),point(u+w,v+h),point(u,v+h)]);
const gradient=(a,b)=>({type:'linear',x1:0,y1:1,x2:1,y2:0,stops:[[0,a],[1,b]]});
const part=(id,d,fill,g)=>({id,joint:'root',d,fill,...(g?{gradient:g}:{})});
const still={duration:1,loop:true,tracks:{}};
const root={id:'root',parent:null,x:0,y:0,rotation:0,min:-180,max:180,length:0};
export const laptopDuration=7;
const smoothTime=value=>{let a=0,b=1;for(let i=0;i<30;i++){const t=(a+b)/2;if(t*t*(3-2*t)<value)a=t;else b=t;}return (a+b)/2;};
const stroke=Array.from({length:8},(_,i)=>(i+1)/8);
export const laptopFoldKeys=[[0,0],[1.05,0],...stroke.map(f=>[+(1.05+1.5*smoothTime(f)).toFixed(5),f]),[3.8,1],...stroke.map(f=>[+(3.8+1.6*smoothTime(f)).toFixed(5),1-f]),[7,0]].map(([t,v])=>[t,v,'linear']);
export function lidPoint(u,v,fold){
 const angle=(1-fold)*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),hinge=point(u,1);
 return [hinge[0]-V[0]*c*v,hinge[1]-(V[1]*c+88*s)*v];
}
export const laptopGrip=fold=>{const p=lidPoint(.055,1,fold);return [p[0]-3,p[1]-3];};
const phases=Array.from({length:9},(_,i)=>i/8);

export function createLaptopArtwork(){
 const a=point(0,0),b=point(1,0),c=point(1,1),d=point(0,1),down=p=>[p[0],p[1]+5];
 const keys=[
  part('keyboard-base-side',path([a,d,c,down(c),down(d),down(a)]),'#8893b5',gradient('#8794ba','#c0c7e4')),
  part('keyboard-front-edge',path([a,b,down(b),down(a)]),'#b4bfdc'),
  part('keyboard-top',path([a,b,c,d]),'#dce1f3',gradient('#c2cbe7','#f0effb')),
  part('keyboard-well',rect(.055,.345,.89,.56),'#9199b5'),
 ];
 // Four staggered letter rows and a space-bar row. Gaps share the deck plane.
 for(let row=0;row<4;row++)for(let col=0;col<11;col++){
  const u=.074+col*.077+(row%2)*.009,v=.476+row*.102;
  keys.push(part(`key-${row}-${col}`,rect(u,v,.063,.079),'#f9f8ff',gradient('#dae0f4','#ffffff')));
 }
 for(const [i,u,w] of [[0,.074,.1],[1,.19,.09],[2,.298,.39],[3,.705,.085],[4,.807,.102]])keys.push(part(`key-bottom-${i}`,rect(u,.367,w,.079),'#f4f4ff'));
 keys.push(part('trackpad-border',rect(.14,.055,.56,.242),'#8c99bb'));
 keys.push(part('trackpad',rect(.151,.069,.538,.214),'#cad4eb',gradient('#b9c6e2','#e4e8f7')));
 keys.push(part('trackpad-front-highlight',path([point(.151,.069),point(.689,.069),point(.689,.082),point(.151,.082)]),'#eef0fd'));
 keys.push(part('hinge-rail',rect(.07,.954,.86,.042),'#777791'));
 const shape=(id,points,fill,g)=>{
  const draw=f=>path(points(f));
  return {...part(id,draw(0),fill,g),joint:'hinge',spatial:{morph:{channel:'hinge.bend',target:draw(1),frames:phases.slice(1,-1).map(value=>({value,target:draw(value)}))}}};
 };
 const plane=(f,u,v,w,h)=>[lidPoint(u,v,f),lidPoint(u+w,v,f),lidPoint(u+w,v+h,f),lidPoint(u,v+h,f)];
 const lid=[
  shape('lid-side',f=>{const p=lidPoint(0,1,f),q=lidPoint(0,0,f);return [p,q,[q[0],q[1]+3],[p[0],p[1]+3]];},'#777cad'),
  shape('lid-back',f=>plane(f,0,0,1,1),'#a275ca',gradient('#815bb0','#be97de')),
  shape('lid-inset',f=>plane(f,.025,.025,.95,.95),'#a474cc',gradient('#8054ad','#bb8edc')),
  shape('lid-top-edge',f=>{const p=lidPoint(0,1,f),q=lidPoint(1,1,f);return [p,q,[q[0],q[1]+2],[p[0],p[1]+2]];},'#dac4f0'),
  shape('lid-bottom',f=>{const p=lidPoint(0,0,f),q=lidPoint(1,0,f);return [p,q,[q[0],q[1]+3],[p[0],p[1]+3]];},'#6f739d'),
 ];
 // The rim occludes a gripping hand separately from the cover panel. Moving
 // fingers in front of the panel must not erase the near corner or edge.
 for(const p of lid)if(['lid-side','lid-top-edge','lid-bottom'].includes(p.id))p.spatial.sceneDepth={value:70,channel:'hinge.z'};
 const make=(name,parts)=>({name,joints:[{...root}],parts,inputs:{},clips:{still},states:{still:{clip:'still',transitions:[]}},initial:'still'});
 const keyboard=make('Laptop keyboard and trackpad',keys),screen=make('Hinged laptop lid',lid);
 screen.spatial=true;screen.joints.push({...root,id:'hinge',parent:'root'});
 screen.clips.laptop={duration:laptopDuration,loop:false,tracks:{'hinge.bend':laptopFoldKeys}};
 screen.states.laptop={clip:'laptop',transitions:[]};
 return {keyboard,screen};
}

// A sleeve drawing with a rounded shoulder and elbow, ending at the wrist.
// These are saved 2D contours, sampled at authoring time, not runtime IK.
export function reachingSleeve(wrist,shadow=false,authoredElbow){
 const [x,y]=wrist,elbow=authoredElbow||[190+(x-190)*.45,Math.max(278,y+8)],dx=x-elbow[0],dy=y-elbow[1],length=Math.hypot(dx,dy)||1,n=[-dy/length*13,dx/length*13];
 if(shadow)return `M186 279Q${elbow[0]-6} ${elbow[1]+10} ${elbow[0]+2} ${elbow[1]+12}L${x+n[0]-8} ${y+n[1]}L${x+n[0]-5} ${y+n[1]+4}L${elbow[0]} ${elbow[1]+17}Q191 305 185 285Z`;
 return `M181 244Q193 234 207 246Q${elbow[0]+3} ${elbow[1]-14} ${elbow[0]+8} ${elbow[1]-9}Q${x-n[0]-12} ${y-n[1]} ${x-n[0]} ${y-n[1]}L${x+n[0]} ${y+n[1]}L${x+n[0]-10} ${y+n[1]+3}Q${elbow[0]+3} ${elbow[1]+20} ${elbow[0]-5} ${elbow[1]+16}Q191 305 185 285Q169 272 177 253Z`;
}
