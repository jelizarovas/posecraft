// Art-directed material settings, exported as ordinary scene data. The runtime
// knows light sources and pose channels, not characters or laptop activities.
export function addWwwzardNightLighting(scene){
  if(scene.materialLighting)return scene;
  let source=scene.actors.find(actor=>scene.packs[actor.pack].inputs?.night?.type==='number');
  if(!source){
    scene.packs.environment={name:'Day and night',spatial:true,
      joints:[{id:'night',parent:null,x:0,y:0,rotation:0,min:-180,max:180,length:0}],parts:[],
      inputs:{night:{type:'number',default:0,min:0,max:1}},
      clips:{still:{duration:1,loop:true,tracks:{'night.bend':[[0,0]]}}},
      states:{still:{clip:'still',transitions:[]}},initial:'still'};
    source={id:'environment',name:'Environment',pack:'environment',layer:'background',unlit:true,transform:{x:0,y:0,rotation:0,scale:1}};
    scene.actors.unshift(source);
    scene.motionLayers??=[];
    scene.motionLayers.push({id:'environment-night',actor:source.id,joint:'night',channel:'bend',type:'input',amplitude:1,frequency:1,phase:0,seed:0,input:'night',range:[-1,1]});
    if(!scene.requiredFeatures.includes('motion-layers'))scene.requiredFeatures.push('motion-layers');
  }
  const lights=[{type:'directional',angle:-45,color:'#7197ff',intensity:.5,...(scene.packs.wwzard.parts.some(p=>p.id==='hat-brim-light-edge')?{highlights:{actor:'wwzard',parts:['hat-brim-light-edge']}}:{})}];
  if(scene.packs.screen){
    const hero=scene.packs.wwzard;
    hero.joints.push({id:'display',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
    for(const [name,clip] of Object.entries(hero.clips)){
      let level=/^(work|typing)/.test(name)?.9:/trackpad/.test(name)?.7:/doomscroll/.test(name)?.82:.48;
      if(/nap|closed-/.test(name))level=0;
      clip.tracks['display.bend']=[[0,level]];
      if(name==='doomscroll')clip.tracks['display.bend']=[[0,.55],[.7,.9],[1.2,.6],[2.1,1],[2.7,.7],[clip.duration,.55]];
      if(name==='trackpad')clip.tracks['display.bend']=[[0,.55],[clip.duration*.45,.8],[clip.duration,.55]];
    }
    if(hero.clips.prepared&&scene.behaviorGraph){
      const graph=scene.behaviorGraph;
      graph.variables.screenInput=0;graph.variableBounds??={};graph.variableBounds.screenInput={min:0,max:1};
      for(const [event,value] of [['typing',1],['ready',0],['sending',0],['compose',0]]){
        let handler=graph.handlers.find(handler=>handler.event===event);
        if(!handler){handler={event,actions:[]};graph.handlers.push(handler);}
        handler.actions.push({type:'set',variable:'screenInput',value});
      }
      scene.motionLayers.push({id:'prepared-screen-input',actor:'wwzard',joint:'display',channel:'bend',type:'input',amplitude:.35,frequency:1,phase:0,seed:0,variable:'screenInput',range:[-1,1],clips:['prepared']});
    }
    lights.push({type:'point',actor:'screen',x:302,y:277,range:95,color:'#3baeff',intensity:1.3,actors:['wwzard','keyboard','desk'],
      gains:[{actor:'wwzard',channel:'display.bend'},{actor:'screen',channel:'hinge.bend',invert:true}],flicker:.05,emission:{actor:'keyboard',parts:scene.packs.keyboard.parts.filter(p=>p.id.startsWith('key-')).map(p=>p.id)}});
  }
  scene.materialLighting={weight:{actor:source.id,channel:'night.bend'},ambient:.18,tint:'#27224f',
    actors:scene.actors.filter(actor=>actor!==source&&actor.id!=='sky').map(actor=>actor.id),lights};
  if(!scene.requiredFeatures.includes('material-lighting'))scene.requiredFeatures.push('material-lighting');
  return scene;
}
