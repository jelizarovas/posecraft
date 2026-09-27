// Shared authored foliage response for every scene using this room.
const round=n=>+n.toFixed(4)||0;
const warp=(d,move)=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,pair=>move(...pair.split(/\s+/).map(Number)).map(round).join(' '));
export function addWwwzardPlantGusts(scene){
  const room=scene.packs.room,g=scene.behaviorGraph;
  if(room.clips['gust-left'])return scene;
  room.spatial=true;
  room.joints.push({id:'plantCenter',parent:'root',x:102,y:280,rotation:0,min:-180,max:180,length:0});
  for(const id of ['windLeft','windRight'])room.joints.push({id,parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
  for(const part of room.parts.filter(part=>part.id.startsWith('plant-'))){
    const shape=direction=>warp(part.d,(x,y)=>{const w=Math.max(0,Math.min(1,(327-y)/105));return [x+direction*22*w*w,y+5*w*w];});
    part.spatial={...part.spatial,morph:{channel:'windLeft.bend',target:shape(-1),layers:[{channel:'windRight.bend',target:shape(1)}]}};
  }
  for(const [id,side] of [['gust-left','Left'],['gust-right','Right']]){
    room.clips[id]={duration:1.75,loop:false,tracks:{[`wind${side}.bend`]:[[0,0],[.3,1],[.65,.32],[.92,.55],[1.3,.1],[1.75,0]],[`wind${side==='Left'?'Right':'Left'}.bend`]:[[0,0]]}};
    room.states[id]={clip:id,transitions:[]};
  }
  for(const [direction,side] of [['left','Left'],['right','Right']]){
    scene.interactions.push({id:'room-plant-'+direction,actor:'room',joint:'plantCenter',gesture:'hover-fast',response:'event',event:'gust-'+direction,resistance:0,threshold:180,radius:95,direction});
    g.activities['gust'+side]={actor:'room',variants:[{id:'gust-'+direction,clip:'gust-'+direction,weight:1,speed:{min:1,max:1}}],transition:{duration:.22,interrupt:true},success:{base:1,modifiers:[]},onStart:[],onSuccess:[],onFailure:[]};
    g.handlers.push({event:'gust-'+direction,actions:[{type:'perform',activity:'gust'+side}]});
  }
  return scene;
}
