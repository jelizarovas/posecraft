import {mountBottleControls} from './bottle-browser.js';
import {mountScenePointers} from './pointer-browser.js';
import { SceneController } from './scene.js';
import { mountSVG } from './svg.js';
import { WorkerSceneController } from './worker.js';

export function mountScene(element, document, { host = element, reducedMotion = 'system', onEvent, onError, motion, label, autoplay = true, execution = 'worker' } = {}) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const Controller=execution==='main'||typeof Worker==='undefined'?SceneController:WorkerSceneController;
  const controller = new Controller(document, { reducedMotion: reducedMotion === 'system' ? media.matches : !!reducedMotion,onError });
  const renderer = mountSVG(element, document, controller.frame(), { label });
  if(controller instanceof WorkerSceneController)controller.onFrame=frame=>renderer.update(frame);
  const unsubscribe = onEvent ? controller.subscribe(onEvent) : () => {};
  let disposed = false, raf = 0, last = null, visible = true;
  const resetClock = () => { last = null; controller.rebaseline(); };
  const policy = () => { controller.reducedMotion = reducedMotion === 'system' ? media.matches : !!reducedMotion; resetClock(); renderer.update(controller.frame()); schedule(); };
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
  const scroll = () => resetClock();
  globalThis.document.addEventListener('visibilitychange', visibility);
  globalThis.addEventListener('scroll', scroll, true);
  media.addEventListener('change', policy);
  if (!autoplay) controller.pause();
  const pointers=mountScenePointers(element,document,controller,{onInteract:()=>{controller.play();schedule();},onUpdate:()=>renderer.update(controller.frame())});
  const bottle=mountBottleControls(element,document,controller,{onInteract:()=>{controller.play();schedule();},onUpdate:()=>renderer.update(controller.frame())});
  schedule();
  return {
    controller,
    enableMotion:()=>bottle.enableMotion(),disableMotion:()=>bottle.disableMotion(),
    fluidInput(command){controller.fluidInput(command);renderer.update(controller.frame());},
    dispatch(event,payload){controller.dispatch(event,payload);renderer.update(controller.frame());},
    setVariable(name,value){controller.setVariable(name,value);},
    pointer(command){controller.pointer(command);renderer.update(controller.frame());},
    walkTo(actor,x){controller.walkTo(actor,x);renderer.update(controller.frame());},
    setBehavior(actor,settings){controller.setBehavior(actor,settings);renderer.update(controller.frame());},
    interact(actor,type,strength){controller.interact(actor,type,strength);renderer.update(controller.frame());},
    setInput(actor, name, value) { controller.setInput(actor, name, value); if (controller.reducedMotion&&controller.tick) controller.tick(); renderer.update(controller.frame()); },
    play() { controller.play(); resetClock(); schedule(); },
    pause() { controller.pause(); cancelAnimationFrame(raf); raf = 0; },
    reset() { renderer.update(controller.reset()); resetClock(); },
    seek(time) { renderer.update(controller.seek(time)); resetClock(); },
    dispose() { bottle.dispose();pointers.dispose(); disposed = true; cancelAnimationFrame(raf); size.disconnect(); observer.disconnect(); media.removeEventListener('change', policy); globalThis.document.removeEventListener('visibilitychange', visibility); globalThis.removeEventListener('scroll', scroll, true); unsubscribe(); controller.dispose(); renderer.dispose(); }
  };
}
