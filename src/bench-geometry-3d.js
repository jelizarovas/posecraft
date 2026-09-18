/** Bench body dimensions in meters: pad width, seat-top height, and length. */
export const DEFAULT_BENCH_SIZE_3D=Object.freeze([.32,.48,1.9]);

/** Shared physical box descriptions. Rack and bar dimensions are independent. */
export function benchBodyGeometry3D(size=DEFAULT_BENCH_SIZE_3D){
  if(!Array.isArray(size)||size.length!==3||!size.every(v=>Number.isFinite(v)&&v>0))throw new Error('Bench size must be [width, seat-top height, length] in meters.');
  const [width,height,length]=size,padThickness=Math.min(.12,height*.25),railHeight=Math.min(.09,height*.2),railY=height-padThickness-railHeight*.5,legHeight=railY-railHeight*.5,footHeight=Math.min(.06,height*.125),legZ=length*.64/1.9;
  const parts=[
    {id:'pad',material:'pad',size:[width,padThickness,length],position:[0,height-padThickness*.5,0]},
    {id:'rail',material:'steel',size:[Math.min(.13,width*.5),railHeight,length*1.6/1.9],position:[0,railY,0]},
  ];
  for(const [name,z]of [['rear',-legZ],['front',legZ]]){
    parts.push({id:`${name}-leg`,material:'steel',size:[Math.min(.12,width*.45),legHeight,Math.min(.12,length*.1)],position:[0,legHeight*.5,z]});
    parts.push({id:`${name}-foot`,material:'steel',size:[width+.14,footHeight,Math.min(.27,length*.2)],position:[0,footHeight*.5,z]});
  }
  return parts;
}
