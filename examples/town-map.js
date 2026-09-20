import {assertMap} from '../src/map.js';
import {createWoodlandMap,woodlandArt} from './woodland-map.js';
import {farmImages,farmPropBrushes} from './farm-assets.js';
import {animalCareImages,animalCareBrushes,addAnimalCare} from './animal-care-assets.js';
import {addVillageCast} from './village-cast.js';
import {addCliffValley} from './cliff-valley.js';

export const townImages={
 cottage:{src:'./assets/map/town/cottage.webp',width:342,height:228.001,anchorX:.5,anchorY:.78},
 workshop:{src:'./assets/map/town/workshop.webp',width:450,height:300,anchorX:.5,anchorY:.79},
 barn:{src:'./assets/map/town/barn.webp',width:450,height:300,anchorX:.5,anchorY:.79},
 wagon:{src:'./assets/map/town/wagon.webp',width:104,height:72,anchorX:.5,anchorY:.76},
 wheat:{src:'./assets/map/town/wheat.webp',width:72,height:48,anchorX:.5,anchorY:.63},
 ...farmImages
 ,...animalCareImages
};

export const townPropBrushes=Object.freeze([
 {id:'town-cottage',label:'Cottage',prop:{kind:'house',art:'cottage',width:4,height:3}},
 {id:'town-workshop',label:'Workshop',prop:{kind:'house',art:'workshop',width:6,height:4}},
 {id:'town-barn',label:'Barn',prop:{kind:'house',art:'barn',width:6,height:4}},
 {id:'town-wagon',label:'Wagon',prop:{kind:'decoration',art:'wagon',width:1,height:3,collision:{shape:'rect',x:.18,y:.1,width:.64,height:2.8}}},
 {id:'town-wheat',label:'Wheat',prop:{kind:'decoration',art:'wheat',width:1,height:1,collision:{shape:'none'},occlusion:{mode:'low-foliage',lowerBodyFraction:.5}}},
 ...farmPropBrushes
 ,...animalCareBrushes
]);

export function townNpcRoutes(map={width:128,height:128}){
 const cx=Math.floor(map.width/2),cy=Math.floor(map.height/2);
 return {
  'npc-farmer':[{x:cx-12.5,y:cy+8.5},{x:cx-16.5,y:cy+8.5},{x:cx-16.5,y:cy-.5},{x:cx-12.5,y:cy-.5}],
  'npc-trader':[{x:cx+.5,y:cy-.5},{x:cx+15.5,y:cy-.5},{x:cx+11.5,y:cy-.5},{x:cx+4.5,y:cy-.5}],
  'npc-villager':[{x:cx-1.5,y:cy-.5},{x:cx-1.5,y:cy+8.5},{x:cx+6.5,y:cy+8.5},{x:cx+.5,y:cy+8.5}]
 };
}

const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

