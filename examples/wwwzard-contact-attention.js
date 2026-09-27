/** Independent attention graph: head motion never replaces the form action or
 * its keyboard channels. Timing and amplitudes are saved scene authoring data. */
export function addContactAttention(scene){
  const hero=scene.packs.wwzard;
  hero.inputs.focusX={type:'number',default:1,min:-1,max:1};
  hero.inputs.focusY={type:'number',default:-.5,min:-1,max:1};
  hero.inputs.attention={type:'number',default:0,min:0,max:1};
  hero.inputs.attentionBack={type:'number',default:0,min:-1,max:0};
  scene.requiredFeatures=[...new Set([...scene.requiredFeatures,'actor-behaviors'])];
  const set=(variable,value)=>({type:'set',variable,value});
  const after=(id,from,to,time)=>({id,from,to,after:{min:time,max:time},weight:1});
  const states={
    laptop:{actions:[set('look',0),set('reverse',0),set('phase',0)]},
    looking:{actions:[set('phase',1)]},
    holding:{actions:[set('look',1),set('reverse',-1),set('phase',0)]},
    returning:{actions:[set('phase',2)]},
  };
  const edges=[after('look-arrived','looking','holding',.3),after('look-finished','holding','returning',2),after('back-at-work','returning','laptop',.5)];
  for(const from of Object.keys(states)){
    edges.push({id:from+'-focus',from,to:'looking',event:'field-focus',weight:1});
    if(from!=='laptop')edges.push({id:from+'-blur',from,to:'returning',event:'field-blur',weight:1});
    for(const event of ['error','sending','sent'])edges.push({id:from+'-'+event,from,to:'laptop',event,weight:1});
  }
  scene.actorBehaviors=[...(scene.actorBehaviors||[]),{
    id:'contact-attention',actor:'wwzard',
    graph:{seed:270927,initial:'laptop',variables:{look:0,reverse:0,phase:0},variableBounds:{reverse:{min:-1,max:0},look:{min:0,max:1},phase:{min:0,max:2}},states,edges},
    rates:[{variable:'reverse',perSecond:-3.334,when:{variable:'phase',op:'eq',value:1}},{variable:'reverse',perSecond:2,when:{variable:'phase',op:'eq',value:2}},{variable:'look',perSecond:3.334,when:{variable:'phase',op:'eq',value:1}},{variable:'look',perSecond:-2,when:{variable:'phase',op:'eq',value:2}}],
    outputs:[{variable:'look',source:'input.attention'},{variable:'reverse',source:'input.attentionBack'}],
  }];
  for(const [joint,channel,amplitude,input] of [['head','rotation',16,'focusY'],['head','x',7,'focusX'],['head','y',6,'focusY'],['hat','rotation',3,'focusY']]){
    scene.motionLayers.push({id:`attention-${joint}-${channel}`,actor:'wwzard',joint,channel,type:'input',amplitude,input,weightInput:'attention',range:[-1,1],frequency:1,phase:0,seed:0,clips:['ready','typing','prepared']});
  }
}
