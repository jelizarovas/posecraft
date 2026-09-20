const inside=(prop,area)=>prop.x<area.x+area.width&&prop.x+prop.width>area.x&&prop.y<area.y+area.height&&prop.y+prop.height>area.y;

/** Add the northeast stepped cliffs, their creek, and the mine at the lower face. */
export function addCliffValley(map,{cx=Math.floor(map.width/2),cy=Math.floor(map.height/2)}={}){
 const terraces=[
  {id:'eagle-crag',x:cx+25,y:cy-25,width:14,height:8,heightOffset:15},
  {id:'middle-falls',x:cx+24,y:cy-17,width:16,height:6,heightOffset:8},
  {id:'mine-ledge',x:cx+23,y:cy-11,width:18,height:6,heightOffset:3}
 ];
 map.terraces=terraces;

 // Clear generated woodland from the cliff steps. Authored landmarks are moved below.
 const retained=new Set(['showcase-ridge','blocked-mine','mine-tools']);
 map.props=map.props.filter(prop=>!terraces.some(area=>inside(prop,area))||retained.has(prop.id));
 const paint=(x,y,value)=>{if(x>=0&&y>=0&&x<map.width&&y<map.height)map.terrain[y*map.width+x]=value;};
 // Replace the old meadow creek inside the cliff view with one unbroken channel.
 // Keeping it away from each shelf's side walls limits falls to the south faces.
 for(let y=cy-30;y<=cy-4;y++)for(let x=cx+22;x<=cx+42;x++)if(map.terrain[y*map.width+x]===2)paint(x,y,0);
 for(let y=cy-30;y<=cy-4;y++)for(let x=cx+26;x<=cx+28;x++)paint(x,y,2);

 const mine=map.props.find(prop=>prop.id==='blocked-mine');
 if(mine)Object.assign(mine,{x:cx+31,y:cy-5});
 const tools=map.props.find(prop=>prop.id==='mine-tools');
 if(tools)Object.assign(tools,{x:cx+36,y:cy-4});
 const climb=map.props.find(prop=>prop.id==='showcase-ridge');
 if(climb)Object.assign(climb,{x:cx+37,y:cy-6,traversal:{activation:'click',kind:'climb',height:3,endpoints:[{x:1.5,y:2.85},{x:1.5,y:.15}]}});
 const coop=map.props.find(prop=>prop.id==='chicken-coop');
 if(coop)Object.assign(coop,{x:cx+14,y:cy-18});
 map.props.push({id:'eagle-nest',kind:'decoration',art:'cliff-nest',x:cx+34,y:cy-23,width:3,height:2,collision:{shape:'none'}});
 map.birds=[
  {id:'cliff-eagle',species:'eagle',home:{x:cx+35.5,y:cy-22,z:15.8},radius:8,seed:map.seed+701},
  {id:'cliff-crows-high',species:'crow',home:{x:cx+29,y:cy-19,z:15.5},radius:5,seed:map.seed+702,roost:'rock'},
  {id:'cliff-crows-low',species:'crow',home:{x:cx+32,y:cy-9,z:3.7},radius:4,seed:map.seed+703,roost:'branch'}
 ];
 return map;
}
