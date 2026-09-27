import {createLaptopArtwork} from './wwzard-laptop.js';
// Editable 2D artwork laid out against the user's approved 513 × 529 reference.
// Coordinates are kept in reference space, then attached to local rig pivots.
const gradient=(a,b,x1=0,y1=1,x2=1,y2=0,mid)=>({type:'linear',x1,y1,x2,y2,stops:mid?[[0,a],[.52,mid],[1,b]]:[[0,a],[1,b]]});
const pivots={root:[0,0],torso:[210,285],head:[232,223],hat:[233,190],hatTip:[198,136],leftArm:[191,249],leftHand:[275,317],rightArm:[249,246],rightHand:[308,295]};
const shape=(id,d,fill,shade,joint='root')=>({id,joint,d,fill,...(shade?{gradient:shade}:{}),...(joint==='root'?{}:{transform:`translate(${-pivots[joint][0]} ${-pivots[joint][1]})`})});
const bone=(id,parent,min=-180,max=180)=>({id,parent,x:pivots[id][0]-(parent?pivots[parent][0]:0),y:pivots[id][1]-(parent?pivots[parent][1]:0),rotation:0,min,max,length:0});
const pack=(name,parts)=>({name,joints:[bone('root',null)],parts,inputs:{},clips:{still:{duration:1,loop:true,tracks:{}}},states:{still:{clip:'still',transitions:[]}},initial:'still'});
const poly=points=>'M'+points.map(p=>p.map(n=>+n.toFixed(2)).join(' ')).join('L')+'Z';
// Author the same contour displacement into adjoining facets. This runs once
// when creating the asset; playback interpolates the saved control points.
// These paths use absolute M/L/Q/C commands, with coordinate pairs throughout.
const contour=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,pair=>move(...pair.split(/\s+/).map(Number)).map(n=>+n.toFixed(3)).join(' '));

