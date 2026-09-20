const image=(name,width,height,anchorY=.78)=>({src:`./assets/map/farm/${name}.webp`,width,height,anchorX:.5,anchorY});
export const animalCareImages={
 'farm-hay-rack':image('hay-rack',104,69.333),
 'farm-water-trough':image('water-trough',110,73.333),
 'farm-water-bucket':image('water-bucket',30,25,.85),
 'farm-chicken-feeder':image('chicken-feeder',46,38.333,.82),
};
export const animalCareBrushes=[
 {id:'farm-hay-rack',label:'Hay feeding rack',prop:{kind:'decoration',art:'farm-hay-rack',width:2,height:1,collision:{shape:'rect',x:.15,y:.18,width:1.7,height:.64}}},
 {id:'farm-water-trough',label:'Water trough',prop:{kind:'decoration',art:'farm-water-trough',width:2,height:1,collision:{shape:'rect',x:.12,y:.16,width:1.76,height:.68}}},
 {id:'farm-water-bucket',label:'Water bucket',prop:{kind:'decoration',art:'farm-water-bucket',width:1,height:1,collision:{shape:'circle',radius:.15}}},
 {id:'farm-chicken-feeder',label:'Chicken feeder',prop:{kind:'decoration',art:'farm-chicken-feeder',width:1,height:1,collision:{shape:'rect',x:.22,y:.22,width:.56,height:.56}}},
];

export function addAnimalCare(map){
 const cx=Math.floor(map.width/2),cy=Math.floor(map.height/2);
 const placements=[
  ['sheep-hay','farm-hay-rack',cx-2,cy+20],
  ['cow-hay','farm-hay-rack',cx+15,cy+20],
  ['sheep-water','farm-water-trough',cx+6,cy+20],
  ['cow-water','farm-water-trough',cx+20,cy+16],
  ['sheep-bucket','farm-water-bucket',cx+3,cy+14],
  ['cow-bucket','farm-water-bucket',cx+16,cy+14],
  ['chicken-grain','farm-chicken-feeder',cx+19,cy-10],
  ['chicken-bucket','farm-water-bucket',cx+22,cy-13],
 ];
 for(const [id,art,x,y]of placements){const brush=animalCareBrushes.find(value=>value.prop.art===art);map.props.push({...structuredClone(brush.prop),id,x,y});}
 Object.assign(map.art.images,animalCareImages);return map;
}
