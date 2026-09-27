/** All decisions are ordinary editable scene data, shared by Studio and exports. */
export function addWwzardBehaviors(scene) {
  const set = (variable, value) => ({type:'set', variable, value});
  const add = (variable, value) => ({type:'add', variable, value});
  const event = name => ({type:'event', event:name});
  const perform = activity => ({type:'perform', activity});
  const condition = (variable, op, value) => ({variable, op, value});
  const edge = (id, from, to, name, when) => ({id, from, to, event:name, weight:1, ...(when ? {when} : {})});
  const delayed = (id, from, to, min, max, weight=1) => ({id, from, to, after:{min,max}, weight});
  const activity = (clip, done, effects=[], actor='wwzard') => ({
    actor, variants:[
      {id:clip, clip, weight:1, speed:{min:1,max:1}, when:condition('mood','eq',1)},
      ...[['disappointed',0],['angry',2]].map(([mood,value])=>({
        id:`${clip}--${mood}`, clip:`${clip}--${mood}`, weight:1,
        speed:{min:1,max:1}, when:condition('mood','eq',value),
      })),
    ],
    success:{base:1,modifiers:[]}, onStart:[], onSuccess:[...effects,...(done?[event(done)]:[])], onFailure:[],
  });
  scene.presentation = 'live';
  scene.behaviorGraph = {
    seed:240926,
    variables:{pending:false, laptopRequestedClosed:false, laptopClosed:false, attention:0, familiar:false, responses:0, mood:1},
    variableBounds:{attention:{min:0,max:4},responses:{min:0,max:1000},mood:{min:0,max:2}},
    initial:'working',
    states:{
      working:{actions:[perform('work')]},
      choosing:{actions:[event('choose-laptop')]},
      decidingVisitor:{actions:[event('choose-visitor')]},
      noticing:{actions:[set('pending',false),perform('notice')]},
      responding:{actions:[event('respond')]},
      firstMeeting:{actions:[event('remember')]},
      greeting:{actions:[perform('greet')]},
      curious:{actions:[perform('curious')]},
      overwhelmed:{actions:[perform('frustrated')]},
      resting:{actions:[perform('rest')]},
      afterRest:{actions:[event('choose-rest-laptop')]},
      afterRestVisitor:{actions:[event('choose-rest-visitor')]},
      settled:{actions:[set('attention',0)]},
      closingLaptop:{actions:[perform('close'),perform('closeScreen')]},
      openingLaptop:{actions:[perform('open'),perform('openScreen')]},
      afterOpen:{actions:[event('choose-open')]},
      afterOpenVisitor:{actions:[event('choose-open-visitor')]},
      closedIdle:{actions:[perform('closedIdle'),perform('closedIdleScreen')]},
      // Retain the completed idle pose through this scheduled stillness.
      closedPause:{actions:[]},
      closedDecision:{actions:[event('choose-closed')]},
    },
    handlers:[
      {event:'visitor',actions:[set('pending',true),add('attention',1)]},
      {event:'laptop',actions:[set('laptopRequestedClosed',true)]},
      {event:'close-laptop',actions:[set('laptopRequestedClosed',true)]},
      {event:'open-laptop',actions:[set('laptopRequestedClosed',false)]},
      {event:'quiet',actions:[set('pending',false),set('attention',0)]},
      {event:'mood-disappointed',actions:[set('mood',0)]},
      {event:'mood-normal',actions:[set('mood',1)]},
      {event:'mood-angry',actions:[set('mood',2)]},
    ],
    edges:[
      edge('work-finished','working','choosing','work-done'),
      edge('work-laptop','choosing','closingLaptop','choose-laptop',condition('laptopRequestedClosed','eq',true)),
      edge('work-visitor-choice','choosing','decidingVisitor','choose-laptop',condition('laptopRequestedClosed','eq',false)),
      edge('visitor-waiting','decidingVisitor','noticing','choose-visitor',condition('pending','eq',true)),
      edge('take-a-breath','decidingVisitor','resting','choose-visitor',condition('pending','eq',false)),
      edge('noticed','noticing','responding','notice-done'),
      edge('too-much','responding','overwhelmed','respond',condition('attention','gte',3)),
      edge('enough-space','responding','firstMeeting','respond',condition('attention','lt',3)),
      edge('new-visitor','firstMeeting','greeting','remember',condition('familiar','eq',false)),
      edge('known-visitor','firstMeeting','curious','remember',condition('familiar','eq',true)),
      // Choose pending work at the gesture boundary before considering rest.
      // A requested close must not insert an unrelated tuck/untuck cycle.
      edge('greeted','greeting','choosing','response-done'),
      edge('wondered','curious','choosing','response-done'),
      edge('expressed','overwhelmed','choosing','response-done'),
      edge('rest-complete','resting','afterRest','rest-done'),
      edge('rest-laptop','afterRest','closingLaptop','choose-rest-laptop',condition('laptopRequestedClosed','eq',true)),
      edge('rest-visitor-choice','afterRest','afterRestVisitor','choose-rest-laptop',condition('laptopRequestedClosed','eq',false)),
      edge('rest-visitor','afterRestVisitor','noticing','choose-rest-visitor',condition('pending','eq',true)),
      edge('rest-settled','afterRestVisitor','settled','choose-rest-visitor',condition('pending','eq',false)),
      edge('settled-visitor','settled','noticing','visitor'),
      edge('close-open-requested','closingLaptop','openingLaptop','close-done',condition('laptopRequestedClosed','eq',false)),
      edge('close-stay-closed','closingLaptop','closedIdle','close-done',condition('laptopRequestedClosed','eq',true)),
      edge('idle-open-requested','closedIdle','openingLaptop','closed-idle-done',condition('laptopRequestedClosed','eq',false)),
      edge('idle-pause','closedIdle','closedPause','closed-idle-done',condition('laptopRequestedClosed','eq',true)),
      delayed('pause-finished','closedPause','closedDecision',3.5,6.2),
      edge('decision-open','closedDecision','openingLaptop','choose-closed',condition('laptopRequestedClosed','eq',false)),
      edge('decision-idle','closedDecision','closedIdle','choose-closed',condition('laptopRequestedClosed','eq',true)),
      edge('open-finished','openingLaptop','afterOpen','open-done'),
      edge('open-close-requested','afterOpen','closingLaptop','choose-open',condition('laptopRequestedClosed','eq',true)),
      edge('open-choose-visitor','afterOpen','afterOpenVisitor','choose-open',condition('laptopRequestedClosed','eq',false)),
      edge('open-visitor','afterOpenVisitor','noticing','choose-open-visitor',condition('pending','eq',true)),
      edge('open-work','afterOpenVisitor','working','choose-open-visitor',condition('pending','eq',false)),
      delayed('return-to-work','settled','working',2.5,5.5),
    ],
    activities:{
      work:activity('work','work-done'),
      notice:activity('notice','notice-done'),
      greet:activity('greet','response-done',[set('familiar',true),add('responses',1),add('attention',-1)]),
      curious:activity('curious','response-done',[add('responses',1),add('attention',-1)]),
      frustrated:activity('frustrated','response-done',[set('familiar',true),add('responses',1),set('attention',0)]),
      rest:activity('rest','rest-done'),
      close:activity('close','close-done',[set('laptopClosed',true)]),
      closeScreen:activity('close',null,[],'screen'),
      open:activity('open','open-done',[set('laptopClosed',false)]),
      openScreen:activity('open',null,[],'screen'),
      closedIdle:activity('closed-idle','closed-idle-done'),
      closedIdleScreen:activity('closed-idle',null,[],'screen'),
      closedPause:activity('closed-pause','closed-pause-done'),
      closedPauseScreen:activity('closed-pause',null,[],'screen'),
    },
  };
  // Direct requests interrupt from the displayed pose, including a partially
  // folded lid. Matching the screen's hinge keeps the hand and lid in phase.
  for(const id of ['close','closeScreen','open','openScreen']){
    scene.behaviorGraph.activities[id].transition={duration:.25,interrupt:true,match:{actor:'screen',channel:'hinge.bend'}};
  }
  for(const from of ['working','noticing','greeting','curious','overwhelmed','resting','settled','openingLaptop']){
    for(const request of ['laptop','close-laptop'])scene.behaviorGraph.edges.push(edge(`${from}-${request}`,from,'closingLaptop',request));
  }
  for(const from of ['closedIdle','closedPause','closedDecision','closingLaptop']){
    scene.behaviorGraph.edges.push(edge(`${from}-open`,from,'openingLaptop','open-laptop'));
  }
  scene.interactions = [{id:'wwzard-visitor',actor:'wwzard',gesture:'click',response:'event',event:'visitor',resistance:0}];
  return scene;
}
