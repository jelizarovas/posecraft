// Atlas directional artwork is stored in the pack, so yaw edits and exports
// use the same views as the gallery. Each path has a compatible contour.
const radians=Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,number=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const point=p=>p.map(v=>+v.toFixed(4)).join(' '),polygon=p=>'M'+point(p[0])+p.slice(1).map(v=>'L'+point(v)).join('')+'Z';
const outline=p=>'M'+point(p[0].map((v,i)=>(v+p.at(-1)[i])/2))+p.map((v,i)=>'Q'+point(v)+' '+point(v.map((n,k)=>(n+p[(i+1)%p.length][k])/2))).join('')+'Z';
const ellipse=(x,y,rx,ry)=>outline(Array.from({length:8},(_,i)=>[x+rx*Math.cos(i*Math.PI/4),y+ry*Math.sin(i*Math.PI/4)]));
const direction=a=>{const signed=a>180?a-360:a;return {a:Math.abs(signed),side:signed<0?-1:1,s:Math.sin(Math.abs(signed)*radians),c:Math.cos(Math.abs(signed)*radians)};};
const front=a=>clamp((105-a)/15,0,1),back=a=>clamp((a-85)/35,0,1);
function landmarks(anchors,angle){const {a,side}=direction(angle),keys=Object.keys(anchors).map(Number).sort((a,b)=>a-b),lo=keys.filter(v=>v<=a).at(-1),hi=keys.find(v=>v>=a),t=hi===lo?0:(a-lo)/(hi-lo);return anchors[lo].map((p,i)=>[side*mix(p[0],anchors[hi][i][0],t),mix(p[1],anchors[hi][i][1],t)]);}
const head={
 0:[[0,-32],[12,-31],[22,-24],[24,-15],[24,-6],[24,1],[23,7],[21,15],[14,23],[5,27],[-5,27],[-14,23],[-22,14],[-24,0],[-22,-20],[-12,-30]],
 30:[[1,-33],[14,-31],[23,-24],[25,-15],[26,-7],[29,0],[26,6],[23,15],[15,23],[6,27],[-5,26],[-15,21],[-22,11],[-23,-2],[-21,-21],[-11,-31]],
 60:[[0,-33],[13,-31],[22,-25],[25,-16],[27,-7],[34,-1],[28,5],[24,14],[16,22],[6,27],[-5,25],[-15,19],[-21,8],[-22,-5],[-20,-23],[-10,-32]],
 90:[[-1,-33],[12,-31],[22,-25],[24,-16],[25,-7],[35,-1],[27,5],[24,14],[16,22],[6,26],[-5,24],[-16,17],[-21,5],[-22,-8],[-19,-24],[-10,-32]],
 120:[[-1,-33],[13,-31],[23,-24],[25,-15],[25,-6],[28,0],[25,7],[23,16],[14,24],[5,27],[-6,25],[-17,18],[-23,6],[-24,-8],[-21,-24],[-11,-32]],
 150:[[0,-33],[14,-31],[24,-24],[26,-15],[26,-6],[26,1],[25,8],[22,17],[14,25],[5,28],[-6,27],[-17,21],[-24,10],[-25,-4],[-22,-22],[-12,-31]],
 180:[[0,-33],[14,-31],[24,-24],[26,-15],[26,-6],[26,1],[25,8],[22,17],[14,25],[5,28],[-5,28],[-14,25],[-22,17],[-26,1],[-24,-24],[-14,-31]]
};
const hair={
 0:[[-24,-9],[-25,-24],[-15,-36],[0,-36],[15,-39],[25,-25],[23,-7],[16,-22],[6,-16],[-8,-24],[-18,-20],[-20,-8]],
 30:[[-24,-4],[-25,-23],[-15,-36],[0,-37],[16,-38],[26,-25],[24,-9],[16,-22],[8,-18],[-5,-24],[-16,-19],[-19,-4]],
 60:[[-24,5],[-25,-22],[-15,-36],[0,-37],[15,-37],[24,-26],[24,-14],[17,-22],[12,-20],[2,-24],[-10,-16],[-15,5]],
 90:[[-23,13],[-25,-21],[-15,-36],[0,-37],[14,-37],[23,-27],[23,-18],[17,-24],[12,-22],[6,-25],[-4,-13],[-9,13]],
 120:[[-23,17],[-25,-21],[-15,-36],[0,-37],[15,-37],[25,-26],[25,6],[18,14],[10,17],[1,15],[-6,18],[-14,17]],
 150:[[-24,17],[-26,-21],[-15,-36],[0,-37],[15,-37],[26,-25],[25,14],[18,18],[10,19],[1,17],[-7,20],[-15,18]],
 180:[[-24,17],[-26,-21],[-15,-36],[0,-37],[15,-37],[26,-25],[25,17],[17,19],[9,20],[0,18],[-9,20],[-17,19]]
};
const torso={
 0:[[-38,-25],[-29,-37],[-15,-33],[0,-25],[15,-33],[30,-37],[38,-25],[31,4],[22,38],[0,43],[-22,38],[-31,4]],
 30:[[-34,-25],[-27,-35],[-13,-33],[0,-27],[15,-33],[31,-35],[38,-22],[33,3],[21,38],[1,43],[-20,38],[-28,3]],
 60:[[-24,-24],[-20,-34],[-10,-33],[2,-29],[14,-32],[25,-32],[30,-20],[27,3],[17,38],[0,42],[-14,38],[-18,4]],
 90:[[-15,-24],[-14,-33],[-7,-32],[2,-30],[11,-31],[18,-29],[24,-17],[20,4],[13,38],[0,41],[-11,38],[-12,3]],
 120:[[-23,-24],[-21,-35],[-11,-33],[1,-28],[14,-34],[26,-35],[29,-21],[24,3],[17,38],[0,43],[-16,38],[-18,4]],
 150:[[-34,-25],[-29,-37],[-15,-35],[0,-29],[15,-35],[30,-37],[35,-24],[28,5],[21,38],[0,43],[-21,38],[-28,5]],
 180:[[-39,-25],[-29,-38],[-15,-35],[0,-29],[15,-35],[29,-38],[39,-25],[30,5],[22,38],[0,43],[-22,38],[-30,5]]
};
const shorts={
 0:[[-25,-10],[0,-4],[25,-10],[29,28],[5,30],[0,13],[-5,30],[-29,28]],
 30:[[-23,-10],[1,-4],[25,-9],[27,28],[6,29],[1,14],[-4,30],[-26,28]],
 60:[[-17,-9],[2,-5],[21,-9],[23,28],[7,29],[5,15],[2,30],[-17,27]],
 90:[[-12,-8],[2,-6],[16,-8],[18,28],[8,29],[7,20],[7,29],[-13,27]],
 120:[[-18,-9],[1,-5],[22,-9],[24,28],[5,30],[3,15],[0,30],[-19,28]],
 150:[[-24,-10],[0,-5],[26,-10],[29,28],[5,30],[0,14],[-5,30],[-28,28]],
 180:[[-26,-10],[0,-5],[26,-10],[30,28],[5,30],[0,14],[-5,30],[-30,28]]
};
function view(part,draw){const views=Array.from({length:25},(_,i)=>({angle:i*15,d:draw(i===24?0:i*15)}));part.d=views[0].d;part.spatial={...(part.spatial||{}),turnaround:{views}};delete part.spatial.thickness;delete part.spatial.axis;delete part.spatial.morph;return part;}
function facePoint(angle,x,y){const q=direction(angle),f=front(q.a);return [q.side*(x*Math.max(0,q.c)+17*q.s)*f,y*f];}
function eyes(angle,closed=false){const q=direction(angle),f=front(q.a);return [-1,1].map(side=>{const near=side===q.side?1:clamp((80-q.a)/35,0,1),[x,y]=facePoint(angle,side*q.side*9,-5),r=f*near;return closed?'M'+point([x-5*r,y])+'Q'+point([x,y+3*r])+' '+point([x+5*r,y]):ellipse(x,y,3*r,3.4*r);}).join('');}
function frontPath(source,angle){const q=direction(angle),f=front(q.a);let i=0;return source.replace(number,n=>{const v=Number(n);return ' '+String(+(i++%2?v*f:(v*Math.max(.22,q.c)+q.side*13*q.s)*f).toFixed(4));});}
/** Install original, editable front/quarter/profile/rear Atlas artwork. */
export function addGymTurnaround(pack){
 if(pack.parts.some(part=>part.id==='back-scapula-left'))return pack;
 const find=id=>pack.parts.find(part=>part.id===id),install=(id,draw)=>{const p=find(id);if(p)view(p,draw);};
 install('head-shape',a=>outline(landmarks(head,a)));install('hair',a=>polygon(landmarks(hair,a)));install('trunk',a=>outline(landmarks(torso,a)));install('shorts',a=>polygon(landmarks(shorts,a)));
 for(const name of ['left','right'])install(name+'shoe',a=>{const q=direction(a),toe=q.s,heel=Math.max(0,-q.c),points=[[-10,-7],[-4,-9],[5,-4],[mix(10,19,toe),mix(0,-1,toe)],[mix(12,21,toe),5],[mix(9,18,toe),7],[-11,7],[-13,2]];return outline(points.map(([x,y])=>[q.side*x*(1-.08*heel),y]));});
 install('eyes',a=>eyes(a));install('blink',a=>eyes(a,true));
 install('eyebrows',a=>{const q=direction(a),f=front(q.a);return [-1,1].map(side=>{const near=side===q.side?1:clamp((80-q.a)/35,0,1),[x,y]=facePoint(a,side*q.side*9,-13),r=f*near;return 'M'+point([x-6*r,y])+'Q'+point([x,y-2*r])+' '+point([x+5*r,y]);}).join('');});
 install('nose',a=>{const q=direction(a),f=front(q.a),x=q.side*24*q.s;return polygon([[x*f,-2*f],[(x+q.side*(6+3*q.s))*f,4*f],[x*f,6*f]]);});
 install('beard',a=>{const q=direction(a),f=front(q.a),shift=q.side*8*q.s,sx=mix(1,.7,q.s);return outline([[-21,9],[-12,13],[-7,8],[0,6],[7,8],[12,13],[21,9],[18,24],[0,30],[-18,24]].map(([x,y])=>[(x*sx+shift)*f,y*f]));});
 for(const id of ['effort','sweat-drop','strain-lines','breath-mouth','breath-air']){const p=find(id);if(p){const original=p.d;install(id,a=>frontPath(original,a));}}
 for(const [id,side]of [['left-pec',-1],['right-pec',1]])install(id,a=>{const q=direction(a),f=front(q.a),near=side===q.side?1:clamp((100-q.a)/70,0,1),shift=q.side*9*q.s;return outline([[side*31,-23],[side*15,-32],[side*2,-17],[side*2,-2],[side*20,7],[side*32,-4]].map(([x,y])=>[(x*Math.max(.2,q.c)*near+shift)*f,y*f]));});
 install('abs',a=>{const q=direction(a),f=front(q.a),x=q.side*9*q.s,sx=Math.max(.15,q.c);return [9,19,29].map(y=>'M'+point([(x-11*sx)*f,y*f])+'Q'+point([x*f,(y-5)*f])+' '+point([(x+11*sx)*f,y*f])).join('')+'M'+point([x*f,5*f])+'L'+point([x*f,34*f]);});
 install('shorts-stripe',a=>{const q=direction(a),width=25-12*q.s;return [-1,1].map(side=>'M'+point([side*width,-5])+'L'+point([side*(width-4),24])).join('');});
 for(const side of [-1,1]){
  const id='back-scapula-'+(side<0?'left':'right'),part={id,joint:'torso',d:'M0 0L0 0Z',fill:'#b96f4b',stroke:'#a65f46',strokeWidth:1,spatial:{order:21}};
  pack.parts.push(view(part,a=>{const q=direction(a),f=back(q.a),width=.5+.5*Math.abs(q.c),shift=q.side*5*q.s;return outline([[side*29,-25],[side*10,-28],[side*4,-9],[side*10,7],[side*23,0]].map(([x,y])=>[(x*width+shift)*f,y*f]));}));
 }
 pack.parts.push(view({id:'back-spine',joint:'torso',d:'M0 0L0 0',fill:'none',stroke:'#a65f46',strokeWidth:1.8,spatial:{order:22}},a=>{const q=direction(a),f=back(q.a),x=q.side*4*q.s*f;return 'M'+point([x,-21*f])+'Q'+point([x+2*f,5*f])+' '+point([x,33*f]);}));
 pack.parts.push(view({id:'back-hair-strands',joint:'head',d:'M0 0L0 0',fill:'none',stroke:'#594637',strokeWidth:1.3,spatial:{order:44}},a=>{const f=clamp((direction(a).a-105)/30,0,1);return [-13,0,13].map(x=>'M'+point([x*f,-24*f])+'Q'+point([(x-3)*f,-5*f])+' '+point([(x+1)*f,11*f])).join('');}));
 for(const side of [-1,1])pack.parts.push(view({id:'ear-'+(side<0?'left':'right'),joint:'head',d:'M0 0L0 0Z',fill:'#d99168',stroke:'#a65f46',strokeWidth:1,spatial:{order:42}},a=>{const q=direction(a),visible=side===q.side?Math.sin(q.a*radians):0,x=q.side*(23-26*q.s);return ellipse(x*visible,3*visible,4*visible,7*visible);}));
 return pack;
}
/** Body-facing channels; equipment attached to root keeps its world placement. */
export function applyGymFacing(pose,angle){const yaw=((angle+180)%360+360)%360-180;pose['torso.yaw']=yaw;pose['pelvis.yaw']=yaw;pose['head.yaw']=0;return pose;}
