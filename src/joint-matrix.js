/** Row-major matrices for camera-space joint rotations. Screen Y is down and
 * positive Z faces the viewer. Roll, yaw and pitch compose in that order. */
export const I=[1,0,0,0,1,0,0,0,1],rad=Math.PI/180;
export function mul(a,b){
  const result=new Array(9);
  for(let row=0;row<9;row+=3){
    for(let col=0;col<3;col++)result[row+col]=a[row]*b[col]+a[row+1]*b[col+3]+a[row+2]*b[col+6];
  }
  return result;
}
export const apply=(m,x,y,z)=>({x:m[0]*x+m[1]*y+m[2]*z,y:m[3]*x+m[4]*y+m[5]*z,z:m[6]*x+m[7]*y+m[8]*z});
export function rotationMatrix({rotation=0,yaw=0,pitch=0}){
  const r=rotation*rad,y=yaw*rad,p=pitch*rad;
  const cr=Math.cos(r),sr=Math.sin(r),cy=Math.cos(y),sy=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p);
  return [cr*cy,cr*sy*sp-sr*cp,cr*sy*cp+sr*sp,
          sr*cy,sr*sy*sp+cr*cp,sr*sy*cp-cr*sp,-sy,cy*sp,cy*cp];
}
export function axisRotation([x,y,z],angle){
  const c=Math.cos(angle*rad),s=Math.sin(angle*rad),v=1-c;
  return [c+x*x*v,x*y*v-z*s,x*z*v+y*s, y*x*v+z*s,c+y*y*v,y*z*v-x*s,
          z*x*v-y*s,z*y*v+x*s,c+z*z*v];
}
