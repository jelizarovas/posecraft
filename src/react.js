import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { mountScene } from './browser.js';

export const Posecraft = forwardRef(function Posecraft({ scene, inputs = {}, behavior = {}, onEvent, onError, onSpeechRequest, motion, scroll, hostRef, reducedMotion = 'system', execution = 'worker', label, className, style }, ref) {
  const element = useRef(null), instance = useRef(null), events = useRef(onEvent), errors = useRef(onError), speech = useRef(onSpeechRequest), signal = useRef(motion);
  events.current = onEvent; errors.current = onError; speech.current = onSpeechRequest; signal.current = motion;
  const mounted=()=>{if(!instance.current)throw Error('Posecraft scene is not mounted.');return instance.current;};
  useImperativeHandle(ref, () => ({ actor:id=>mounted().actor(id),object:id=>mounted().object(id),prop:id=>mounted().prop(id),describe:()=>mounted().describe(),sequence:(steps,options)=>mounted().sequence(steps,options),snapshot:()=>mounted().snapshot(),restore:state=>mounted().restore(state),play: () => instance.current?.play(), pause: () => instance.current?.pause(), reset: () => instance.current?.reset(), seek: t => instance.current?.seek(t), refreshScroll:()=>instance.current?.refreshScroll(), interact:(actor,type,strength)=>instance.current?.interact(actor,type,strength),get controller() { return instance.current?.controller; } }), []);
  useEffect(() => {
    try { instance.current = mountScene(element.current, scene, { host: hostRef?.current || element.current, reducedMotion, execution, scroll, onError:e=>errors.current?.(e), onSpeechRequest:onSpeechRequest?request=>speech.current?.(request):undefined, label, motion: motion ? t => signal.current(t) : undefined, onEvent: e => events.current?.(e) }); }
    catch (error) { element.current.textContent = 'Scene could not be loaded.'; errors.current?.(error); }
    return () => { instance.current?.dispose(); instance.current = null; };
  }, [scene, hostRef, reducedMotion, execution, label, scroll, !!motion, !!onSpeechRequest]);
  useEffect(() => {
    try { for (const [actor, values] of Object.entries(inputs)) for (const [name, value] of Object.entries(values)) instance.current?.setInput(actor, name, value); }
    catch (error) { errors.current?.(error); }
  }, [inputs, scene, reducedMotion, execution, label, hostRef, scroll, !!motion, !!onSpeechRequest]);
  useEffect(()=>{try{for(const [actor,settings] of Object.entries(behavior))instance.current?.setBehavior(actor,settings);}catch(error){errors.current?.(error);}},[behavior,scene,reducedMotion,execution,label,hostRef,scroll,!!motion,!!onSpeechRequest]);
  return createElement('div', { ref: element, className, style: { width: '100%', height: '100%', ...style }, 'aria-label': label || scene.name, 'data-posecraft': '' });
});
export const PosecraftScene=Posecraft;
