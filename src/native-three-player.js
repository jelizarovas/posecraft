import {createNativeThreeView} from './native-three-view.js';
import {assertBenchProject3D} from './bench-project-3d.js';

/** Mount an exported illustration with the exact Studio sampler and renderer. */
export async function mountNativeBenchPlayer(container,document,options={}){
  const project=structuredClone(assertBenchProject3D(document)),canvas=globalThis.document.createElement('canvas');
  canvas.setAttribute('aria-label',project.name);container.append(canvas);
  const view=await createNativeThreeView(canvas,{...project,assetUrl:options.assetUrl});
  const button=globalThis.document.createElement('button');container.append(button);
  let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,last=null,raf,disposed=false,inView=true;
  const observer=new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);last=null;});observer.observe(container);
  const update=()=>{button.textContent=playing?'Pause':'Play';button.setAttribute('aria-pressed',String(playing));};update();
  button.onclick=()=>{playing=!playing;last=null;update();};
  const visible=()=>{last=null;};globalThis.document.addEventListener('visibilitychange',visible);
  function tick(now){if(disposed)return;if(last!==null&&playing&&inView&&!globalThis.document.hidden){time=Math.min(view.duration,time+Math.min(.05,(now-last)/1000));view.renderAsync(time);if(time===view.duration){view.render(time);playing=false;update();}}last=now;raf=requestAnimationFrame(tick);}
  button.addEventListener('click',()=>{if(time>=view.duration){time=0;playing=true;update();}});
  raf=requestAnimationFrame(tick);
  return {view,project,seek(value){time=Math.max(0,Math.min(view.duration,value));return view.render(time);},play(){if(time>=view.duration)time=0;playing=true;update();},pause(){playing=false;update();},get time(){return time;},get duration(){return view.duration;},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();globalThis.document.removeEventListener('visibilitychange',visible);view.dispose();canvas.remove();button.remove();}};
}
