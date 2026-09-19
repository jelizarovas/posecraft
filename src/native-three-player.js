import {createNativeThreeView} from './native-three-view.js';
import {assertBenchProject3D} from './bench-project-3d.js';
import {assertWorkoutProject3D} from './workout-project-3d.js';

/** Both project kinds use the same Studio renderer and worker action runtime. */
export async function mountNativeBenchPlayer(container,document,options={}){
  const project=structuredClone(document?.kind==='workout3d'?assertWorkoutProject3D(document):assertBenchProject3D(document));
  const canvas=globalThis.document.createElement('canvas');canvas.setAttribute('aria-label',project.name);container.append(canvas);
  let view;try{view=await createNativeThreeView(canvas,{...project,assetUrl:options.assetUrl,onFrame:options.onFrame,onError:options.onError});}catch(error){canvas.remove();throw error;}
  const button=globalThis.document.createElement('button');button.hidden=options.controls===false;container.append(button);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let playing=options.paused===undefined?!motion.matches:!options.paused,time=0,last=null,raf,disposed=false,inView=true;
  const observer=new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);last=null;});observer.observe(container);
  const update=()=>{button.textContent=playing?'Pause':'Play';button.setAttribute('aria-pressed',String(playing));};update();
  const play=()=>{if(disposed)return;if(time>=view.duration||view.frame?.workout?.stopped){view.resetMovement();time=0;}playing=true;last=null;update();};
  const pause=()=>{playing=false;last=null;update();};
  button.onclick=()=>playing?pause():play();
  const visible=()=>{last=null;};globalThis.document.addEventListener('visibilitychange',visible);
  const reduced=event=>{if(event.matches)pause();};motion.addEventListener('change',reduced);
  function tick(now){if(disposed)return;if(last!==null&&playing&&inView&&!globalThis.document.hidden){time=Math.min(view.duration,time+Math.min(.05,(now-last)/1000));try{view.renderAsync(time);if(time===view.duration||view.frame?.workout?.stopped){if(Number.isFinite(view.duration))view.render(time);pause();}}catch(error){pause();try{options.onError?.(error);}catch{}}}last=now;raf=requestAnimationFrame(tick);}
  raf=requestAnimationFrame(tick);
  return {view,project,seek(value){if(!Number.isFinite(value))throw new TypeError('Seek time must be finite.');time=Math.max(0,Math.min(view.duration,value));last=null;return view.render(time);},play,pause,
    setVariable:(name,value)=>view.setVariable(name,value),request:(action,requestOptions)=>view.request(action,requestOptions),cancel:request=>view.cancel(request),subscribe:fn=>view.subscribe(fn),describe:()=>view.describe(),
    reset(){view.resetMovement();time=0;last=null;},finishSafely(){const supported=view.finishSafely(time);if(supported){if(project.kind!=='workout3d')time=0;playing=true;last=null;update();}return supported;},
    get time(){return time;},get duration(){return view.duration;},get playing(){return playing;},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();motion.removeEventListener('change',reduced);globalThis.document.removeEventListener('visibilitychange',visible);view.dispose();canvas.remove();button.remove();}
  };
}
export function mountNativeWorkoutPlayer(container,project,options={}){assertWorkoutProject3D(project);return mountNativeBenchPlayer(container,project,options);}
