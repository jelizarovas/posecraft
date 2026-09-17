import ona from './characters/ona.json' with {type:'json'};
import dummy from './characters/dummy.json' with {type:'json'};
const prop=(id,x,y,width,height,fill)=>({id,name:id,x,y,width,height,rotation:0,fill,collider:{enabled:false,width,height,x:0,y:0,friction:.5,bounce:0}});
const outside=structuredClone(ona);outside.name='Courtyard';outside.packs.dummy=dummy.packs.dummy;outside.actors.push({...structuredClone(dummy.actors[0]),transform:{x:440,y:254,scale:.85,rotation:0}});outside.actors[0].transform.x=230;
outside.props=[prop('sky',320,180,640,400,'#cbdfe4'),prop('ground',320,365,640,70,'#d3d6b5'),prop('building',85,200,140,270,'#d9bc9d'),prop('window',85,150,65,75,'#789aab')];
const inside=structuredClone(outside);inside.name='Workshop';inside.props=[prop('wall',320,180,640,400,'#ded3c4'),prop('floor',320,365,640,70,'#b5a592'),prop('shelf',500,110,200,18,'#8e7868'),prop('box',450,86,36,30,'#b1beae')];
const camera=(x=320,y=200,zoom=1)=>({x:[[0,x]],y:[[0,y]],zoom:[[0,zoom]],rotation:[[0,0]]});
export const episodeExample={schemaVersion:1,kind:'episode',id:'first-sequence',name:'A small rehearsal',revision:0,fps:24,size:{width:1280,height:720},scenes:{courtyard:outside,workshop:inside},shots:[
 {id:'wide',name:'01 · Establish the courtyard',scene:'courtyard',duration:3,camera:camera(),actors:{ona:{clip:'idle',offset:0,speed:1,emotion:'curious'},dummy:{clip:'idle',offset:0,speed:1}}},
 {id:'hello',name:'02 · Ona says hello',scene:'courtyard',duration:3,camera:{...camera(245,255,1.65),zoom:[[0,1.3],[3,1.7,'smooth']]},actors:{ona:{clip:'wave',offset:0,speed:1,emotion:'happy',motion:{kind:'sway',joint:'head',channel:'rotation',amplitude:2,frequency:.5,seed:7}},dummy:{clip:'wave',offset:0,speed:1}}},
 {id:'inside',name:'03 · Cut to the workshop',scene:'workshop',duration:4,camera:camera(),actors:{ona:{clip:'idle',offset:0,speed:1,emotion:'focused'},dummy:{clip:'nod',offset:0,speed:1,motion:{kind:'noise',joint:'root',channel:'rotation',amplitude:3,frequency:1,seed:42}}}}
]};
