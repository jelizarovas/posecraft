const joint=(id,parent,x=0,y=0)=>({id,parent,x,y,rotation:0,min:-180,max:180,length:0});
const part=(id,joint,d,fill,extra={})=>({id,joint,d,fill,...extra});
const ellipse=(x,y,rx,ry)=>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0Z`;
const pack=name=>({name,spatial:true,joints:[joint('root',null)],parts:[],clips:{still:{duration:12,loop:true,tracks:{}}},inputs:{},states:{still:{clip:'still'}},initial:'still'});
const actor=(id,name,group,layer='characters')=>({id,name,pack:id,group,layer,unlit:true,transform:{x:0,y:0,scale:1,rotation:0},behavior:{mode:'animated',autoFace:false}});
const outer='M205 108C151 108 115 146 115 204V235C115 288 151 326 205 326H496C541 326 557 300 579 276C594 260 613 254 637 254H680V180H637C613 180 594 175 579 159C557 134 541 108 496 108Z';
const inner='M205 118C156 118 125 152 125 204V235C125 282 158 316 205 316H495C535 316 551 294 572 270C590 250 611 245 638 245H670V189H638C611 189 591 184 572 165C551 143 535 118 495 118Z';
// The same closed interior used by the glass clip, sampled for volume/contact queries.
export function bottleBoundary(){
 const points=[{x:205,y:118}],line=(x,y)=>points.push({x,y});
 const curve=(a,b,c,d,x,y)=>{const p=points.at(-1);for(let i=1;i<=8;i++){const t=i/8,u=1-t;line(+(u*u*u*p.x+3*u*u*t*a+3*u*t*t*c+t*t*t*x).toFixed(3),+(u*u*u*p.y+3*u*u*t*b+3*u*t*t*d+t*t*t*y).toFixed(3));}};
 curve(156,118,125,152,125,204);line(125,235);curve(125,282,158,316,205,316);line(495,316);curve(535,316,551,294,572,270);curve(590,250,611,245,638,245);line(670,245);line(670,189);line(638,189);curve(611,189,591,184,572,165);curve(551,143,535,118,495,118);return points;
}
const wave=(amplitude,cycles=1,phase=0,offset=0)=>Array.from({length:25},(_,i)=>[i*.5,+(offset+amplitude*Math.sin(i/24*Math.PI*2*cycles+phase)).toFixed(5)||0,'smooth']);
function setting(){
 const p=pack('Lamplit chart room');
 p.parts.push(part('wall','root','M0 0H800V450H0Z','#193039'),part('wall-panel','root','M48 38H752V348H48Z','#213b43'),part('window-light','root','M0 0H135L606 357H371Z','#eedab314'),part('window-light-soft','root','M0 0H47L474 357H230Z','#edddbb0b'),part('wall-moulding','root','M47 346H754','none',{stroke:'#35515a',strokeWidth:2}),part('table','root','M0 352Q400 345 800 352V450H0Z','#263d43'),part('table-edge','root','M0 351Q400 345 800 351','none',{stroke:'#688076',strokeWidth:1}));
 for(let i=0;i<7;i++)p.parts.push(part('wood-grain-'+i,'root',`M${-60+i%2*25} ${365+i*12}Q200 ${358+i*12} 430 ${366+i*12}T850 ${362+i*12}`,'none',{stroke:i%2?'#71867b16':'#101f2826',strokeWidth:i%2?1:2}));
 p.parts.push(part('stand-shadow-soft','root',ellipse(370,382,264,16),'#101e2920'),part('stand-shadow','root',ellipse(370,379,227,10),'#0d1d2850'));
 // A small compass and folded chart keep the bottle in a lived-in setting.
 p.parts.push(part('chart-shadow','root','M609 351L741 335L767 395L634 409Z','#101f283a'),part('chart-paper','root','M606 345L736 330L760 389L632 402Z','#b8bba6'),part('chart-fold','root','M675 337L696 395','none',{stroke:'#788f8566',strokeWidth:1.2}),part('chart-coast','root','M623 359L642 361L650 353L662 360L653 369L660 379L647 386M699 352L715 360L724 355L734 371L714 378L706 390','none',{stroke:'#728d82',strokeWidth:1.2}),part('chart-route','root','M646 382Q667 357 691 370T736 367','none',{stroke:'#a6856688',strokeWidth:.8}));
 p.parts.push(part('compass-shadow','root',ellipse(82,392,37,13),'#10222e50'),part('compass-brass','root',ellipse(81,385,29,16),'#ad9260'),part('compass-rim','root',ellipse(81,382,27,15),'#dfcc96'),part('compass-face','root',ellipse(81,382,23,12),'#294952'),part('compass-rose','root','M81 370L85 380L104 382L85 385L81 394L77 385L58 382L77 380Z','#adbbac'),part('compass-needle','root','M81 371L84 382L81 390L78 382Z','#c5775e'));
 return p;
}
function stand(){
 const p=pack('Carved walnut stand');
 p.parts.push(part('left-cradle','root','M183 307Q215 339 250 307L256 364H178Z','#916443'),part('right-cradle','root','M461 307Q494 339 526 307L533 364H455Z','#916443'),part('left-cradle-edge','root','M183 307Q215 339 250 307L248 318Q217 341 185 318Z','#c39966'),part('right-cradle-edge','root','M461 307Q494 339 526 307L524 318Q494 341 463 318Z','#c39966'),part('cradle-shade','root','M178 357H256V364H178ZM455 357H533V364H455Z','#493b31'),part('base-front','root','M159 359H554L564 369V380H150V369Z','#604733'),part('base-top','root','M171 353H542L554 359H159Z','#bd9061'),part('base-bevel','root','M159 359H554L564 369H150Z','#906847'),part('base-light','root','M157 371H557','none',{stroke:'#c29767',strokeWidth:1}),part('brass-plaque','root','M309 360H406V377H309Z','#c8af77'),part('plaque-edge','root','M313 363H402V374H313Z','none',{stroke:'#87724d',strokeWidth:.7}),part('plaque-anchor','root','M357 364V373M352 370Q357 378 362 370M353 366H361','none',{stroke:'#5f5d48',strokeWidth:1}),part('plaque-engraving','root','M321 367H342M321 370H337M372 367H394M377 370H394','none',{stroke:'#8b7952',strokeWidth:.7}));
 return p;
}
function world(){
 const p=pack('Ship, sails and miniature sea');p.parts.push(part('bottle-interior','root',inner,'none'));
 const add=(id,j,d,fill,extra={})=>p.parts.push(part(id,j,d,fill,{...extra,spatial:{mask:'bottle-interior',...extra.spatial}}));
 p.joints.push(joint('cloud-left','root',273,157),joint('cloud-right','root',457,183),joint('wave-back','root'),joint('ship-rock','root',352,281),joint('main-sail','ship-rock',-7,-113),joint('fore-sail','ship-rock',72,-94),joint('pennant','ship-rock',-7,-150),joint('wave-front','root'));
 add('interior-sky','root',inner,'#8caead');add('horizon-glow','root','M110 211H682V271H110Z','#b5c3b0');add('sun','root',ellipse(488,157,21,21),'#f1db9b');add('sun-halo','root',ellipse(488,157,28,28),'#f1db9b22');
 const cloud='M-47 4Q-51-6-35-9Q-37-22-20-22Q-11-34 5-23Q22-30 30-12Q55-10 49 5Z';
 add('cloud-left','cloud-left',cloud,'#dce0cb');add('cloud-right','cloud-right',cloud,'#dae0cf',{transform:'scale(.65 .55)'});
 add('distant-island','root','M118 248Q145 223 174 237L196 249Q225 232 249 249Z','#6b9290');add('gulls','root','M427 151q7-8 14 0q7-8 14 0M200 198q5-5 10 0q5-5 10 0','none',{stroke:'#557d7d',strokeWidth:1.2});
 add('deep-water','root','M100 259Q260 248 410 255T699 254V336H100Z','#2d8eaca8');
 add('rear-wave','wave-back','M75 275Q108 261 139 273T202 273T266 273T329 273T392 273T455 273T518 273T581 273T644 273T710 273V339H75Z','#4fb5c751');
 add('rear-foam','wave-back','M129 272q14-6 28 0M177 274q20-8 38-1M480 272q22-8 45 0M548 271q17-7 35 0','none',{stroke:'#d0ddc0aa',strokeWidth:1.6});
 add('ship-shadow','ship-rock',ellipse(3,18,133,7),'#1a556477');
 // Running rigging sits behind the cream canvas; standing stays cross in front.
 add('mast-main','ship-rock','M-7-147V-3','none',{stroke:'#77553b',strokeWidth:3});add('mast-fore','ship-rock','M72-120V-7','none',{stroke:'#826043',strokeWidth:2.5});
 add('back-rigging','ship-rock','M-7-145L-109-14M-7-140L116-9M72-117L-30-10M72-117L143-42','none',{stroke:'#726850',strokeWidth:1});
 add('aft-sail','ship-rock','M-15-127L-91-52L-14-28Q-29-77-15-127Z','#d4c699',{stroke:'#9f976f',strokeWidth:.8});
 const main='M-50 0Q3 9 48 0L40 79Q3 65-47 79Q-37 39-50 0Z',mainWind='M-50 0Q3 -3 48 0L43 79Q3 94-47 79Q-21 39-50 0Z';
 add('main-canvas','main-sail',main,'#f3e7c5',{stroke:'#a89d78',strokeWidth:.8,spatial:{morph:{channel:'main-sail.bend',target:mainWind}}});
 add('main-canvas-warm','main-sail','M-48 2Q-32 24-37 73L-45 77Q-36 39-48 2Z','#d6c597');add('main-seams','main-sail','M-23 6Q-17 38-21 70M4 6Q8 35 4 69M28 4Q30 36 25 69','none',{stroke:'#b6ad8880',strokeWidth:.8});
 add('canvas-compass','main-sail','M3 24L7 37L19 42L7 46L3 59L-1 46L-13 42L-1 37Z','#b98466');add('canvas-compass-core','main-sail',ellipse(3,42,3,3),'#e9d8b2');
 const fore='M-27 0Q0 5 32 0L27 59Q0 53-29 59Q-18 30-27 0Z',foreWind='M-27 0Q0 -4 32 0L30 59Q0 70-29 59Q-10 30-27 0Z';
 add('fore-canvas','fore-sail',fore,'#eee2bb',{stroke:'#a59b73',strokeWidth:.8,spatial:{morph:{channel:'fore-sail.bend',target:foreWind}}});add('fore-seams','fore-sail','M-8 4Q-2 31-7 53M13 4Q18 30 12 53','none',{stroke:'#b5a98677',strokeWidth:.8});
 add('flying-jib','ship-rock','M78-111L143-44L92-35Q96-70 78-111Z','#dfd1a7',{stroke:'#a49a75',strokeWidth:.8});
 add('main-yard','ship-rock','M-61-114L44-114','none',{stroke:'#815d40',strokeWidth:2.3});add('fore-yard','ship-rock','M43-95H109','none',{stroke:'#8b6643',strokeWidth:2});
 add('pennant','pennant','M0 0Q16 6 33 0L27 10Q15 15 0 10Z','#b97759',{spatial:{morph:{channel:'pennant.bend',target:'M0 0Q16 -6 33 0L27 10Q15 3 0 10Z'}}});
 add('bowsprit','ship-rock','M93-10L150-47','none',{stroke:'#9f8055',strokeWidth:3});add('bow-stay','ship-rock','M72-121L150-47L114 8','none',{stroke:'#746b51',strokeWidth:.9});
 add('hull','ship-rock','M-119-15L121-15Q108 15 78 33H-74Q-102 18-119-15Z','#76533b',{stroke:'#574839',strokeWidth:1});add('hull-lower','ship-rock','M-107 3Q7 11 110 1Q98 20 78 33H-74Q-95 19-107 3Z','#493f36');add('hull-strake','ship-rock','M-113-5Q0 4 117-5','none',{stroke:'#c19a65',strokeWidth:2.5});add('deck-rail','ship-rock','M-120-17L123-17','none',{stroke:'#ddc391',strokeWidth:3});add('stern-cabin','ship-rock','M-104-39L-64-34L-53-17H-106Z','#8a6646');add('cabin-roof','ship-rock','M-108-39L-62-35','none',{stroke:'#d2b480',strokeWidth:2});
 for(let i=0;i<5;i++){const x=-76+i*35;add('porthole-'+i,'ship-rock',ellipse(x,-1,3,3),'#d3b278');add('porthole-dark-'+i,'ship-rock',ellipse(x,-1,1.7,1.7),'#30484b');}
 for(let i=0;i<3;i++)add('cabin-window-'+i,'ship-rock',`M${-98+i*11}-32h6v8h-6Z`,'#ddc996');
 add('ratlines','ship-rock','M-10-118L-49-16M-3-118L25-16M-39-43H16M-31-65H10M-24-85H4','none',{stroke:'#72654faa',strokeWidth:.8});
 add('front-wave','wave-front','M78 293Q111 281 146 293T214 293T282 293T350 293T418 293T486 293T554 293T622 293T690 293V335H78Z','#9ce7de24');add('front-wave-edge','wave-front','M114 291q20-7 37 1M176 292q21-9 45 0M247 291q21-6 40 0M412 291q19-7 39 0M478 291q25-8 47 1M551 291q18-6 36 0','none',{stroke:'#dcfff0c7',strokeWidth:1.4});add('water-glints','wave-front','M210 309h32M257 304h15M460 307h41M527 303h14','none',{stroke:'#c4d8be66',strokeWidth:1});
 p.clips={};p.states={};p.inputs.action={type:'string',default:'breeze',options:['calm','breeze','gust']};p.initial='breeze';
 for(const [name,strength,cycles] of [['calm',.35,1],['breeze',1,2],['gust',1.7,3]]){
  p.clips[name]={duration:12,loop:true,tracks:{'ship-rock.rotation':wave(2.8*strength,cycles),'ship-rock.y':wave(2.1*strength,cycles,.5),'main-sail.rotation':wave(1.4*strength,cycles,.9),'main-sail.bend':wave(.15*strength,cycles,.9,.42),'fore-sail.rotation':wave(2*strength,cycles,1.2),'fore-sail.bend':wave(.15*strength,cycles,1.2,.42),'pennant.rotation':wave(3.5*strength,cycles*2),'pennant.bend':wave(.28,cycles*3,0,.5),'wave-back.x':wave(12*strength,cycles,.8),'wave-back.y':wave(1.7*strength,cycles,.2),'wave-front.x':wave(10*strength,cycles,2.3),'wave-front.y':wave(1.5*strength,cycles,1.5),'cloud-left.x':wave(16*strength,1,.7),'cloud-right.x':wave(12*strength,1,2.2)}};
  p.states[name]={clip:name,transitions:['calm','breeze','gust'].filter(v=>v!==name).map(to=>({to,duration:.55,when:{input:'action',equals:to}}))};
 }
 return p;
}
function glass(){
 const p=pack('Hand blown bottle and cork');
 p.parts.push(part('glass-wash','root',outer,'#a5d6d61c',{stroke:'#8cb0b5',strokeWidth:2.2}),part('glass-inner-edge','root',inner,'none',{stroke:'#d0e6df66',strokeWidth:1}),part('bottle-base-edge','root','M145 143Q127 166 128 205V235Q128 277 156 298','none',{stroke:'#ecf6e1aa',strokeWidth:3.5}),part('top-reflection','root','M195 119Q175 118 162 135C172 128 186 127 207 127H491Q530 125 550 149Q532 119 491 119Z','#f4f5d7a0'),part('top-reflection-fine','root','M220 132H463','none',{stroke:'#e2f2e3aa',strokeWidth:1.4}),part('lower-reflection','root','M182 310Q321 323 502 309Q538 304 557 281Q542 313 502 317H204Z','#a6d8d444'),part('glass-base-oval','root','M150 156C119 204 130 264 155 288','none',{stroke:'#73999d77',strokeWidth:1.5}),part('neck-glint','root','M608 190Q635 195 671 191L671 200Q635 202 608 196Z','#e4f1d888'),part('glass-lip','root','M669 176H684V258H669Z','#aecaca55',{stroke:'#abc8c5',strokeWidth:1.3}),part('lip-shine','root','M674 180V251','none',{stroke:'#ebf2dbb0',strokeWidth:2}));
 p.parts.push(part('cork-body','root','M682 184L720 188Q729 217 720 249L682 252Z','#a9875b',{stroke:'#715e45',strokeWidth:1.3}),part('cork-end','root','M720 188C736 189 736 249 720 249C709 247 709 190 720 188Z','#c0a274',{stroke:'#816b4c',strokeWidth:1}),part('cork-shadow','root','M682 239L719 236V249L682 252Z','#816b4c77'));
 for(let i=0;i<14;i++){const x=687+(i*17)%34,y=193+(i*23)%46;p.parts.push(part('cork-grain-'+i,'root',`M${x} ${y}l${2+i%3} ${i%2?1:-1}`,'none',{stroke:'#745e4355',strokeWidth:1}));}
 return p;
}
export function createBottle(){
 return {schemaVersion:1,kind:'scene',id:'ship-in-a-bottle',name:'Ship in a bottle',revision:0,presentation:'live',fluid:{type:'bottle',vessel:'glass',contents:'ship',pivot:{x:400,y:220},boundary:bottleBoundary(),fill:.28,damping:.8,wind:.6,ship:{joint:'ship-rock',scale:.65,mass:1}},bounds:{width:800,height:450},requiredFeatures:['spatial-rig','scene-groups','bottle-fluid'],groups:[{id:'scenery',name:'Chart room',parent:null},{id:'bottle',name:'Bottle and stand',parent:'scenery'},{id:'sailing',name:'Ship and sea',parent:null}],packs:{setting:setting(),stand:stand(),ship:world(),glass:glass()},actors:[actor('setting','Chart room','scenery','background'),actor('stand','Walnut stand','bottle','background'),{...actor('ship','Ship and miniature sea','sailing'),inputs:{action:'breeze'}},actor('glass','Bottle and cork','bottle','foreground')],lighting:{enabled:false}};
}
