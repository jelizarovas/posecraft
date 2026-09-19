import {SceneController} from './scene.js';
import {PathJob} from './navigation.js';
let controller,events=[],jobs=new Map(),jobTimer=null;
const reply=value=>self.postMessage(value);
function paths(){
 jobTimer=null;const deadline=performance.now()+2;
 for(const [id,job] of [...jobs]){job.step(16);jobs.delete(id);if(job.done)reply({type:'path',id,result:job.result});else jobs.set(id,job);if(performance.now()>=deadline)break;}
 if(jobs.size)jobTimer=setTimeout(paths,0);
}
self.onmessage=({data:m})=>{
 try{
  if(m.type==='init'){
   controller=new SceneController(m.document,{reducedMotion:m.reducedMotion});controller.subscribe(e=>events.push(e));reply({type:'ready',frame:controller.frame()});return;
  }
  if(m.type==='path'){
   if(jobs.size>=24)throw new Error('At most 24 path requests may be pending.');
   jobs.set(m.id,new PathJob(controller.document,m.request));if(jobTimer===null)jobTimer=setTimeout(paths,0);return;
  }
  if(m.type==='cancelPath'){jobs.delete(m.id);return;}
  if(m.type!=='advance')return;
  const start=performance.now(),receipts=[];events=[];
  controller.reducedMotion=m.reducedMotion;controller.animationPlaying=m.animationPlaying;
  for(const [method,...args] of m.commands){
   if(['snapshot','restore','objectCommandAck','setActorSleeping'].includes(method)){
    const id=args.pop();try{receipts.push({id,result:controller[method](...args)});}catch(error){receipts.push({id,error:error.message});}continue;
   }
   try{
    if(!['gameCommand','setActorVariable','dispatchActor','objectCommand','fluidInput','pointer','dispatch','setVariable','triggerEnsemble','walkTo','setInput','setBehavior','interact','previewClip','clearPreview','setAcceleration','rebaseline','play','pause','reset','seek'].includes(method))throw new Error('Unknown simulation command.');
    controller[method](...args);
   }catch(error){events.push({type:'error',actor:args[0],message:error.message,time:controller.time});}
  }
  if(m.host)controller.sampleHost(m.host);
  if(m.reducedMotion&&m.commands.some(c=>c[0]==='setInput'))controller.tick();
  const frame=controller.step(Math.min(m.dt,1/30));
  reply({type:'frame',sequence:m.sequence,frame,events,receipts,motion:controller.motion,layers:controller.actors.map(a=>({id:a.actor.id,state:a.runtime.layers[0].state,time:a.runtime.layers[0].time})),computeMs:performance.now()-start});
 }catch(error){reply({type:'error',id:m.id,message:error.message});}
};
