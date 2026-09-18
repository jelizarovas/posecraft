// Versioned adapters capture mutable state and restore it into fresh instances.
// Definitions, document references, callback closures and derived frame caches
// stay attached to those instances. Unknown non-data state rejects the cache.
const clone=value=>structuredClone(value),fields=(object,excluded=[])=>clone(Object.fromEntries(Object.entries(object).filter(([key])=>!excluded.includes(key)))),restore=(object,state,excluded=[])=>{for(const key of Object.keys(object))if(!excluded.includes(key)&&!Object.hasOwn(state,key))delete object[key];Object.assign(object,clone(state));};
const runtimeFixed=['definition','listeners','layers','frame'];
const behaviorFixed=['document','graph','bindings','apply','handlers','outgoing','activities'];
const ensembleFixed=['document','config'];
const fluidFixed=['document','config','boundary','vessel','contents','pack','root','winding','home','waves','surface'];
const pointerFixed=['document','dispatch','lastFrame'];
function runtimeState(runtime){return {...fields(runtime,runtimeFixed),layers:runtime.layers.map(l=>({state:l.state,time:l.time,weight:l.weight,transition:clone(l.transition)}))};}
function restoreRuntime(runtime,state){const {layers,...rest}=state;restore(runtime,rest,runtimeFixed);layers.forEach((l,i)=>Object.assign(runtime.layers[i],clone(l)));runtime.frame=runtime.evaluate();}
function behaviorState(behavior){if(!behavior)return null;if(!behavior.activities?.actions||!behavior.activities.packs)throw Error('Behavior provider has no supported replay adapter.');return {...fields(behavior,behaviorFixed),actions:[...behavior.activities.actions].map(([actor,a])=>[actor,{...fields(a,['recipe','variant','pack','compiled','clip']),variantIndex:(a.success||!a.recipe.failureVariants?a.recipe.variants:a.recipe.failureVariants).indexOf(a.variant)}])};}
function restoreBehavior(behavior,state,document){if(!state)return;const {actions,...rest}=state;restore(behavior,rest,behaviorFixed);behavior.activities.actions=new Map(actions.map(([actor,a])=>{const recipe=behavior.graph.activities[a.activity],variant=(a.success||!recipe.failureVariants?recipe.variants:recipe.failureVariants)[a.variantIndex],pack=document.packs[document.actors.find(v=>v.id===actor).pack],{variantIndex,...data}=a;return [actor,{...clone(data),recipe,variant,pack,compiled:behavior.activities.packs.get(pack),clip:pack.clips[variant.clip]}];}));}
export function captureIllustrationState(controller){
 const state={version:1,time:controller.time,accumulator:controller.accumulator,motion:clone(controller.motion),baseline:clone(controller.baseline),actors:controller.actors.map(a=>({id:a.actor.id,data:fields(a,['actor','pack','runtime']),runtime:runtimeState(a.runtime)})),behavior:behaviorState(controller.behaviors||controller.graph),ensemble:controller.ensemble?fields(controller.ensemble,ensembleFixed):null,pointers:controller.pointers?fields(controller.pointers,pointerFixed):null,fluid:null,objects:null,propGames:null,actorBehaviors:controller.actorBehaviors?.capture()||null};
 if(controller.fluid){if(!controller.fluid.makeSurface||!controller.fluid.waves)throw Error('Fluid provider has no supported replay adapter.');state.fluid={...fields(controller.fluid,fluidFixed),waves:fields(controller.fluid.waves)};}
 if(controller.objects){if(!controller.objects.snapshot||!controller.objects.restore)throw Error('Object provider has no replay adapter.');state.objects=clone(controller.objects.snapshot());}
 if(controller.propGames)state.propGames=clone(controller.propGames.snapshot());
 return state;
}
export function restoreIllustrationState(controller,state){
 if(state.version!==1||state.actors.length!==controller.actors.length)throw Error('Checkpoint version or actor layout differs.');controller.time=state.time;controller.accumulator=state.accumulator;controller.motion=clone(state.motion);controller.baseline=clone(state.baseline);
 state.actors.forEach((a,i)=>{if(controller.actors[i].actor.id!==a.id)throw Error('Checkpoint actor differs.');restore(controller.actors[i],a.data,['actor','pack','runtime']);restoreRuntime(controller.actors[i].runtime,a.runtime);});restoreBehavior(controller.behaviors||controller.graph,state.behavior,controller.document);
 if(state.actorBehaviors)controller.actorBehaviors.restore(state.actorBehaviors);
 if(state.ensemble)restore(controller.ensemble,state.ensemble,ensembleFixed);if(state.pointers){restore(controller.pointers,state.pointers,pointerFixed);controller.pointers.lastFrame=null;}
 if(state.fluid){const {waves,...fluid}=state.fluid;restore(controller.fluid,fluid,fluidFixed);restore(controller.fluid.waves,waves);controller.fluid.surface=controller.fluid.makeSurface();}if(state.objects)controller.objects.restore(clone(state.objects));if(state.propGames)controller.propGames.restore(clone(state.propGames));
}
