import {emitterPulse} from './emitters.js';
import {nodeVisible} from './scene-graph.js';
// Stylized receivers and surface ramps. No mesh, ray tracing or layout reads.
export const lightRanges={shadowLength:[0,3],celThickness:[0,1],celIntensity:[0,1],pointX:[-4096,8192],pointY:[-4096,8192],pointHeight:[20,2000],range:[50,4000],motionRadius:[0,1000],motionSpeed:[.05,5],flicker:[0,1],angle:[-180,180],elevation:[10,85],intensity:[0,2],ambient:[0,1],softness:[0,16],floorY:[0,4096],wallY:[0,4096],floorShadow:[0,1],wallShadow:[0,1],reflection:[0,.8],gloss:[0,1]};
export function lightingConfig(scene,frame){const light={shadowLength:1,enabled:false,shading:'gradient',celThickness:.35,celIntensity:1,type:'directional',receiver:'corner',pointX:scene.bounds.width/2,pointY:scene.bounds.height*.6,pointHeight:220,range:500,motion:'none',motionRadius:220,motionSpeed:1,flicker:.2,showSource:false,angle:-135,elevation:45,intensity:.8,ambient:.6,color:'#fff1d6',shadowColor:'#292438',softness:3,floorY:scene.bounds.height*.82,wallY:scene.bounds.height*.66,floorShadow:.24,wallShadow:.14,reflection:.18,gloss:.25,...scene.lighting};
 const emitter=scene.emitters?.find(e=>e.id===light.emitter);
 if(emitter){
  const actor=scene.actors.find(a=>a.id===emitter.actor),placement=frame?.actors?.find(a=>a.id===emitter.actor)?.placement||actor?.transform||{x:0,y:0,rotation:0,scale:1};
  const angle=placement.rotation*Math.PI/180,x=emitter.x,y=emitter.y-(emitter.type==='flame'?emitter.size*.45:0);
  light.type='point';light.pointX=placement.x+placement.scale*(x*Math.cos(angle)-y*Math.sin(angle));light.pointY=placement.y+placement.scale*(x*Math.sin(angle)+y*Math.cos(angle));
  light.emitterSettings={...emitter,enabled:(frame?.emitterOverrides?.[emitter.id]?.enabled??emitter.enabled)&&nodeVisible(scene,emitter)&&(!emitter.actor||!!actor&&nodeVisible(scene,actor))};
 }
 return light;
}
const rad=Math.PI/180;
function rgb(hex){if(!/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(hex))return null;let s=hex.slice(1);if(s.length===3)s=[...s].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));}
export function surfaceRamp(fill,light){const base=rgb(fill),tint=rgb(light.color);if(!base||Math.max(...base)<65)return null;
 const color=(gain,mix)=>'#'+base.map((v,i)=>Math.round(Math.max(0,Math.min(255,v*gain*(1-mix)+tint[i]*mix))).toString(16).padStart(2,'0')).join('');
 if(light.surfaceExposure===0){const shade=color(light.ambient*.76,.025);return [shade,shade,shade];}
 return [color(light.ambient+light.intensity*.55,light.gloss*light.intensity*.48),color(light.ambient+light.intensity*.42,.04*light.intensity),color(light.ambient*.76,.025)];}