export function createWwzardArtwork(){
  const room=pack('Window and plant',[
    shape('window-top','M315 63L324 58L425 114L416 120Z','#eeefff'),
    shape('window-right','M416 120L425 114L425 248L416 253Z','#d1d2f9',gradient('#b9bdf0','#e5e3ff')),
    shape('window-frame','M315 63L416 120L416 253L315 196Z','#d6d9f5',gradient('#b8c0e7','#e4e5fa')),
    // Recess the glazing behind the jambs. Broad, quiet facets and the sill
    // give the opening depth without adding a wall or changing the room rig.
    shape('window-inner','M324 78L408 125L408 236L324 188Z','#829dc8',gradient('#7187b4','#becae9',0,0,1,1)),
    shape('window-glass','M335 90L402 127L402 220L335 183Z','#99d1fa',gradient('#d7edf6','#81b9e7',0,1,1,0)),
    shape('window-cloud','M336 116Q345 112 351 122L356 131L336 121Z','#d5ebf6',gradient('#bdddf0','#e1f0f8')),
    shape('window-distant-cloud','M372 174Q385 169 402 187L402 220L372 203Z','#bce3ed',gradient('#d8ecf1','#b2d5e5')),
    shape('window-moon','M396 139C400 153 383 158 377 144C371 129 389 124 394 135Z','#fffed9',gradient('#fffee2','#fffcc9')),
    shape('window-left-reveal','M324 78L335 90L335 183L324 188Z','#8a9cc7',gradient('#788cb7','#b4c4e2',0,0,1,0)),
    shape('window-right-reveal','M402 127L408 125L408 236L402 220Z','#edf0fd',gradient('#c6cce8','#f1f2fc',0,1,1,0)),
    shape('window-bottom-reveal','M324 188L335 183L402 220L408 236Z','#c3cde9',gradient('#a0b3d6','#e0e7f7',0,0,0,1)),
    shape('window-mullion-shadow','M367 108L374 112L374 205L367 201ZM335 135L402 172L402 180L335 143Z','#87a3cd'),
    shape('window-mullion','M364 106L370 109L370 202L364 199ZM335 133L402 170L402 176L335 139Z','#eef1fd',gradient('#d6deef','#f4f5ff',0,1,1,0)),
    shape('window-left-rim','M323 78L326 80L326 187L323 185Z','#f6f5ff'),
    shape('window-sill-top','M315 190L428 254L411 264L298 200Z','#edeffd',gradient('#cad4ee','#f6f5ff',0,1,1,0)),
    shape('window-sill-front','M298 200L411 264L411 271L298 207Z','#b0bcdf',gradient('#a1afd5','#d6dcf1',0,1,1,0)),
    shape('window-sill-end','M411 264L428 254L428 261L411 271Z','#c7cef0'),
    // Paint the rear rim and soil before the foliage; only the front pot faces
    // and lip cover the stems. The complete top diamond must not cut the leaves.
    shape('pot-top','M65 314L101 295L136 315L101 336Z','#d4d8ff'),
    shape('pot-soil','M74 315L102 302L127 316L102 330Z','#785f59'),
    shape('plant-stem','M98 327Q100 295 100 267L106 262Q110 294 103 329Z','#37885c',gradient('#245f54','#79ba53')),
    shape('plant-tall-leaf','M100 307C81 287 66 247 73 220Q75 214 81 220C101 232 119 266 102 302Z','#62a950',gradient('#287f64','#b0d761',.5,1,.2,0)),
    shape('plant-tall-light','M76 219C85 244 95 274 100 298C91 286 77 259 73 240Q70 223 76 219Z','#96c960',gradient('#529a51','#b8db6d',.8,1,0,0)),
    shape('plant-right-leaf','M100 308C103 273 126 250 152 247Q160 247 155 254C142 276 119 296 101 316Z','#62a554',gradient('#237962','#b5d66a',0,1,1,0)),
    shape('plant-left-leaf','M98 321C80 304 60 283 51 272Q46 267 57 264C83 257 105 281 102 314Z','#78b259',gradient('#398b60','#aed566',1,1,0,0)),
    shape('plant-left-vein','M53 268Q81 285 101 316C84 300 68 285 53 268Z','#a0ce68',gradient('#548f58','#b3d772',1,1,0,0)),
    shape('plant-low-right','M100 323C112 296 133 286 151 295Q158 298 154 302C128 308 113 320 100 331Z','#7ab157',gradient('#3b8f63','#b6d66e',0,1,1,0)),
    shape('plant-base','M87 307L101 317L119 307L107 326L100 329Z','#3b7e5b',gradient('#246754','#57905a')),
    shape('pot-left','M65 314L101 336L102 374L74 358Z','#aebaf7',gradient('#8798db','#cdd4ff',.7,1,0,0)),
    shape('pot-right','M101 336L136 315L128 358L102 374Z','#c4cbfc',gradient('#8c9bdc','#dee0ff',0,1,1,0)),
    shape('pot-lip','M65 314L101 332L136 315L136 320L101 341L65 319Z','#e3e5ff'),
  ]);
  room.parts.push(shape('desk-shadow','M144 391L438 414L259 509L99 418Z','#c9cfff'));
  const desk=pack('Isometric desk',[
    // An opaque silhouette under the adjacent faces prevents antialias seams
    // from revealing the moving robe through the tabletop's shared edges.
    shape('desk-solid','M144 355L296 274L439 355L439 426L288 509L144 425Z','#9aa9d5'),
    shape('desk-top','M144 355L296 274L439 355L288 439Z','#e4e6ff',gradient('#c8cff6','#f1f0ff',0,1,.75,0)),
    shape('desk-left','M144 355L288 437L288 509L144 425Z','#9aa9d5',gradient('#667aa8','#c4c9ee',.5,1,.3,0)),
    shape('desk-right','M288 437L439 355L439 426L288 509Z','#9557d0',gradient('#6241b4','#b576e0',0,1,1,0)),
  ]);
  const {keyboard,screen}=createLaptopArtwork();
  const P=(id,d,fill,g,j='torso')=>shape(id,d,fill,g,j);
  const parts=[
    P('robe-body','M169 253Q168 233 184 226L211 216L242 229Q255 236 257 252L253 288L274 313L278 361Q282 384 264 396L184 418Q166 400 162 366Z','#762561',gradient('#46264c','#a12b81',.3,.66,.8,0)),
    P('robe-soft-shoulder','M169 252Q167 234 184 226L211 216L238 228L211 251L172 277Z','#842567',gradient('#652452','#aa3081',.25,1,.8,0)),
    P('robe-front-fold','M233 241L253 236L253 287L276 309L241 296Z','#7a2262',gradient('#502344','#942979',.5,1,.8,0)),
    P('robe-wrinkle','M186 247Q193 248 196 255L194 256Q192 251 186 249Z','#762960',null),
    P('neck','M202 211L238 205L269 204L263 229L239 242L211 231Z','#ead2b3',gradient('#d5bda7','#fff4d4',0,1,.85,0),'head'),
    P('neck-light','M238 216L263 210L263 229L239 242Z','#fff0cd',gradient('#e9d2b7','#fff8d8',0,1,.7,0),'head'),
    P('right-sleeve','M237 234Q246 233 259 237L293 246L297 268L285 278L246 265L234 253Z','#832766',gradient('#552150','#aa3382',.6,1,.6,0),'rightArm'),
    P('right-cuff','M289 247Q300 244 305 254L302 272Q295 281 285 276L284 268Z','#682452',gradient('#582149','#8f386d'),'rightArm'),
    P('right-hand','M293 249Q304 242 315 251Q322 257 323 265L317 272L311 269L308 277L300 278Q289 277 287 269Q285 259 293 249Z','#f5e1c1',gradient('#dbbfaa','#fff6d8',.1,1,.8,0),'rightHand'),
    P('right-thumb','M311 257Q317 254 320 260L324 266L319 272L314 269L310 269Z','#f6dfbd',gradient('#e9cbb0','#fff0cf'),'rightHand'),
    P('left-sleeve','M181 244Q193 234 207 246Q218 259 229 272Q246 281 263 290L265 309L251 321Q236.5 315 222 309Q203.5 297 185 285Q169 272 177 253Z','#812364',gradient('#52234e','#a13280',.3,1,.8,0),'leftArm'),
    P('left-sleeve-shadow','M186 279Q205 289 224 299L251 310L254 320L221 309Q203 297 185 285Z','#62214f',gradient('#52214c','#802561'),'leftArm'),
    P('left-hand','M262 296Q271 290 279 301L286 307Q290 314 284 318L278 319L274 325L266 323Q253 322 253 312Q252 303 262 296Z','#f6e2c2',gradient('#debea3','#fff7d8',0,1,.8,0),'leftHand'),
    P('left-thumb','M275 303Q281 301 286 307L291 313L288 318L281 317L277 313Z','#f2d6b4',gradient('#dfbd9e','#fff0d0'),'leftHand'),
    P('hat-back-brim','M168 182Q208 161 263 145Q282 135 303 145Q330 154 326 169Q323 183 299 193L210 215Q174 211 165 199Q160 190 168 182Z','#6a419d',gradient('#44367f','#9b43ad',0,1,1,0),'hat'),
    P('hat-crown','M169 122L213 99Q216 97 220 101L246 118L275 154L266 177L213 194L190 169L200 137L142 181Z','#594092',gradient('#303463','#9e43ac',0,.75,1,.1),'hat'),
    P('hat-crown-shade','M169 122L201 107L201 137L190 169L142 181Z','#3d396f',gradient('#303157','#515094',0,1,.9,0),'hat'),
    P('hat-fold','M169 122L201 107L201 137L142 181Z','#46417a',gradient('#33345f','#5c5296',0,1,1,0),'hat'),
    P('hat-crown-lit','M213 99Q216 97 220 101L246 118L275 154L264 170L216 181L201 138Z','#8041a2',gradient('#493780','#b449b5',.1,1,.8,0),'hat'),
    P('hat-band','M192 169L213 183Q240 183 266 168L276 155L289 157L280 177Q254 197 211 202L185 189Z','#433278',gradient('#30265f','#62398c',0,1,1,0),'hat'),
    P('hat-front-brim','M165 186Q183 207 218 205Q275 202 313 174L326 166Q326 181 297 196Q259 217 213 220Q180 217 166 204Q161 198 165 186Z','#57368c',gradient('#363071','#8543a6',0,1,1,0),'hat'),
    P('hat-brim-light-edge','M169 204Q196 223 248 211Q291 201 313 184L309 190Q275 215 221 222Q186 220 169 208Z','#9251b4',gradient('#4a3884','#a953ba',0,1,1,0),'hat'),
    P('buckle-shadow','M246 164L263 155Q267 153 270 158L282 177L267 190Q263 193 260 188L247 171Z','#a7626b',null,'hat'),
    P('buckle-gold','M246 160L260 153Q266 150 269 155L281 175Q284 181 278 184L266 191Q262 193 258 188L245 168Q242 163 246 160Z','#f8c84f',gradient('#df9f34','#ffe785',.25,1,.5,0),'hat'),
    P('buckle-hole','M251 164L264 157L275 176L264 184Z','#63428e',gradient('#594185','#9460a8'),'hat'),
    P('buckle-edge','M246 160L260 153Q265 151 267 154L264 157L251 164L247 165Z','#ffeda1',null,'hat'),
  ];
  // Complete robe 0 < near upper arm 2 < desk 5 < keyboard 10 < far forearm 20 <
  // head 30 < near forearm 40 < laptop lid 50. Furniture occludes the
  // full robe as it moves; its lower contour is not trimmed to the desk edge.
  for(const part of parts){
    if(['robe-body','robe-soft-shoulder','robe-front-fold','robe-wrinkle'].includes(part.id))part.spatial={sceneDepth:{value:0}};
    if(['rightArm','rightHand'].includes(part.joint))part.spatial={sceneDepth:{value:20,channel:'rightArm.z'}};
    if(['leftArm','leftHand'].includes(part.joint))part.spatial={sceneDepth:{value:40,channel:'leftArm.z'}};
  }
  // The far shoulder sits behind the robe, the near shoulder in front of it.
  // Both remain behind furniture while their forearms independently reach over
  // the keyboard. Each sleeve keeps one continuous contour and gradient.
  // Keep the near split proximal to the elbow. At x=29 the resting elbow
  // crosses the closed lid while still in the rear fragment, exposing a cut.
  for(const [id,at,upper,value,channel] of [['right-sleeve',17,-10,20,'rightArm.z'],['left-sleeve',10,2,40,'leftArm.z']]){
    const part=parts.find(part=>part.id===id);
    part.spatial={depthSplit:{axis:'x',at,low:{value:upper},high:{value,channel}}};
  }
  parts.find(part=>part.id==='left-sleeve-shadow').spatial={surfaceOf:'left-sleeve'};
  const morph=(id,channel,target)=>{
    const part=parts.find(part=>part.id===id);
    part.spatial={...part.spatial,morph:{channel,target:typeof target==='function'?contour(part.d,target):target}};
  };
  // Compress the robe through its middle, keeping the collar and hem anchored.
  const robe=(x,y)=>{const t=Math.max(0,Math.min(1,(y-230)/105)),weight=Math.sin(t*Math.PI);return [x-9*weight,y+7*weight];};
  for(const id of ['robe-body','robe-soft-shoulder','robe-front-fold','robe-wrinkle'])morph(id,'torso.bend',robe);
  // Flex the whole folded crown, including its shared facet edges. The brim
  // and buckle stay firm. Keeping the fold on the hat avoids a detached flap.
  const crown=(x,y)=>{const tip=Math.max(0,Math.min(1,(213-x)/71)),height=Math.max(0,Math.min(1,(169-y)/70));return [x+14*tip*tip+4*height,y+20*tip*tip+6*height];};
  for(const id of ['hat-crown','hat-crown-shade','hat-fold','hat-crown-lit'])morph(id,'hatTip.bend',crown);
  // The far sleeve bows at its elbow and raises the cuff by exactly 10 units.
  // The hand's y track uses the same amount, preserving wrist overlap.
  const farSleeve=(x,y)=>{const t=Math.max(0,Math.min(1,(x-249)/35)),bow=Math.sin(t*Math.PI);return [x-3*bow,y-10*t+7*bow];};
  for(const id of ['right-sleeve','right-cuff'])morph(id,'rightArm.bend',farSleeve);
  // Near elbow folds more deeply; both contour edges and the underside shadow
  // share a target drawing. Cuff points move up 12, matching leftHand.y.
  morph('left-sleeve','leftArm.bend','M181 244Q193 234 207 246Q208 265 216 282Q237 299 263 278L265 297L251 309Q233 324 217 317Q191 305 185 285Q169 272 177 253Z');
  morph('left-sleeve-shadow','leftArm.bend','M186 279Q200 299 220 305L251 298L254 308L216 317Q191 305 185 285Z');
  // Rest the hands over the keys, leaving the new palm rest and trackpad free.
  for(const part of parts){
    const near=['leftArm','leftHand'].includes(part.joint),far=['rightArm','rightHand'].includes(part.joint);
    if(!near&&!far)continue;
    const hand=part.joint.endsWith('Hand'),shift=near?[8,9]:[8,32],origin=near?191:249,span=near?76:51;
    const move=(x,y)=>{const t=hand?1:Math.max(0,Math.min(1,(x-origin)/span));return [x+shift[0]*t,y+shift[1]*t];};
    part.d=contour(part.d,move);
    if(part.spatial?.morph)part.spatial.morph.target=contour(part.spatial.morph.target,move);
  }
  const wwzard={name:'Wwwzard',spatial:true,parts,joints:[bone('root',null,-8,8),bone('torso','root',-12,12),bone('head','torso',-19,19),bone('hat','head',-18,18),bone('hatTip','hat',-24,24),bone('leftArm','torso',-45,38),bone('leftHand','leftArm',-28,28),bone('rightArm','torso',-67,35),bone('rightHand','rightArm',-30,30)]};
  // Four reusable drawing slots, animated by the typing clip. Root attachment
  // keeps their rise independent of torso/head gestures; no DOM spawning.
  for(const [i,size,x,y] of [[1,8,327,236],[2,5,344,229],[3,10,333,237],[4,6,350,226]]){
    const id=`magic-${i}`,diamond=scale=>`M0 ${-size*scale}L${size*.8*scale} 0L0 ${size*scale}L${-size*.8*scale} 0Z`;
    wwzard.joints.push({id,parent:'root',x,y,rotation:0,min:-180,max:180,length:0});
    parts.push({id,joint:id,d:diamond(.25),fill:'#b576e5',gradient:gradient('#8350c5','#d9a7ef'),opacityChannel:id+'.opacity',spatial:{sceneDepth:{value:25},morph:{channel:id+'.bend',target:diamond(2)}}});
  }
  return {room,desk,keyboard,screen,wwzard};
}
