/** A shared two-vanishing-point projection for the gym floor and equipment. */
export const gymRoomPerspective=Object.freeze({origin:{x:600,y:385},left:{x:-900,y:100},right:{x:1100,y:100},uScale:-.00042,vScale:.00085});
export function projectGymPoint(u,v,height=0){const p=gymRoomPerspective,a=u*p.uScale,b=v*p.vScale,w=1+a+b;return {x:(p.origin.x+a*p.left.x+b*p.right.x)/w,y:(p.origin.y+a*p.left.y+b*p.right.y-height)/w};}
export function gymFloorPoint(x,y){const p=gymRoomPerspective,sum=(p.origin.y-y)/(y-p.left.y),a=(p.origin.x-x-(x-p.right.x)*sum)/(p.right.x-p.left.x),b=sum-a;return {u:a/p.uScale,v:b/p.vScale};}
export const gymRoomStations=Object.freeze({bottle:{point:{x:400,y:270},stand:{x:355,y:300},floorY:383,tableY:290},window:{stand:{x:335,y:240},floorY:323},mirror:{stand:{x:690,y:232},floorY:315}});
const rad=Math.PI/180,round=n=>+n.toFixed(3),path=points=>'M'+points.map(p=>`${round(p.x)} ${round(p.y)}`).join('L')+'Z',line=(a,b)=>`M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}`;
const project=(u,v,h)=>projectGymPoint(u,v,h),rectangle=(u1,u2,v1,v2,h)=>[project(u1,v1,h),project(u2,v1,h),project(u2,v2,h),project(u1,v2,h)];
/** press is the downward travel in projected-height units, normally 0..32. */
export function gymBenchTargets(press=0){
 const height=129-press,bar=project(-10,0,height),near=project(-10,-55,height),far=project(-10,55,height),rotation=Math.atan2(far.y-near.y,far.x-near.x)/rad;
 const local=p=>({x:(p.x-bar.x)*Math.cos(rotation*rad)+(p.y-bar.y)*Math.sin(rotation*rad),y:0});
 const hips=project(115,0,65),back=project(35,0,65),bodyRotation=Math.atan2(back.y-hips.y,back.x-hips.x)/rad+90;
 return {bodyRotation,hips,back,head:project(-55,0,70),shoulders:{left:project(-5,-23,72),right:project(-5,23,72)},feet:{left:project(170,-24,7),right:project(170,24,7)},bar:{...bar,rotation,left:near,right:far,gripOffsets:{left:local(near),right:local(far)},ends:{left:project(-10,-130,height),right:project(-10,130,height)}},pad:rectangle(-85,155,-24,24,58),sit:project(140,0,65)};
}
const part=(id,d,fill,order=0,extra={})=>({id,joint:'root',d,fill,stroke:'#314653',strokeWidth:1.5,spatial:{order},...extra});
const rootJoint=id=>({id,parent:null,x:0,y:0,length:0,rotation:0,min:-180,max:180});
function roomParts(){
 const parts=[part('floor','M0 0H800V450H0Z','#c5c5b6',0,{strokeWidth:0})];
 let tiles='';for(let u=-1300;u<=480;u+=140)tiles+=line(project(u,-420,0),project(u,1300,0));for(let v=-420;v<=1300;v+=150)tiles+=line(project(-1300,v,0),project(480,v,0));parts.push(part('floor-joints',tiles,'none',1,{stroke:'#afb4a7',strokeWidth:1}));
 const corner={x:445,y:228},leftY=228+(0-445)*(100-228)/(-900-445),rightY=228+(800-445)*(100-228)/(1100-445);
 parts.push(part('wall','M0 0H445V228L0 '+round(leftY)+'Z','#e2e7dc',2,{strokeWidth:0}),part('right-wall',`M445 0H800V${round(rightY)}L445 228Z`,'#d3ded7',2,{strokeWidth:0}),part('wall-panels',`M0 ${round(leftY)}L445 228L800 ${round(rightY)}M445 0V228`,'none',3,{stroke:'#91a49b',strokeWidth:4}));
 const wallRect=(vp,x1,x2,top,bottom)=>{const y=(value,x)=>vp.y+(value-vp.y)*(x-vp.x)/(x1-vp.x);return [{x:x1,y:top},{x:x2,y:y(top,x2)},{x:x2,y:y(bottom,x2)},{x:x1,y:bottom}];};
 const window=wallRect(gymRoomPerspective.left,280,394,58,164),inner=wallRect(gymRoomPerspective.left,286,388,66,156);parts.push(part('window',path(window),'#a7cbd0',5,{stroke:'#779a9d',strokeWidth:7}),part('window-sky',path(inner),'#bcdddd',6,{strokeWidth:0}));const windowMidTop={x:337,y:(window[0].y+window[1].y)/2},windowMidBottom={x:337,y:(window[2].y+window[3].y)/2};parts.push(part('window-bars',line(windowMidTop,windowMidBottom)+line({x:280,y:111},{x:394,y:100+11*(1294/1180)}),'none',7,{stroke:'#eff5e7',strokeWidth:4}));
 const mirror=wallRect(gymRoomPerspective.right,666,781,58,181),mirrorInner=wallRect(gymRoomPerspective.right,675,772,67,170);parts.push(part('mirror-frame',path(mirror),'#587b82',5,{stroke:'#476570',strokeWidth:5}),part('mirror',path(mirrorInner),'#b7cacc',6,{strokeWidth:0}),part('mirror-glint','M693 77L711 78L681 151L681 128ZM740 82L749 83L714 157L705 159Z','#dce8e4',7,{strokeWidth:0}));
 parts.push(part('pullup-frame','M86 390V150Q86 122 112 122H248Q274 122 274 150V390M74 390H110M252 390H287','none',10,{stroke:'#3c5265',strokeWidth:12}),part('pullup-grip','M105 150H255','none',11,{stroke:'#233445',strokeWidth:9}));
 parts.push(part('rubber-mat','M73 392L271 392L286 409L76 409Z','#77877b',9,{strokeWidth:0}));
 const mat=rectangle(-110,205,-60,60,0);parts.push(part('bench-mat',path(mat),'#9ca995',12,{stroke:'#849580',strokeWidth:2}));
 let legs='';for(const u of [-62,128])for(const v of [-18,18])legs+=line(project(u,v,4),project(u,v,52));parts.push(part('bench-legs',legs,'none',15,{stroke:'#55727a',strokeWidth:7}));
 const pad=rectangle(-85,155,-24,24,58),bottom=rectangle(-85,155,-24,24,47);parts.push(part('bench-side',path([pad[0],pad[1],bottom[1],bottom[0]]),'#294654',16),part('bench-end',path([pad[1],pad[2],bottom[2],bottom[1]]),'#223d4a',16),part('bench-pad',path(pad),'#4e7880',17,{stroke:'#294653',strokeWidth:3}));
 let rack='';for(const v of [-92,92]){rack+=line(project(-10,v,0),project(-10,v,134));rack+=line(project(-10,v,134),project(7,v,134));rack+=line(project(-38,v,0),project(19,v,0));}parts.push(part('bench-rack',rack,'none',18,{stroke:'#627f87',strokeWidth:7}));
 const station=gymFloorPoint(400,383),h=93*(1+station.u*gymRoomPerspective.uScale+station.v*gymRoomPerspective.vScale),top=rectangle(station.u-32,station.u+32,station.v-24,station.v+24,h),base=rectangle(station.u-32,station.u+32,station.v-24,station.v+24,h-9);let tableLegs='';for(const u of [-25,25])for(const v of [-17,17])tableLegs+=line(project(station.u+u,station.v+v,0),project(station.u+u,station.v+v,h-7));parts.push(part('water-table-legs',tableLegs,'none',20,{stroke:'#7b6950',strokeWidth:6}),part('water-table-edge',path([top[0],top[1],base[1],base[0]]),'#947e5e',21,{stroke:'#695d4c',strokeWidth:1.5}),part('water-table',path(top),'#b6a17c',22,{stroke:'#837053',strokeWidth:2}));
 // Small shelves give the wandering water break real surfaces to leave a bottle on.
 for(const [name,x,y,width]of [['window-water',320,225,62],['mirror-water',755,275,66]]){
  parts.push(part(name+'-bracket',`M${x-19} ${y+4}V${y+24}L${x-6} ${y+4}M${x+19} ${y+4}V${y+24}L${x+6} ${y+4}`,'none',20,{stroke:'#7b6950',strokeWidth:3}),part(name+'-edge',`M${x-width/2} ${y}H${x+width/2}V${y+6}H${x-width/2}Z`,'#947e5e',21,{stroke:'#695d4c',strokeWidth:1.5}),part(name+'-top',`M${x-width/2} ${y}L${x-width/2+8} ${y-5}H${x+width/2+8}L${x+width/2} ${y}Z`,'#b6a17c',22,{stroke:'#837053',strokeWidth:1.5}));
 }
 return parts;
}
function barbellParts(){const target=gymBenchTargets().bar,angle=-target.rotation*rad,toLocal=p=>({x:(p.x-target.x)*Math.cos(angle)-(p.y-target.y)*Math.sin(angle),y:(p.x-target.x)*Math.sin(angle)+(p.y-target.y)*Math.cos(angle)}),parts=[];
 parts.push({...part('barbell-shaft',line(toLocal(target.ends.left),toLocal(target.ends.right)),'none',90,{stroke:'#cad8d9',strokeWidth:5}),joint:'barbell'});
 for(const [side,v]of [['left',-103],['right',103]]){const circle=(depth,r)=>Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return toLocal(project(-10+Math.cos(a)*r,depth,129+Math.sin(a)*r));}),front=circle(v,22),rear=circle(v+8,22);parts.push({...part('plate-'+side+'-edge',path([...front.slice(0,13),...rear.slice(0,13).reverse()]),'#283f4e',92),joint:'barbell'},{...part('plate-'+side,path(front),'#476a78',93,{stroke:'#263f4b',strokeWidth:2}),joint:'barbell'},{...part('collar-'+side,path(circle(v,6)),'#c5d4d8',94,{stroke:'#849ca5',strokeWidth:1}),joint:'barbell'});}
 return parts;
}
/** Mutates room artwork, barbell artwork, and lighting. Atlas owns the bottle artwork. */
export function configureGymRoom(scene){
 scene.packs.gym={...scene.packs.gym,name:'Gym / perspective room',spatial:true,joints:[rootJoint('root')],parts:roomParts(),clips:{still:{duration:1,loop:true,tracks:{}}},inputs:{},initial:'still',states:{still:{clip:'still'}}};
 const atlas=scene.packs.atlas;if(atlas){const replaced=new Set(['barbell-shaft','plate-left','plate-right','collar-left','collar-right','plate-left-edge','plate-right-edge']);atlas.parts=atlas.parts.filter(p=>!replaced.has(p.id));atlas.parts.push(...barbellParts());}
 scene.lighting={...scene.lighting,enabled:false,floorShadow:0,wallShadow:0,reflection:0,gloss:0};
 return scene;
}