/** A compact town with a connected road network and woodland beyond its farms. */
export function createTownMap({width=128,height=128,seed=2026}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<96||height<96)throw new TypeError('Town maps require integer dimensions of at least 96 tiles.');
 const map=createWoodlandMap({width,height,seed}),cx=Math.floor(width/2),cy=Math.floor(height/2);
 map.id=`town-${seed}`;map.name='Millbrook';

 const protectedCenter={x:cx-36,y:cy-24,width:72,height:49};
 map.props=map.props.filter(prop=>!overlaps(prop,protectedCenter)&&!['village-house','village-chest'].includes(prop.id));
 const paint=(x,y,w,h,value=1)=>{for(let row=y;row<y+h;row++)for(let column=x;column<x+w;column++)map.terrain[row*width+column]=value;};
 paint(protectedCenter.x,protectedCenter.y,protectedCenter.width,protectedCenter.height,0);
 paint(cx-3,cy-3,7,7);
 paint(cx-18,cy-3,37,3);
 paint(cx-2,cy-14,3,25);
 paint(cx-17,cy-3,3,14);
 paint(cx-15,cy+8,29,3);
 paint(cx+11,cy-6,2,6);
 paint(cx-24,cy+4,10,2);
 paint(cx-24,cy-10,2,16);

 // The east creek stays beyond the village loop. Two grass-road crossings keep
 // it part of the town instead of turning it into a wall at the map edge.
 for(let y=cy-22;y<=cy+19;y++){
  const bend=Math.round(1.4*Math.sin((y-cy)/5));
  paint(cx+24+bend,y,2,1,2);
 }
 for(let y=cy+8;y<=cy+18;y++){
  const inset=Math.abs(y-(cy+13));
  paint(cx+27-inset/3|0,y,Math.max(2,7-Math.floor(inset/2)),1,2);
 }
 paint(cx+22,cy-2,7,2,1);
 paint(cx+22,cy+13,7,2,1);

 const house=(id,art,x,y,w,h)=>({id,kind:'house',art,x,y,width:w,height:h});
 map.props.push(
  house('village-house','inn',cx-2,cy-6,4,3),
  house('cottage-west','cottage',cx-9,cy-6,4,3),
  house('cottage-east','cottage',cx+4,cy-6,4,3),
  house('town-workshop','workshop',cx+10,cy-7,6,4),
  house('town-granary','cottage',cx-16,cy-6,4,3),
  house('town-barn','barn',cx-16,cy+4,6,4),
  house('cottage-south','cottage',cx-7,cy+5,4,3),
  house('east-stable','barn',cx+7,cy+4,6,4),
  {id:'village-chest',kind:'chest',x:cx-5,y:cy+2,width:1,height:1},
  {id:'town-wagon',kind:'decoration',art:'wagon',x:cx+15,y:cy+2,width:1,height:3,collision:{shape:'rect',x:.18,y:.1,width:.64,height:2.8}},
  {id:'showcase-branch',kind:'decoration',art:'editor-branches',x:cx+28,y:cy-8,width:1,height:1,collision:{shape:'rect',x:.08,y:.4,width:.84,height:.18},traversal:{activation:'auto',kind:'vault',height:.28,style:'branch'}},
  {id:'showcase-ridge',kind:'decoration',art:'editor-ridge',x:cx+27,y:cy-14,width:3,height:3,collision:{shape:'rect',x:0,y:.96,width:3,height:.22},traversal:{activation:'click',kind:'climb',height:.4,endpoints:[{x:1.5,y:2.85},{x:1.5,y:.15}]}}
 );

 const plantings=[
  ['oak-lawn-west','tree','oak',cx-10,cy+2,.24],
  ['oak-lawn-south','tree','oak',cx-8,cy+12,.24],
  ['oak-lawn-east','tree','oak',cx+15,cy+8,.24],
  ['oak-workshop','tree','oak',cx+16,cy-7,.24],
  ['oak-farm','tree','oak',cx-20,cy-9,.24],
  ['oak-stable','tree','oak',cx+14,cy+1,.24],
  ['bush-field-1','decoration','editor-bush',cx-34,cy-11,.18],
  ['bush-field-2','decoration','editor-bush',cx-31,cy-11,.18],
  ['bush-field-3','decoration','editor-bush',cx-28,cy-11,.18],
  ['bush-field-4','decoration','editor-bush',cx-25,cy-11,.18],
  ['bush-cottage-west','decoration','editor-bush',cx-9,cy-8,.18],
  ['bush-cottage-east','decoration','editor-bush',cx+8,cy-8,.18],
  ['bush-south-1','decoration','editor-bush',cx-9,cy+4,.18],
  ['bush-south-2','decoration','editor-bush',cx-8,cy+4,.18]
 ];
 for(const [id,kind,art,x,y,radius] of plantings)map.props.push({id,kind,art,x,y,width:1,height:1,collision:{shape:'circle',radius}});

 for(let row=0;row<13;row++)for(let column=0;column<11;column++){
  const x=cx-35+column,y=cy-9+row;
  map.props.push({id:`wheat-${row}-${column}`,kind:'decoration',art:'wheat',x,y,width:1,height:1,collision:{shape:'none'},occlusion:{mode:'low-foliage',lowerBodyFraction:.5}});
 }

 const farmBrushByArt=new Map(farmPropBrushes.map(brush=>[brush.prop.art,brush.prop]));
 const farmProp=(id,art,x,y,overrides={})=>{
  const source=farmBrushByArt.get(art);
  if(!source)throw new Error(`Missing farm prop brush for ${art}`);
  return {...structuredClone(source),id,art,x,y,...overrides};
 };
 const addPatch=(prefix,art,x,y,columns,rows,spacing=1)=>{
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++)
   map.props.push(farmProp(`${prefix}-${row}-${column}`,art,x+column*spacing,y+row*spacing));
 };

 // Three distinct crop plots make the west farm read as working land. The
 // original wheat remains nearest the barn, with produce and fallow soil north.
 // Adjacent planted cells form full fields, with a lane between plots.
 addPatch('pumpkin','farm-pumpkin',cx-34,cy-21,10,6);
 addPatch('vegetables','farm-vegetables',cx-23,cy-21,10,6);
 addPatch('corn','farm-corn',cx-34,cy+5,10,6);
 addPatch('fallow','farm-soil',cx-34,cy-14,10,2,1);
 map.props.push(
  farmProp('west-tool-shack','farm-shack',cx-22,cy-13),
  farmProp('west-farm-tools','farm-tools',cx-20,cy-11),
  farmProp('west-scarecrow','farm-scarecrow',cx-29,cy-17),
  farmProp('north-scarecrow','farm-scarecrow',cx-18,cy-18),
  farmProp('blocked-mine','farm-mine',cx+28,cy-19),
  farmProp('mine-tools','farm-tools',cx+27,cy-16),
  farmProp('poplar-west','farm-poplar',cx-20,cy+15),
  farmProp('poplar-east','farm-poplar',cx+19,cy+14),
  farmProp('chicken-coop','farm-coop',cx+18,cy-18)
 );

 // Simple spans keep precise click vaults. Their matching world endpoints use
 // deterministic post ownership, so corners and T joins still draw one post.
 const fenceSpan=(id,a,b)=>{
  const x=Math.floor(Math.min(a.x,b.x)),y=Math.floor(Math.min(a.y,b.y)),width=Math.max(1,Math.ceil(Math.max(a.x,b.x))-x),height=Math.max(1,Math.ceil(Math.max(a.y,b.y))-y),horizontal=a.y===b.y;
  return{id,kind:'decoration',x,y,width,height,fence:{nodes:[{x:a.x-x,y:a.y-y},{x:b.x-x,y:b.y-y}],links:[[0,1]]},traversal:{activation:'click',kind:'vault',height:.55,endpoints:horizontal?[{x:(a.x+b.x)/2-x,y:a.y-y-.9},{x:(a.x+b.x)/2-x,y:a.y-y+.9}]:[{x:a.x-x-.9,y:(a.y+b.y)/2-y},{x:a.x-x+.9,y:(a.y+b.y)/2-y}]}};
 };
 const fencePoints={nw:{x:cx-3,y:cy+13.5},wg0:{x:cx+3,y:cy+13.5},wg1:{x:cx+5,y:cy+13.5},tn:{x:cx+12,y:cy+13.5},eg0:{x:cx+16,y:cy+13.5},eg1:{x:cx+18,y:cy+13.5},ne:{x:cx+23,y:cy+13.5},sw:{x:cx-3,y:cy+23},ts:{x:cx+12,y:cy+23},se:{x:cx+23,y:cy+23}};
 map.props.push(
  // Preserve the original fence line through the planted edge; extend it
  // around the field with a two-tile entrance. No empty border is required.
  fenceSpan('showcase-fence',{x:cx-34,y:cy+10.42},{x:cx-31,y:cy+10.42}),
  fenceSpan('corn-fence-east',{x:cx-29,y:cy+10.42},{x:cx-24,y:cy+10.42}),
  fenceSpan('corn-fence-side',{x:cx-34,y:cy+5},{x:cx-34,y:cy+10.42}),
  fenceSpan('corn-fence-back',{x:cx-34,y:cy+5},{x:cx-24,y:cy+5}),
  fenceSpan('corn-fence-right',{x:cx-24,y:cy+5},{x:cx-24,y:cy+10.42}),
  fenceSpan('pasture-north-west-a',fencePoints.nw,fencePoints.wg0),fenceSpan('pasture-north-west-b',fencePoints.wg1,fencePoints.tn),
  fenceSpan('pasture-north-east-a',fencePoints.tn,fencePoints.eg0),fenceSpan('pasture-north-east-b',fencePoints.eg1,fencePoints.ne),
  fenceSpan('pasture-west-side',fencePoints.nw,fencePoints.sw),fenceSpan('pasture-south-west',fencePoints.sw,fencePoints.ts),
  fenceSpan('pasture-divider',fencePoints.tn,fencePoints.ts),fenceSpan('pasture-south-east',fencePoints.ts,fencePoints.se),fenceSpan('pasture-east-side',fencePoints.ne,fencePoints.se)
 );
 map.props.push(
 farmProp('west-pasture-gate','farm-fence-broken',cx+3,cy+13),
  farmProp('east-pasture-gate','farm-fence-broken',cx+16,cy+13),
  {id:'town-boundary-fence',kind:'decoration',x:cx+2,y:cy-10,width:4,height:1,fence:{nodes:[{x:0,y:.5},{x:4,y:.5}],links:[[0,1]]},traversal:{activation:'click',kind:'vault',height:.55,endpoints:[{x:2,y:-.45},{x:2,y:1.45}]}},
  farmProp('town-boundary-broken','farm-fence-broken',cx+6,cy-10),
  farmProp('sheep-1','farm-sheep',cx-1,cy+17),
  farmProp('sheep-2','farm-sheep',cx+3,cy+19),
  farmProp('sheep-3','farm-sheep',cx+7,cy+16),
  farmProp('chicken-1','farm-chicken',cx+17,cy-14),
  farmProp('chicken-2','farm-chicken',cx+20,cy-13),
  farmProp('chicken-3','farm-chicken',cx+16,cy-11),
  farmProp('cow-1','farm-cow',cx+14,cy+17),
 farmProp('cow-2','farm-cow',cx+19,cy+19)
 );

 const sharedClips=structuredClone(woodlandArt.actors.hero);
 map.art={...structuredClone(woodlandArt),images:{...structuredClone(woodlandArt.images),...townImages,
  inn:{...structuredClone(woodlandArt.images.inn)},
  'editor-branches':{src:'./assets/map/editor/branches.webp',width:74,height:49.333,anchorX:.5,anchorY:.6},
  'editor-fence':{src:'./assets/map/editor/fence.webp',width:140,height:93.333,anchorX:.5,anchorY:.65},
 'editor-ridge':{src:'./assets/map/editor/ridge.webp',width:120,height:80,anchorX:.5,anchorY:.7},
  'editor-bush':{src:'./assets/map/editor/bush.webp',width:90,height:60,anchorX:.5,anchorY:.84},
  'cliff-rock':{src:'./assets/map/terrain/cliff-rock.webp',width:256,height:256,anchorX:.5,anchorY:.5},
  'cliff-nest':{src:'./assets/map/terrain/cliff-nest.webp',width:90,height:60,anchorX:.5,anchorY:.76}},
  actors:{hero:sharedClips,'npc-farmer':sharedClips,'npc-trader':sharedClips,'npc-villager':sharedClips}};
 map.actors=[
  {id:'hero',name:'Hero',x:cx+.5,y:cy+.5,speed:3.2,stride:2.4,color:'#68734b'},
  {id:'npc-farmer',name:'Mara',x:cx-12.5,y:cy+8.5,speed:2.15,stride:2.4,color:'#8b6f47'},
  {id:'npc-trader',name:'Tomas',x:cx+4.5,y:cy-.5,speed:2.7,stride:2.4,color:'#496b78'},
  {id:'npc-villager',name:'Elin',x:cx-2.5,y:cy-2.5,speed:2.4,stride:2.4,color:'#7b596e'}
 ];

 const stride=width+1;
 map.elevations=Array.from({length:stride*(height+1)},(_,index)=>{
  const x=index%stride,y=Math.floor(index/stride),distance=Math.max(Math.abs(x-cx),Math.abs(y-cy));
  const blend=Math.max(0,Math.min(1,(distance-27)/16));
  return blend*(.65*Math.sin((x+seed%31)/18)*Math.cos((y-seed%29)/20)+.25*Math.sin((x+y)/27));
 });
 addCliffValley(map,{cx,cy});
 const ridge=map.props.find(prop=>prop.id==='showcase-ridge');
 for(let x=-1;x<=ridge.width+1;x++)map.elevations[(ridge.y-1)*stride+ridge.x+x]=.2;
 for(let y=0;y<=1;y++)for(const x of [-1,ridge.width+1])map.elevations[(ridge.y+y)*stride+ridge.x+x]=y===0?.2:.1;
 for(let y=0;y<=ridge.height;y++)for(let x=0;x<=ridge.width;x++)map.elevations[(ridge.y+y)*stride+ridge.x+x]=y===0?.4:y===1?.2:0;
 addAnimalCare(map);
 addVillageCast(map);
 return assertMap(map);
}