export function surfaceStopValues(ramp,light){
 // Coincident stops make an antialiased edge with no color interpolation band.
 const edge=Math.min(1,1.04-.92*(light.celThickness??.35)),a=rgb(ramp[0]),b=rgb(ramp[2]),amount=light.celThickness===0?0:light.celIntensity??1,shadow='#'+a.map((v,i)=>Math.round(v+(b[i]-v)*amount).toString(16).padStart(2,'0')).join('');
 const stops=light.shading==='cel'?[[0,ramp[0]],[edge,ramp[0]],[edge,shadow],[1,shadow]]:[[0,ramp[0]],[.42,ramp[1]],[1,ramp[2]]];
 return stops;
}
export function surfaceStops(ramp,light){return surfaceStopValues(ramp,light).map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('');
}
export function surfaceFocus(light,rotation=0,partTransform=''){
 // Invert the full rendered part transform, including projected yaw/pitch and
 // volume mirroring at profile. A 2D joint angle alone misses those reflections.
 let a=1,b=0,c=0,d=1;
 for(const match of partTransform.matchAll(/(translate|scale|rotate|matrix)\(([^)]*)\)/g)){const v=match[2].trim().split(/[\s,]+/).map(Number);let e=1,f=0,g=0,h=1;
  if(match[1]==='scale'){e=v[0];h=v[1]??e;}else if(match[1]==='rotate'){e=h=Math.cos(v[0]*rad);f=Math.sin(v[0]*rad);g=-f;}else if(match[1]==='matrix'&&v.length>=4&&v.slice(0,4).every(Number.isFinite)){[e,f,g,h]=v;}
  [a,b,c,d]=[a*e+c*f,b*e+d*f,a*g+c*h,b*g+d*h];
 }
 const theta=(light.angle-rotation)*rad,x=Math.cos(theta),y=Math.sin(theta),det=a*d-b*c;
 const u=Math.abs(det)>1e-8?(d*x-c*y)/det:x,v=Math.abs(det)>1e-8?(-b*x+a*y)/det:y,n=Math.hypot(u,v)||1;
 return {cx:.5+.34*u/n,cy:.5+.34*v/n};
}
export function sampleLighting(base,time=0){
 const l={...base},t=(base.motion==='flicker'?Math.floor(time*30)/30:time)*l.motionSpeed;
 if(!l.emitterSettings&&l.type==='point'&&l.motion==='orbit'){l.pointX+=Math.sin(t*.65)*l.motionRadius;l.pointY+=Math.cos(t*.65)*l.motionRadius*.3;}
 if(l.emitterSettings){const pulse=emitterPulse(l.emitterSettings,time);l.intensity=Math.min(2,l.intensity*pulse);l.celThickness=Math.max(0,Math.min(1,l.celThickness*(1+.9*(1-pulse))));l.floorShadow*=Math.min(1,pulse);l.wallShadow*=Math.min(1,pulse);if(!pulse)l.showSource=false;}
 else if(l.motion==='flicker'){const dim=l.flicker*(.5+.25*Math.sin(t*13)+.15*Math.sin(t*23+1)+.1*Math.sin(t*37));l.intensity*=1-dim;l.celThickness=Math.min(1,l.celThickness*(1+.9*dim));}
 return l;
}
export function actorAnchor(actor,evaluated){const t=evaluated.placement||actor.transform,root=Object.values(evaluated.world)[0]||{x:0,y:0},r=t.rotation*rad;return {x:t.x+t.scale*(root.x*Math.cos(r)-root.y*Math.sin(r)),y:t.y+t.scale*(root.x*Math.sin(r)+root.y*Math.cos(r))};}
export function lightAt(light,x,y){if(light.type!=='point')return light;const dx=light.pointX-x,dy=light.pointY-y,distance=Math.hypot(dx,dy);return {...light,angle:Math.atan2(dy,dx)/rad,intensity:Math.round(light.intensity/(1+(distance/light.range)**2)*50)/50};}
export function partLighting(light,actor,evaluated,part,spatial){
 if(light.type!=='point')return light;
 const j=spatial?.world[part.joint]||evaluated.world[part.joint],t=evaluated.placement||actor.transform,r=t.rotation*rad,x=t.x+t.scale*(j.x*Math.cos(r)-j.y*Math.sin(r)),y=t.y+t.scale*(j.x*Math.sin(r)+j.y*Math.cos(r)),local=lightAt(light,x,y);
 if(actor.groundY===undefined||!spatial)return local;
 // Ground placement supplies scene depth. Use the visible side's rotated normal,
 // so a fire behind a near-side camper cannot paint a highlight on their back.
 const m=j.m,side=m[8]<0?-1:1,nx=side*(m[2]*Math.cos(r)-m[5]*Math.sin(r)),ny=side*(m[2]*Math.sin(r)+m[5]*Math.cos(r)),nz=side*m[8],dx=light.pointX-x,dy=light.pointY-y,dz=(light.pointY-(evaluated.groundY??actor.groundY))*2-j.z*t.scale,distance=Math.hypot(dx,dy,dz)||1,exposure=Math.round(Math.max(0,Math.min(1,(nx*dx+ny*dy+nz*dz)/distance*1.8))*50)/50;
 return {...local,intensity:local.intensity*exposure,surfaceExposure:exposure};
}

