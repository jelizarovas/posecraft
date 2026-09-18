// Euler channels remain editable. Only chart-boundary intervals, where their
// numeric jump disguises a small physical turn, use spherical interpolation.
const cache=new WeakMap(),rad=Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=x=>((x+180)%360+360)%360-180;
const quaternion=({rotation=0,yaw=0,pitch=0})=>{const x=pitch*rad/2,y=yaw*rad/2,z=rotation*rad/2,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];};
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
function spherical(a,b,t){let cosine=dot(a,b);if(cosine<0){b=b.map(x=>-x);cosine=-cosine;}if(cosine>.9995){const q=a.map((x,i)=>x+(b[i]-x)*t),length=Math.hypot(...q);return q.map(x=>x/length);}const angle=Math.acos(clamp(cosine,-1,1)),scale=Math.sin(angle),u=Math.sin((1-t)*angle)/scale,v=Math.sin(t*angle)/scale;return a.map((x,i)=>x*u+b[i]*v);}
function euler([x,y,z,w]){const m0=1-2*(y*y+z*z),m1=2*(x*y-z*w),m3=2*(x*y+z*w),m4=1-2*(x*x+z*z),m6=2*(x*z-y*w),m7=2*(y*z+x*w),m8=1-2*(x*x+y*y);let yaw=Math.asin(clamp(-m6,-1,1))/rad,rotation,pitch;if(Math.hypot(m0,m3)<1e-7){rotation=Math.atan2(-m1,m4)/rad;pitch=0;}else{rotation=Math.atan2(m3,m0)/rad;pitch=Math.atan2(m7,m8)/rad;}if(pitch>90){pitch-=180;yaw=180-yaw;rotation+=180;}else if(pitch< -90){pitch+=180;yaw=-180-yaw;rotation+=180;}return {rotation:wrap(rotation),yaw:wrap(yaw),pitch:clamp(pitch,-90,90)};}
function unchanged(entry,tracks,pitches,mode){if(!entry||entry.mode!==mode||entry.pitches.length!==pitches.length||entry.pitches.some((key,i)=>key!==pitches[i]))return false;for(const input of entry.inputs){const track=tracks[input.key];if(track!==input.track||track?.length!==input.values?.length)return false;if(track)for(let i=0;i<track.length;i++){const a=track[i],b=input.values[i];if(a.length!==b.length||a.some((v,j)=>v!==b[j]))return false;}}return true;}
export function repairRotationCharts(tracks,time,pose,interpolate,mode){
 const pitches=Object.keys(tracks).filter(key=>key.endsWith('.pitch'));if(!pitches.length)return pose;let entry=cache.get(tracks);
 if(!unchanged(entry,tracks,pitches,mode)){
  const inputs=[],windows=[];
  for(const key of pitches){const prefix=key.slice(0,-6),pitchTrack=tracks[key];for(const channel of ['rotation','yaw','pitch']){const name=prefix+'.'+channel,track=tracks[name];inputs.push({key:name,track,values:track?.map(key=>[...key])});}
   const sample=t=>Object.fromEntries(['rotation','yaw','pitch'].map(channel=>[channel,tracks[prefix+'.'+channel]?interpolate(tracks[prefix+'.'+channel],t,mode,channel==='yaw'?'yaw':channel==='rotation'):0]));
   for(let i=1;i<pitchTrack.length;i++){const a=pitchTrack[i-1],b=pitchTrack[i];if(Math.abs(b[1]-a[1])<=90)continue;const stepped=['rotation','yaw','pitch'].some(channel=>{const track=tracks[prefix+'.'+channel]||[];return track.some((key,index)=>index<track.length-1&&key[0]<b[0]&&track[index+1][0]>a[0]&&(key[2]||mode||'smooth')==='step');});if(stepped)continue;const start=sample(a[0]),end=sample(b[0]);if(Math.abs(wrap(end.rotation-start.rotation))<=90)continue;const qa=quaternion(start),qb=quaternion(end);if(Math.abs(dot(qa,qb))<Math.SQRT1_2)continue;windows.push({prefix,start:a[0],end:b[0],a:qa,b:qb,easing:a[2]||mode||'smooth'});}
  }
  entry={mode,pitches,inputs,windows};cache.set(tracks,entry);
 }
 for(const window of entry.windows){if(time<=window.start||time>=window.end||window.easing==='step')continue;let t=(time-window.start)/(window.end-window.start);if(window.easing==='smooth')t=t*t*(3-2*t);for(const [channel,value]of Object.entries(euler(spherical(window.a,window.b,t))))pose[window.prefix+'.'+channel]=value;}
 return pose;
}
