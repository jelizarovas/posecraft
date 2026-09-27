import {createElement,forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import {mountIllustration} from './index.js';

/** React adapter for the same illustration player used by the plain browser API. */
export const PosecraftIllustration=forwardRef(function PosecraftIllustration({scene,label,autoplay=true,reducedMotion='system',onEvent,onError,onReady,className,style},ref){
  const host=useRef(null),player=useRef(null),callbacks=useRef({});
  callbacks.current={onEvent,onError,onReady};
  useImperativeHandle(ref,()=>({
    get player(){return player.current;},
    dispatch(event,payload){player.current?.dispatch(event,payload);},
    setVariable(name,value){player.current?.setVariable(name,value);},
    setInput(actor,name,value){player.current?.setInput(actor,name,value);},
    play(){player.current?.play();},pause(){player.current?.pause();},
    reset(){player.current?.reset();},seek(time){player.current?.seek(time);},
  }),[]);
  useEffect(()=>{
    try{
      player.current=mountIllustration(host.current,scene,{label,autoplay,reducedMotion,
        onEvent:event=>callbacks.current.onEvent?.(event),
        onError:error=>{if(callbacks.current.onError)callbacks.current.onError(error);else console.error(error);}});
      callbacks.current.onReady?.(player.current);
    }catch(error){if(callbacks.current.onError)callbacks.current.onError(error);else console.error(error);}
    return()=>{player.current?.dispose();player.current=null;};
  },[scene,label,autoplay,reducedMotion]);
  return createElement('div',{ref:host,className,style:{width:'100%',aspectRatio:`${scene.bounds.width} / ${scene.bounds.height}`,...style},'data-posecraft':'','aria-label':label||scene.name});
});
