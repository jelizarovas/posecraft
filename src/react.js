import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { mountScene } from './browser.js';

export const Posecraft = forwardRef(function Posecraft({ scene, inputs = {}, behavior = {}, onEvent, onError, motion, hostRef, reducedMotion = 'system', execution = 'worker', label, className, style }, ref) {
  const element = useRef(null), instance = useRef(null), events = useRef(onEvent), errors = useRef(onError), signal = useRef(motion);
  events.current = onEvent; errors.current = onError; signal.current = motion;
  useImperativeHandle(ref, () => ({ play: () => instance.current?.play(), pause: () => instance.current?.pause(), reset: () => instance.current?.reset(), seek: t => instance.current?.seek(t), interact:(actor,type,strength)=>instance.current?.interact(actor,type,strength),get controller() { return instance.current?.controller; } }), []);
  useEffect(() => {
    try { instance.current = mountScene(element.current, scene, { host: hostRef?.current || element.current, reducedMotion, execution, onError:e=>errors.current?.(e), label, motion: motion ? t => signal.current(t) : undefined, onEvent: e => events.current?.(e) }); }
    catch (error) { element.current.textContent = 'Scene could not be loaded.'; errors.current?.(error); }
    return () => { instance.current?.dispose(); instance.current = null; };
  }, [scene, hostRef, reducedMotion, execution, label, !!motion]);
  useEffect(() => {
    try { for (const [actor, values] of Object.entries(inputs)) for (const [name, value] of Object.entries(values)) instance.current?.setInput(actor, name, value); }
    catch (error) { errors.current?.(error); }
  }, [inputs, scene, reducedMotion, execution, label, hostRef, !!motion]);
  useEffect(()=>{try{for(const [actor,settings] of Object.entries(behavior))instance.current?.setBehavior(actor,settings);}catch(error){errors.current?.(error);}},[behavior,scene,reducedMotion,execution,label,hostRef,!!motion]);
  return createElement('div', { ref: element, className, style: { width: '100%', height: '100%', ...style }, 'aria-label': label || scene.name, 'data-posecraft': '' });
});
