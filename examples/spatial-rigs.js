// Depth studies use the existing owner-provided artwork, with authored vector corrections.
export function addSpatialRig(pack,id){
 pack.spatial=true;
 for(const [index,p] of pack.parts.entries()){
  p.spatial={order:index};
  if(id==='ona'){
   if(p.joint==='root'||p.id.startsWith('face-')&&['face-0','face-1'].includes(p.id))Object.assign(p.spatial,{thickness:.72,axis:'x'});
   if(['eyes','mouth'].includes(p.joint)||['brows','hurt-cheek'].includes(p.id))Object.assign(p.spatial,{facing:'front',depth:24,mask:'face-0'});
   if(p.spatial.mask)Object.assign(p.spatial,{surface:{x:['face-2','face-4'].includes(p.id)?-15:['face-3','face-5'].includes(p.id)?18:0,width:44,depth:29}});
   if(p.id==='hair-back')Object.assign(p.spatial,{depth:0,thickness:.72,axis:'x',order:-10});
   if(p.id==='hair-front')Object.assign(p.spatial,{depth:0,facing:'front',facingFade:.3,thickness:.72,axis:'x',order:90});
   if(p.joint.includes('Foot'))Object.assign(p.spatial,{center:[0,6],thickness:.55,axis:'x'});
  }else{
   Object.assign(p.spatial,{center:[pack.joints.find(j=>j.id===p.joint).length/2,0]});
   if(p.id.endsWith('-shell'))Object.assign(p.spatial,{thickness:.6,axis:['head','root'].includes(p.joint)?'x':'y'});
   if(p.id.startsWith('eye-')||['mouth','hurt-cheek'].includes(p.id))Object.assign(p.spatial,{facing:'front',depth:12,mask:'head-shell'});
   if(p.spatial.mask)Object.assign(p.spatial,{surface:{x:p.id==='eye-0'?-7:p.id==='eye-1'?7:0,width:16,depth:9}});
   if(p.id==='chest-target'||p.id.endsWith('-joint'))Object.assign(p.spatial,{facing:'front',depth:2});
  }
 }
 if(id==='ona'){
  // Clean cubic paths make the rounded arm blend into a foreshortened, bent teardrop.
  pack.parts=pack.parts.filter(p=>!['leftArm','rightArm'].includes(p.joint));
  for(const side of ['left','right']){
   const sign=side==='left'?-1:1;
   const shape=(points)=>'M'+points[0]+' '+points[1]+' C'+points.slice(2,8).join(' ')+' C'+points.slice(8,14).join(' ')+' C'+points.slice(14,20).join(' ')+' Z';
   const straight=[0,0,sign*10,2,sign*16,19,sign*14,30,sign*13,40,sign*3,38,sign*3,29,sign*3,17,0,9,0,0];
   const bent=[0,0,sign*16,-4,sign*24,3,sign*21,14,sign*19,27,sign*5,27,sign*4,16,sign*3,9,0,5,0,0];
   pack.parts.push({id:side+'-arm-volume',joint:side+'Arm',d:shape(straight),fill:'#fafbf8',channel:'skin',stroke:'#383936',strokeWidth:1.7,spatial:{thickness:.6,axis:'x',center:[sign*8,16],order:side==='left'?-1:1,morph:{channel:side+'Arm.bend',target:shape(bent)}}});
  }
  pack.parts.push({id:'shirt-back-seam',joint:'root',d:'M0 5L0 33',fill:'none',stroke:'#b3913e',strokeWidth:1,spatial:{depth:-1,facing:'back'}});
  const hair=pack.inputs.hair.options;
  pack.parts.push({id:'hair-rear-cap',joint:'head',d:'M-44 -20Q-49 -52 0 -55Q49 -52 44 -20L42 9Q0 21 -42 9Z',fill:'#65504a',channel:'hair',variantInput:'hair',variants:Object.fromEntries(hair.map(h=>[h,h==='none'?{visible:false}:{}])),spatial:{depth:0,facing:'back',facingFade:.3,thickness:.72,axis:'x',order:95}});
 }else{
  // Feet retain heel/toe volume while their own yaw turns independently of the calf.
  for(const side of ['left','right']){
   const foot=pack.parts.find(p=>p.id===side+'Foot-shell');
   foot.d='M-4 -5Q5 -9 17 -5Q23 -3 22 3Q8 8 -5 4Z';
   Object.assign(foot.spatial,{thickness:.5,axis:'x',center:[8,0]});
   for(const clip of Object.values(pack.clips))clip.tracks[side+'Foot.yaw']??=[[0,side==='left'?-145:-35]];
  }
  pack.parts.push({id:'back-panel',joint:'torso',d:'M12 -9L37 -9L37 9L12 9Z M17 -5L32 -5 M17 0L32 0 M17 5L32 5',fill:'none',stroke:'#806a58',strokeWidth:1.1,spatial:{depth:-3,facing:'back'}});
 }
 const add=(name,duration,tracks)=>{pack.clips[name]={duration,loop:true,tracks};pack.states[name]={clip:name,transitions:[]};};
 const keys=(v,d)=>v.map((n,i)=>[i*d/(v.length-1),n,'smooth']);
 add('turnaround',12,{'root.yaw':keys([0,45,90,135,180,135,90,45,0,-45,-90,-135,-180,-135,-90,-45,0],12)});
 add('glance',6,{'head.yaw':keys([0,35,65,35,0,-35,-65,-35,0],6),'head.pitch':keys([0,12,0,-12,0],6)});
 if(id==='ona'){
  add('reach-depth',4,{'rightArm.bend':keys([0,0,1,1,0],4),'rightArm.z':keys([-16,-16,25,25,-16],4),'rightArm.rotation':keys([-15,-55,55,55,-15],4),'head.yaw':keys([0,20,0,-12,0],4)});
  add('tuck-jump',3,{'root.y':keys([0,8,-38,-30,0,4,0],3),'leftFoot.pitch':keys([0,0,55,55,0,0,0],3),'rightFoot.pitch':keys([0,0,55,55,0,0,0],3),'leftArm.bend':keys([0,0,1,1,0,0,0],3),'rightArm.bend':keys([0,0,1,1,0,0,0],3),'leftArm.z':keys([0,0,20,20,0,0,0],3),'rightArm.z':keys([0,0,20,20,0,0,0],3)});
 }else{
  add('reach-depth',4,{'rightUpper.yaw':keys([0,-65,-65,0],4),'rightLower.yaw':keys([0,55,55,0],4),'head.yaw':keys([0,25,0,-15,0],4)});
  add('tuck-jump',3,{'root.y':keys([0,8,-38,-30,0,4,0],3),'leftThigh.yaw':keys([0,0,-135,-135,0,0,0],3),'rightThigh.yaw':keys([0,0,-125,-125,0,0,0],3),'leftCalf.yaw':keys([0,0,170,170,0,0,0],3),'rightCalf.yaw':keys([0,0,160,160,0,0,0],3),'leftUpper.yaw':keys([0,0,-65,-65,0,0,0],3),'rightUpper.yaw':keys([0,0,-65,-65,0,0,0],3)});
 }
 add('hands-feet',6,id==='ona'?{'leftFoot.yaw':keys([0,-65,0,65,0],6),'rightFoot.yaw':keys([0,65,0,-65,0],6),'rightArm.yaw':keys([0,-70,0,70,0],6)}:{'leftFoot.yaw':keys([-145,-90,-35,-145],6),'rightFoot.yaw':keys([-35,-90,-145,-35],6),'leftFoot.pitch':keys([0,35,0,-25,0],6),'rightFoot.pitch':keys([0,-25,0,35,0],6),'rightHand.yaw':keys([0,70,0,-70,0],6),'rightHand.pitch':keys([0,45,0,-45,0],6),'rightLower.yaw':keys([0,-45,0,45,0],6)});
 if(id!=='ona')for(const clip of Object.values(pack.clips))for(const side of ['left','right'])clip.tracks[side+'Foot.yaw']??=[[0,side==='left'?-145:-35]];
 const actions=Object.keys(pack.states);pack.inputs.action.options=actions;pack.inputs.action.default='turnaround';pack.initial='turnaround';
 for(const [name,state] of Object.entries(pack.states))state.transitions=actions.filter(to=>to!==name).map(to=>({to,duration:.25,when:{input:'action',equals:to}}));
 return pack;
}
