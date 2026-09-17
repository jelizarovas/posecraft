// Stylized receivers and surface ramps. No mesh, ray tracing or layout reads.
export const lightRanges={angle:[-180,180],elevation:[10,85],intensity:[0,2],ambient:[0,1],softness:[0,16],floorY:[0,4096],wallY:[0,4096],floorShadow:[0,1],wallShadow:[0,1],reflection:[0,.8],gloss:[0,1]};
export function lightingConfig(scene){return {enabled:false,shading:'gradient',angle:-135,elevation:45,intensity:.8,ambient:.6,color:'#fff1d6',shadowColor:'#292438',softness:3,floorY:scene.bounds.height*.82,wallY:scene.bounds.height*.66,floorShadow:.24,wallShadow:.14,reflection:.18,gloss:.25,...scene.lighting};}
const rad=Math.PI/180;
function rgb(hex){if(!/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(hex))return null;let s=hex.slice(1);if(s.length===3)s=[...s].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));}
export function surfaceRamp(fill,light){const base=rgb(fill),tint=rgb(light.color);if(!base||Math.max(...base)<65)return null;
 const color=(gain,mix)=>'#'+base.map((v,i)=>Math.round(Math.max(0,Math.min(255,v*gain*(1-mix)+tint[i]*mix))).toString(16).padStart(2,'0')).join('');
 return [color(light.ambient+light.intensity*.55,light.gloss*light.intensity*.48),color(light.ambient+light.intensity*.42,.04*light.intensity),color(light.ambient*.76,.025)];}
export function surfaceStops(ramp,light){
 // Coincident stops make an antialiased edge with no color interpolation band.
 const stops=light.shading==='cel'?[[0,ramp[0]],[.72,ramp[0]],[.72,ramp[2]],[1,ramp[2]]]:[[0,ramp[0]],[.42,ramp[1]],[1,ramp[2]]];
 return stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('');
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
export function shadowProjection(light){const length=1/Math.tan(light.elevation*rad),x=-Math.cos(light.angle*rad)*length*.65,y=.18*length;return `matrix(1 0 ${-x} ${-y} ${x*light.floorY} ${light.floorY*(1+y)})`;}
export function contactShadow(actor,pack,evaluated,light){const t=evaluated.placement||actor.transform,r=t.rotation*rad,points=[];
 for(const [id,body] of Object.entries(pack.physics?.bodies||{})){const j=evaluated.world[id];if(!j)continue;const angle=(j.rotation+t.rotation)*rad;
  for(const x of [body.x-body.width/2,body.x+body.width/2])for(const y of [body.y-body.height/2,body.y+body.height/2])points.push({x:t.x+t.scale*(j.x*Math.cos(r)-j.y*Math.sin(r)+x*Math.cos(angle)-y*Math.sin(angle)),y:t.y+t.scale*(j.x*Math.sin(r)+j.y*Math.cos(r)+x*Math.sin(angle)+y*Math.cos(angle))});
 }
 if(!points.length)return {cx:t.x,rx:24*t.scale,opacity:0};
 const bottom=Math.max(...points.map(p=>p.y)),height=Math.max(0,light.floorY-bottom),feet=points.filter(p=>p.y>bottom-20*t.scale),left=Math.min(...feet.map(p=>p.x)),right=Math.max(...feet.map(p=>p.x));
 return {cx:(left+right)/2,rx:Math.max(12,(right-left)*.55)+height*.12,opacity:light.floorShadow*.8*Math.exp(-height/65)};
}
export function lightingDefinitions(light,bounds,prefix){if(!light.enabled)return '';const {width:w,height:h}=bounds;
 return `<defs><filter id="${prefix}-shadow" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${light.softness}" result="blur"/><feFlood flood-color="${light.shadowColor}"/><feComposite in2="blur" operator="in"/></filter><clipPath id="${prefix}-floor"><rect y="${light.wallY}" width="${w}" height="${h}"/></clipPath><clipPath id="${prefix}-wall"><rect width="${w}" height="${light.wallY}"/></clipPath><linearGradient id="${prefix}-fade" x1="0" x2="0" y1="${light.floorY}" y2="${Math.min(h,light.floorY+100)}" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="${prefix}-mirror-mask" maskUnits="userSpaceOnUse" x="0" y="${light.floorY}" width="${w}" height="${Math.max(0,h-light.floorY)}"><rect y="${light.floorY}" width="${w}" height="${h}" fill="url(#${prefix}-fade)"/></mask><radialGradient id="${prefix}-wash" cx="${.5+Math.cos(light.angle*rad)*.45}" cy="0" r="1"><stop stop-color="${light.color}" stop-opacity="${light.intensity*.2}"/><stop offset="1" stop-color="${light.shadowColor}" stop-opacity="${(1-light.ambient)*.2}"/></radialGradient></defs>`;
}
