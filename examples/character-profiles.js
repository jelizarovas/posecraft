// Portable collision geometry and authored protective targets for the supplied artwork.
export function addResponseProfile(doc){
 const id=doc.actors[0].pack,p=doc.packs[id];
 const box=(width,height,x=0,y=0,density=1)=>({width,height,x,y,density});
 const bodies=id==='ona'?{root:box(48,39,0,20,2),head:box(80,53,0,-27,1),leftArm:box(14,30,-7,14,.6),rightArm:box(14,30,7,14,.6),leftFoot:box(19,13,0,8),rightFoot:box(19,13,0,8)}:id==='rusty'?{root:box(29,43,9,4,2),tail:box(30,12,-6,5,.3),backPaw:box(15,28,0,14,.6),frontPaw:box(11,31,7,16,.6),head:box(56,43,13,-24)}:{root:box(104,74,0,43,2),torso:box(103,113,0,-60,1),head:box(72,67,0,8),...Object.fromEntries(['left','right'].flatMap(side=>[[side+'Upper',box(60,30,30,0,.5)],[side+'Lower',box(59,28,30,0,.5)],[side+'Hand',box(23,20,12,0,.4)],[side+'Thigh',box(49,20,25,0)],[side+'Calf',box(47,17,24,0)],[side+'Foot',box(36,18,8,2)]]))};
 const responses=id==='ona'?{
  brace:{'leftArm.rotation':65,'rightArm.rotation':-65,'head.rotation':-10,'leftFoot.rotation':-20,'rightFoot.rotation':20},
  protect:{'leftArm.rotation':115,'rightArm.rotation':-115,'head.rotation':18},
  curl:{'leftArm.rotation':-75,'rightArm.rotation':75,'head.rotation':25,'leftFoot.rotation':35,'rightFoot.rotation':-35}
 }:id==='rusty'?{
  brace:{'frontPaw.rotation':-22,'backPaw.rotation':-12,'head.rotation':-15},protect:{'head.rotation':30,'frontPaw.rotation':-25,'tail.rotation':30},curl:{'head.rotation':35,'frontPaw.rotation':25,'tail.rotation':35}
 }:{
  brace:{'leftUpper.rotation':65,'leftLower.rotation':-30,'rightUpper.rotation':115,'rightLower.rotation':30,'head.rotation':-12},
  protect:{'leftUpper.rotation':20,'leftLower.rotation':-120,'rightUpper.rotation':160,'rightLower.rotation':120,'head.rotation':16},
  curl:{'leftUpper.rotation':50,'leftLower.rotation':-130,'rightUpper.rotation':130,'rightLower.rotation':130,'head.rotation':18}
 };
 p.physics={root:'root',head:'head',bodies,responses};
 const added=['scared','hurt','dizzy','focused','relieved','wink'];p.inputs.emotion.options=[...new Set([...p.inputs.emotion.options,...added])];
 Object.assign(p.expressions,{scared:{'head.rotation':-8},hurt:{'head.rotation':14},dizzy:{'head.rotation':10},focused:{'head.rotation':-5},relieved:{'head.rotation':3},wink:{'head.rotation':-7}});
 for(const part of p.parts)if(part.variantInput==='emotion'){
  const v=part.variants;v.scared={...(v.surprised||{})};v.hurt={transform:'scale(1 .12)'};v.dizzy={transform:'rotate(15) scale(1 .55)'};v.focused={...(v.angry||{})};v.relieved={...(v.happy||{})};v.wink={transform:'scale(1 .15)'};
  if(part.id==='mouth')Object.assign(v,{scared:{d:'M-4 0A4 6 0 1 0 4 0A4 6 0 1 0 -4 0'},hurt:{d:'M-8 3L-4 0L0 3L4 0L8 3'},dizzy:{d:'M-7 2Q-3 -2 0 2T7 2'},focused:{d:'M-6 2L6 2'},relieved:{d:'M-6 1Q0 7 6 1'},wink:{d:'M-6 1Q0 6 6 0'}});
  if(part.id==='brows')Object.assign(v,{scared:{d:'M-23 -23L-10 -29M10 -29L23 -23'},hurt:{d:'M-23 -25L-10 -20M10 -20L23 -25'},dizzy:{visible:false},focused:{...v.angry},relieved:{visible:false},wink:{visible:false}});
 }
 // Ona already has a mouth and eyebrows. Give the other faces separate paths
 // so responses change facial geometry, not only the angle of the head.
 if(id!=='ona'){
  p.parts=p.parts.filter(part=>!['response-mouth','response-brows','hurt-cheek'].includes(part.id));
  const mouth=id==='rusty'?{x:24,y:-12,scale:.55}:{x:3,y:31,scale:1};
  p.parts.push({id:'response-mouth',joint:'head',d:'M-7 0Q0 3 7 0',fill:'none',stroke:'#42313a',strokeWidth:1.8,transform:`translate(${mouth.x} ${mouth.y}) scale(${mouth.scale})`,variantInput:'emotion',variants:{neutral:{visible:false},happy:{d:'M-8 -1Q0 10 8 -1'},excited:{d:'M-7 0Q0 14 7 0Z'},sad:{d:'M-7 4Q0 -3 7 4'},angry:{d:'M-7 2L7 0'},surprised:{d:'M-3 0A3 5 0 1 0 3 0A3 5 0 1 0 -3 0'},sleepy:{d:'M-4 1L4 1'},curious:{d:'M-6 2Q0 -1 6 1'},scared:{d:'M-4 0A4 6 0 1 0 4 0A4 6 0 1 0 -4 0'},hurt:{d:'M-8 3L-4 0L0 3L4 0L8 3'},dizzy:{d:'M-7 2Q-3 -2 0 2T7 2'},focused:{d:'M-6 1L6 1'},relieved:{d:'M-6 1Q0 7 6 1'},wink:{d:'M-6 1Q0 6 6 1'}}});
 }
 const cheeks=id==='ona'?{x:0,y:-3,s:1}:id==='rusty'?{x:17,y:-13,s:.6}:{x:3,y:23,s:.7};
 p.parts=p.parts.filter(part=>part.id!=='hurt-cheek');
 p.parts.push({id:'hurt-cheek',joint:'head',d:'M-28 0L-20 -4M-28 4L-20 0M20 -4L28 0M20 0L28 4',fill:'none',stroke:'#db666a',strokeWidth:2,transform:`translate(${cheeks.x} ${cheeks.y}) scale(${cheeks.s})`,showWhen:{input:'emotion',equals:'hurt'}});
 // One-eye wink. Right eyes retain their neutral geometry.
 for(const part of p.parts)if(part.variantInput==='emotion'&&(/rightEye|right-eye/.test(part.joint)||/eye-1|glint-1/.test(part.id)||(id==='ona'&&['face-3','face-5'].includes(part.id))))part.variants.wink={};
 doc.requiredFeatures=[...new Set([...doc.requiredFeatures,'rigid-body-physics','response-states'])];
 return doc;
}
