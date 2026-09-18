// Authored clips and graph decisions stay in the portable scene document.
export const gymPreparationReviews=[{id:'tired-breaths',label:'Tired / three breath-outs',clip:'tired-breaths',duration:4.8}];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function addGymPreparation(scene,{poseAt,makeClip}){
 const pack=scene.packs.atlas,graph=scene.behaviorGraph;
 for(const id of ['breath-mouth','breath-air'])pack.joints.push({id,parent:'head',x:0,y:0,length:0,rotation:0,min:-180,max:180});
 pack.parts.push(
  {id:'breath-mouth',joint:'breath-mouth',d:'M-4 12Q0 8 4 12Q6 17 0 18Q-6 17-4 12Z',fill:'#382b30',stroke:'#a65f46',strokeWidth:1,opacityChannel:'breath-mouth.opacity',spatial:{order:60}},
  {id:'breath-air',joint:'breath-air',d:'M-6 24Q0 27 6 24M-9 30Q0 34 9 30M-12 37Q0 42 12 37',fill:'none',stroke:'#e5f3ef',strokeWidth:2,opacityChannel:'breath-air.opacity',spatial:{order:61}}
 );
 for(const clip of Object.values(pack.clips))for(const id of ['breath-mouth','breath-air'])clip.tracks[id+'.opacity']=[[0,0],[clip.duration,0]];
 pack.clips['tired-breaths']=makeClip(4.8,t=>{
  const pose={...poseAt(0,'full-set')};let inhale=0,exhale=0,air=0,travel=0;
  for(const start of [.35,1.7,3.05]){const age=t-start;
   if(age>=0&&age<1.15){inhale=Math.sin(Math.PI*Math.min(1,age/.45));exhale=age<.45?0:Math.sin(Math.PI*Math.min(1,(age-.45)/.7));air=exhale*.7;travel=Math.max(0,(age-.45)/.7);}
  }
  const tired=smooth(t/.3)*(1-smooth((t-4.35)/.45));
  pose['torso.y']=(pose['torso.y']||0)-2.4*inhale+2*exhale;
  pose['torso.pitch']=(pose['torso.pitch']||0)+3*inhale-4*exhale;
  pose['head.pitch']=(pose['head.pitch']||0)+6*tired+4*exhale;
  pose['head.rotation']=(pose['head.rotation']||0)+2*exhale;
  for(const side of ['left','right'])pose[side+'Upper.y']=(pose[side+'Upper.y']||0)-2.4*inhale+2*exhale;
  pose['face-neutral.opacity']=1;pose['face-effort.opacity']=0;pose['face-blink.opacity']=0;
  pose['breath-mouth.opacity']=exhale;pose['breath-air.opacity']=air;
  pose['breath-air.y']=8*travel;
  pose['sweat.opacity']=.3*tired;pose['water-bottle.opacity']=0;
  return pose;
 });
 graph.activities['catch-breath-before']={actor:'atlas',variants:[{id:'three-breaths',clip:'tired-breaths',start:0,end:4.8,weight:1,speed:{min:.94,max:1.04}}],success:{base:1,modifiers:[]},onStart:[],onSuccess:[{type:'event',event:'breathing-ready'}],onFailure:[{type:'event',event:'breathing-ready'}]};
 graph.states['preparation-check']={actions:[]};graph.states['catch-breath-before']={actions:[{type:'perform',activity:'catch-breath-before'}]};
 graph.initial='preparation-check';
 graph.edges.find(edge=>edge.id==='back-home').to='preparation-check';
 graph.edges.push(
  {id:'prepare-fresh',from:'preparation-check',to:'prepare',after:{min:0,max:0},weight:1,when:{variable:'fatigue',op:'lt',value:40}},
  {id:'prepare-tired-direct',from:'preparation-check',to:'prepare',after:{min:0,max:0},weight:1,when:{variable:'fatigue',op:'gte',value:40}},
  {id:'prepare-tired-breaths',from:'preparation-check',to:'catch-breath-before',after:{min:0,max:0},weight:2,when:{variable:'fatigue',op:'gte',value:40}},
  {id:'breathing-finished',from:'catch-breath-before',to:'prepare',event:'breathing-ready',weight:1}
 );
 return scene;
}
