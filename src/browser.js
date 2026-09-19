import {mountScrollBindings,assertScrollConfig} from './scroll-bindings.js';
import {mountBottleControls} from './bottle-browser.js';
import {mountScenePointers} from './pointer-browser.js';
import { SceneController } from './scene.js';
import { mountRenderer } from './render-mount.js';
import { WorkerSceneController } from './worker.js';
import { createGameScene } from './game.js';

export function mountScene(element, document, { host = element, reducedMotion = 'system', onEvent, onError, onSpeechRequest, motion, label, autoplay = true, execution = 'worker', scroll = document.scroll } = {}) {
  if(scroll){const {source,...config}=scroll;assertScrollConfig(document,config);if(source!==undefined&&source!==globalThis&&!(source instanceof HTMLElement))throw Error('Scroll source must be a window or scrollable element.');}
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const Controller=execution==='main'||typeof Worker==='undefined'?SceneController:WorkerSceneController;
  const controller = new Controller(document, { reducedMotion: reducedMotion === 'system' ? media.matches : !!reducedMotion,onError });
  const renderer = mountRenderer(element, document, controller.frame(), { label });
  if(controller instanceof WorkerSceneController)controller.onFrame=frame=>renderer.update(frame);
  const unsubscribe = onEvent ? controller.subscribe(event=>{try{onEvent(event);}catch(error){try{onError?.(error);}catch{}}}) : () => {};
  let disposed = false, raf = 0, last = null, visible = true, scrollBinding;
  const resetClock = () => { last = null; controller.rebaseline(); };
  const policy = () => { controller.reducedMotion = reducedMotion === 'system' ? media.matches : !!reducedMotion; resetClock(); scrollBinding?.refresh(); renderer.update(controller.frame()); schedule(); };
  const size = new ResizeObserver(entries => { const rect = entries[0].contentRect; controller.size = { width: rect.width, height: rect.height }; resetClock(); }); size.observe(element);
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resetClock(); schedule(); }); observer.observe(element);
  function schedule() { if (!disposed && !raf && visible && !globalThis.document.hidden && controller.playing && !controller.reducedMotion) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (disposed || !visible || globalThis.document.hidden || !controller.playing || controller.reducedMotion) { last = null; return; }
    const seconds = now / 1000;
    if (motion) controller.sampleHost({ ...motion(seconds), time: seconds });
    else { const rect = host.getBoundingClientRect(); controller.sampleHost({ x: rect.x, y: rect.y, time: seconds }); }
    renderer.update(controller.step(last === null ? 0 : (now - last) / 1000)); last = now;
    schedule();
  }
  const visibility = () => { resetClock(); schedule(); };
  const hostScroll = () => resetClock();
  globalThis.document.addEventListener('visibilitychange', visibility);
  globalThis.addEventListener('scroll', hostScroll, true);
  media.addEventListener('change', policy);
  if (!autoplay) controller.pause();
  const pointers=mountScenePointers(element,document,controller,{onInteract:()=>{if(scroll?.mode!=='authored'){controller.play();schedule();}},onUpdate:()=>renderer.update(controller.frame())});
  const bottle=mountBottleControls(element,document,controller,{onInteract:()=>{if(scroll?.mode!=='authored'){controller.play();schedule();}},onUpdate:()=>renderer.update(controller.frame())});
  scrollBinding=scroll?mountScrollBindings(element,document,controller,scroll,{onUpdate:frame=>renderer.update(frame),onError}):null;
  const game=createGameScene(controller,{onSpeechRequest,onEvent:event=>{
    queueMicrotask(()=>{if(!disposed)renderer.update(controller.frame());});
    onEvent?.(event);
  },onError,onCommand:()=>{
    if(disposed)throw Error('Scene has been disposed.');
    if(scroll?.mode==='authored')throw Error('Game commands are unavailable during authored scrolling. Use live scrolling or disable the scroll binding.');
    if(!controller.playing)resetClock();
    controller.play();schedule();
  }});
  schedule();
  return {
    controller,
    actor:id=>game.actor(id),object:id=>game.object(id),prop:id=>game.prop(id),describe:()=>game.describe(),sequence:(steps,options)=>game.sequence(steps,options),
    objectCommand(command){const result=controller.objectCommand(command);renderer.update(controller.frame());return result;},
    refreshScroll(){scrollBinding?.refresh();},
    enableMotion:()=>bottle.enableMotion(),disableMotion:()=>bottle.disableMotion(),
    fluidInput(command){controller.fluidInput(command);renderer.update(controller.frame());},
    dispatch(event,payload){controller.dispatch(event,payload);renderer.update(controller.frame());},
    setVariable(name,value){controller.setVariable(name,value);},
    pointer(command){controller.pointer(command);renderer.update(controller.frame());},
    walkTo(actor,x){controller.walkTo(actor,x);renderer.update(controller.frame());},
    setBehavior(actor,settings){controller.setBehavior(actor,settings);renderer.update(controller.frame());},
    interact(actor,type,strength){controller.interact(actor,type,strength);renderer.update(controller.frame());},
    setInput(actor, name, value) { controller.setInput(actor, name, value); if (controller.reducedMotion&&controller.tick) controller.tick(); renderer.update(controller.frame()); },
    play() { if(scroll?.mode==='authored'){scrollBinding?.refresh();return;}controller.play(); resetClock(); schedule(); },
    pause() { controller.pause(); cancelAnimationFrame(raf); raf = 0; },
    reset() { game.cancelAll('Scene reset');renderer.update(controller.reset()); resetClock(); scrollBinding?.refresh(); },
    seek(time) { game.cancelAll('Scene seek');renderer.update(controller.seek(time)); resetClock(); },
    dispose() { if(disposed)return;disposed=true;game.dispose();scrollBinding?.dispose();bottle.dispose();pointers.dispose();cancelAnimationFrame(raf); size.disconnect(); observer.disconnect(); media.removeEventListener('change', policy); globalThis.document.removeEventListener('visibilitychange', visibility); globalThis.removeEventListener('scroll', hostScroll, true); unsubscribe(); controller.dispose(); renderer.dispose(); }
  };
}
