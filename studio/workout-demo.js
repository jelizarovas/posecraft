import {createWorkoutGame} from '../src/workout-game.js';

/** Gallery host only. All motion and workout decisions live in the exported director. */
export function mountWorkoutDemo({playing=true,onPlayingChange=()=>{},onError=()=>{}}={}){
 const $=id=>document.getElementById(id),art=$('demo-art');
 let view,game,project,disposed=false,last=null,time=0,raf,inView=true,busy=false;
 art.replaceChildren();art.classList.add('native-workout');$('demo-stage').classList.add('native-workout-stage');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','One More Rep, native character and equipment');art.append(canvas);
 $('edit-demo').href='./native-studio.html?demo=gym-routine';
 $('demo-category').textContent='Reusable actions · Native 3D';
 $('demo-description').textContent='Atlas alternates pull-ups and bench presses, struggles through hard reps and takes a breather. Watch for one-arm hangs, uneven lifts and changing expressions.';
 $('demo-instruction').textContent='Pull a hanging lamp and release it to swing the light. Drag elsewhere to orbit. Queue a set or a break; Tired makes later sets harder.';
 $('demo-features').replaceChildren(...['World-space grips','Completion-driven actions','Portable workout'].map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
 $('demo-scrub').hidden=true;$('demo-sound').hidden=true;$('demo-caption').textContent='Loading rig and workout…';
 $('demo-controls').innerHTML='<div class="demo-actions" id="workout-actions"></div>';
 const actions=$('workout-actions');
 const button=(id,label,fn)=>{const b=document.createElement('button');b.id=id;b.textContent=label;b.disabled=true;b.onclick=()=>{try{Promise.resolve(fn()).catch(onError);}catch(error){onError(error);}};actions.append(b);return b;};
 const start=()=>{playing=true;last=null;onPlayingChange(true);};
 const request=name=>{start();$('demo-status').textContent='Queued '+name+' at the next safe transition.';return game.actor('atlas').do(name).then(()=>$('demo-status').textContent=name+' completed.').catch(error=>{if(error.name!=='AbortError')throw error;});};
 button('workout-pullup','Pull-up set',()=>request('pullup'));
 button('workout-bench','Bench set',()=>request('bench'));
 button('workout-drink','Get water',()=>request('drink'));
 button('workout-rest','Rest',()=>request('rest'));
 button('gym-tired','Tired',()=>{start();return view.setVariable('fatigue',85);});
 button('gym-thirsty','Thirsty',()=>{start();return view.setVariable('dehydration',85);});
 button('gym-fresh','Fresh',async()=>{start();await view.setVariable('fatigue',8);await view.setVariable('dehydration',10);});
 const legacy=document.createElement('a');legacy.className='demo-edit';legacy.href='./demos.html?legacy=1#gym-routine';legacy.textContent='Recorded 2D comparison';actions.append(legacy);
 function update(frame){if(disposed||!frame)return;const w=frame.workout||{},stats=w.stats||w.variables||{};canvas.dataset.phase=frame.phase||'';canvas.dataset.activity=w.activity||'';canvas.dataset.time=String(time);
  $('demo-caption').textContent=`Atlas · ${(w.activity||frame.phase||'preparing').replaceAll('-',' ')}${frame.rep?' · rep '+frame.rep:''} · fatigue ${Math.round(stats.fatigue||0)} · thirst ${Math.round(stats.dehydration||0)}`;
  $('demo-time').textContent=playing?'Live illustration':'Paused';
  if(frame.valid===false)$('demo-status').textContent='Motion target needs adjustment. Open Studio to inspect contacts.';
 }
 const observer=new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);last=null;});observer.observe(art);
 const visibility=()=>{last=null;};document.addEventListener('visibilitychange',visibility);
 const ready=Promise.all([import('../src/native-three-view.js'),import('../src/workout-project-3d.js')]).then(async([renderer,documents])=>{
  if(disposed)return;project=documents.createWorkoutProject3D();
  const next=await renderer.createNativeThreeView(canvas,{...project,onFrame:update,onError:error=>{playing=false;onPlayingChange(false);onError(error);}});if(disposed){next.dispose();return;}view=next;game=createWorkoutGame(view,{onCommand:start});
  actions.querySelectorAll('button').forEach(b=>b.disabled=false);update(view.frame);$('demo-status').textContent='Live workout · native rig · shared action mechanics';
  window.posecraftWorkout={view,game,get project(){return structuredClone(project);},get time(){return time;},pause(){api.pause();},play(){api.play();},async advance(seconds){time+=seconds;return view.render(time);}};
 }).catch(error=>{if(!disposed)onError(error);});
 function tick(now){if(disposed)return;const dt=last===null?0:Math.min(.05,(now-last)/1000);last=now;if(view&&playing&&inView&&!document.hidden&&!busy){time+=dt;view.renderAsync(time);}raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
 const api={ready,play(){start();},pause(){playing=false;last=null;onPlayingChange(false);$('demo-time').textContent='Paused';},async reset(){await ready;if(disposed||!view)return;busy=true;try{game.dispose();await view.resetMovement();time=0;last=null;game=createWorkoutGame(view,{onCommand:start});window.posecraftWorkout.game=game;update(view.frame);$('demo-status').textContent='Workout restarted.';}finally{busy=false;}},download(){if(!project)return;const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='one-more-rep.workout3d.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);game?.dispose();view?.dispose();art.classList.remove('native-workout');$('demo-stage').classList.remove('native-workout-stage');delete window.posecraftWorkout;}};
 return api;
}
