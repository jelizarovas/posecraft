import {addWwwzardPlantGusts} from './wwwzard-plant.js';
import {addWwwzardLivingMotion} from './wwwzard-living-motion.js';

const set=(variable,value)=>({type:'set',variable,value});
const add=(variable,value)=>({type:'add',variable,value});
const emit=event=>({type:'event',event});
const perform=activity=>({type:'perform',activity});
const when=(variable,op,value)=>({variable,op,value});
const edge=(id,from,to,event,condition)=>({id,from,to,event,weight:1,...(condition?{when:condition}:{})});
const recipe=(clip,event,actor='wwzard',effects=[])=>({actor,variants:[{id:clip,clip,weight:1,speed:{min:1,max:1}}],transition:{duration:.22,interrupt:true},success:{base:1,modifiers:[]},onStart:[],onSuccess:[...effects,...(event?[emit(event)]:[])],onFailure:[]});

/** Add bounded living behavior to the editable Home scene, once. */
export function addWwwzardLiving(scene){
  if(scene.behaviorGraph?.variables?.livingVersion===1)return scene;
  addWwwzardLivingMotion(scene);
  const g=scene.behaviorGraph;
  scene.interactions.push({id:'home-laptop-click',actor:'screen',gesture:'click',response:'event',event:'laptop-click',resistance:0,cooldown:0});
  addWwwzardPlantGusts(scene);
  Object.assign(g.variables,{livingVersion:1,anger:0,autoLaptop:false,breathPhase:0});
  Object.assign(g.variableBounds,{anger:{min:0,max:100},breathPhase:{min:0,max:3}});
  Object.assign(g.states,{
    trackpad:{actions:[perform('trackpad')]},
    browsing:{actions:[perform('doomscroll')]},
    sighing:{actions:[perform('sigh')]},
    clickChoice:{actions:[set('autoLaptop',true),set('laptopRequestedClosed',true),add('anger',28),emit('click-mood')]},
    clickCalm:{actions:[set('mood',1),emit('click-close')]},
    clickAngry:{actions:[set('mood',2),emit('click-close')]},
    closedReaction:{actions:[emit('choose-reaction')]},
    puzzled:{actions:[perform('laptopPuzzled')]},
    annoyed:{actions:[perform('laptopAnnoyed')]},
    breathing:{actions:[perform('breathe')]},
    visitorClosing:{actions:[perform('visitorClose'),perform('visitorCloseScreen')]},
    breathingPrepare:{actions:[perform('breathSettle')]},
  });
  Object.assign(g.activities,{
    trackpad:recipe('trackpad','ambient-done'),doomscroll:recipe('doomscroll','ambient-done'),sigh:recipe('sigh','ambient-done'),
    laptopPuzzled:recipe('laptop-puzzled','reaction-done','wwzard',[set('laptopRequestedClosed',false),set('autoLaptop',false)]),
    laptopAnnoyed:recipe('laptop-annoyed','angry-reaction-done','wwzard',[set('breathPhase',0)]),
    breathe:recipe('breathe','breath-beat','wwzard',[add('breathPhase',1)]),
    visitorClose:recipe('visitor-close','visitor-close-done','wwzard',[set('laptopClosed',true)]),
    visitorCloseScreen:recipe('visitor-close',null,'screen'),
    breathSettle:recipe('breath-settle','breath-ready'),
  });
  for(const id of ['visitorClose','visitorCloseScreen'])g.activities[id].transition={duration:.1,interrupt:true,match:{actor:'screen',channel:'hinge.bend'}};
  g.activities.breathSettle.transition.duration=.5;
  g.activities.open.transition.duration=.4;
  // Contiguous windows keep one authored performance while exposing exhale
  // effects as ordinary completed activities. Clip markers are not behavior
  // events, so there are no invisible host timers or renderer-side counters.
  const breathWindows=[[0,3.25],[3.25,6.95],[6.95,7.4]];
  g.activities.breathe.transition.duration=0;
  g.activities.breathe.variants=breathWindows.map(([start,end],phase)=>({id:'breath-'+phase,clip:'breathe',start,end,weight:1,speed:{min:1,max:1},when:{variable:'breathPhase',op:'eq',value:phase},onSuccess:phase===2?[set('anger',0),set('mood',1),set('autoLaptop',false),set('laptopRequestedClosed',false)]:[add('anger',-42)]}));
  // Only laptop-click starts the playful automatic close/reaction/open cycle.
  // Explicit close/open controls retain their existing persistent semantics.
  for(const handler of g.handlers)if(['close-laptop','open-laptop','laptop'].includes(handler.event))handler.actions.unshift(set('autoLaptop',false));
  // Opening clears the requested direction before another click can reverse it.
  // This also interrupts a closed-lid reaction without making him angrier.
  g.states.openingLaptop.actions.unshift(set('autoLaptop',false),set('laptopRequestedClosed',false));
  g.edges=g.edges.filter(e=>!['close-stay-closed','close-open-requested','return-to-work'].includes(e.id));
  g.edges.push(
    edge('living-click-open','*','openingLaptop','laptop-click',when('laptopRequestedClosed','eq',true)),
    edge('living-click','*','clickChoice','laptop-click',when('laptopRequestedClosed','eq',false)),
    edge('living-calm-close','clickChoice','clickCalm','click-mood',when('anger','lt',65)),
    edge('living-angry-close','clickChoice','clickAngry','click-mood',when('anger','gte',65)),
    edge('living-close-calm','clickCalm','visitorClosing','click-close'),
    edge('living-close-angry','clickAngry','visitorClosing','click-close'),
    edge('living-visitor-closed','visitorClosing','closedReaction','visitor-close-done'),
    edge('living-close-auto','closingLaptop','closedReaction','close-done',when('autoLaptop','eq',true)),
    edge('living-close-manual','closingLaptop','closedIdle','close-done',when('autoLaptop','eq',false)),
    edge('living-puzzled','closedReaction','puzzled','choose-reaction',when('anger','lt',65)),
    edge('living-annoyed','closedReaction','annoyed','choose-reaction',when('anger','gte',65)),
    edge('living-open-after-puzzled','puzzled','openingLaptop','reaction-done'),
    edge('living-breathe-prepare','annoyed','breathingPrepare','angry-reaction-done'),
    edge('living-breathe','breathingPrepare','breathing','breath-ready'),
    edge('living-next-breath','breathing','breathing','breath-beat',when('breathPhase','lt',3)),
    edge('living-open-after-breath','breathing','openingLaptop','breath-beat',when('breathPhase','gte',3)),
  );
  for(const from of ['trackpad','browsing','sighing']){
    g.edges.push(edge('living-'+from+'-done',from,'settled','ambient-done'));
    g.edges.push(edge('living-'+from+'-visitor',from,'noticing','visitor'));
  }
  for(const [to,weight] of [['working',4],['trackpad',2],['browsing',3],['sighing',1]])g.edges.push({id:'living-pause-'+to,from:'settled',to,after:{min:2.8,max:5.8},weight});
  for(const from of ['trackpad','browsing','sighing','puzzled','annoyed','breathing','visitorClosing','breathingPrepare']){
    for(const event of ['close-laptop','laptop'])g.edges.push(edge('living-'+from+'-'+event,from,'closingLaptop',event));
    if(['puzzled','annoyed','breathing','visitorClosing','breathingPrepare'].includes(from))g.edges.push(edge('living-'+from+'-open',from,'openingLaptop','open-laptop'));
  }
  // Ambient interruptions must actually replace the active performance.
  for(const id of ['notice','work'])g.activities[id].transition={duration:.22,interrupt:true};
  return scene;
}