export function shadowVectors(light,anchor={x:0,y:0}){const reach=light.shadowLength??1,length=reach/Math.tan(light.elevation*rad);return light.type==='point'?{x:reach*(anchor.x-light.pointX)/light.pointHeight,y:reach*(light.floorY-light.pointY-light.pointHeight)/light.pointHeight}:{x:-Math.cos(light.angle*rad)*length*.65,y:Math.sin(light.angle*rad)*length*.65};}
export function shadowProjection(light,anchor){const {x,y}=shadowVectors(light,anchor);return `matrix(1 0 ${-x} ${-y} ${x*light.floorY} ${light.floorY*(1+y)})`;}
export function wallProjection(light,anchor){const {x,y}=shadowVectors(light,anchor);if(light.receiver!=='corner'||y>=-.0001||light.floorY<light.wallY)return null;const reach=(light.floorY-light.wallY)/-y;return `translate(${x*reach} ${light.wallY-light.floorY+reach})`;}
export function contactShadow(actor,pack,evaluated,light){const t=evaluated.placement||actor.transform,r=t.rotation*rad,points=[];
 for(const [id,body] of Object.entries(pack.physics?.bodies||{})){const j=evaluated.world[id];if(!j)continue;const angle=(j.rotation+t.rotation)*rad;
  for(const x of [body.x-body.width/2,body.x+body.width/2])for(const y of [body.y-body.height/2,body.y+body.height/2])points.push({x:t.x+t.scale*(j.x*Math.cos(r)-j.y*Math.sin(r)+x*Math.cos(angle)-y*Math.sin(angle)),y:t.y+t.scale*(j.x*Math.sin(r)+j.y*Math.cos(r)+x*Math.sin(angle)+y*Math.cos(angle))});
 }
 if(!points.length)return {cx:t.x,rx:24*t.scale,opacity:0};
 const bottom=Math.max(...points.map(p=>p.y)),height=Math.max(0,light.floorY-bottom),feet=points.filter(p=>p.y>bottom-20*t.scale),left=Math.min(...feet.map(p=>p.x)),right=Math.max(...feet.map(p=>p.x));
 return {cx:(left+right)/2,rx:Math.max(12,(right-left)*.55)+height*.12,opacity:light.floorShadow*.8*Math.exp(-height/65)};
}
export function lightingDefinitions(light,bounds,prefix){if(!light.enabled)return '';const {width:w,height:h}=bounds;
 return `<defs><filter id="${prefix}-shadow" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${light.softness}" result="blur"/><feFlood flood-color="${light.shadowColor}"/><feComposite in2="blur" operator="in"/></filter><clipPath id="${prefix}-floor"><rect y="${light.wallY}" width="${w}" height="${h}"/></clipPath><clipPath id="${prefix}-wall"><rect width="${w}" height="${light.wallY}"/></clipPath><linearGradient id="${prefix}-fade" x1="0" x2="0" y1="${light.floorY}" y2="${Math.min(h,light.floorY+100)}" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${prefix}-mirror-mask" maskUnits="userSpaceOnUse" x="0" y="${light.floorY}" width="${w}" height="${Math.max(0,h-light.floorY)}"><rect y="${light.floorY}" width="${w}" height="${h}" fill="url(#${prefix}-fade)"/></mask><radialGradient id="${prefix}-wash" data-light-wash-gradient="" cx="${light.type==='point'?light.pointX/w:.5+Math.cos(light.angle*rad)*.45}" cy="${light.type==='point'?light.pointY/h:0}" r="1"><stop stop-color="${light.color}" stop-opacity="${light.intensity*.2}"/><stop offset="1" stop-color="${light.shadowColor}" stop-opacity="${(1-light.ambient)*.2}"/></radialGradient></defs>`;
}
