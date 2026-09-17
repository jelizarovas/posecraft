import React, { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Posecraft } from '../src/react.js';
import { library } from './library.js';
import '../studio/style.css';

const title = s => s[0].toUpperCase()+s.slice(1);
const Icon = ({name}) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
function Demo() {
  const [character,setCharacter]=useState('ona'),[action,setAction]=useState('idle'),[emotion,setEmotion]=useState('neutral'),[hair,setHair]=useState('none'),[colors,setColors]=useState({});
  const [mounted,setMounted]=useState(true),[event,setEvent]=useState('Drag the card. Watch the character lean and settle.'),[width,setWidth]=useState(500),[policy,setPolicy]=useState('system');
  const host=useRef(null),player=useRef(null),drag=useRef(null),position=useRef({x:0,y:0});
  const scene=useMemo(()=>{const d=structuredClone(library[character]);d.actors[0].appearance=colors;return d;},[character,colors]);
  const pack=scene.packs[character];
  const move=(x,y)=>{position.current={x,y};host.current.style.transform=`translate(${x}px,${y}px)`;};
  function chooseCharacter(id){setCharacter(id);setAction('idle');setEmotion('neutral');setHair('none');setColors({});move(0,0);}
  return <main className="react-page"><header className="demo-heading"><a href="./"><Icon name="arrow_back"/> Studio</a><strong>Posecraft playground</strong><select aria-label="Demo motion" value={policy} onChange={e=>setPolicy(e.target.value)}><option value="system">System motion</option><option value="full">Motion on</option><option value="reduced">Still preview</option></select></header>
    <div className="demo-toolbar"><label>Character <select aria-label="Demo character" value={character} onChange={e=>chooseCharacter(e.target.value)}>{Object.entries(library).map(([id,d])=><option key={id} value={id}>{d.name}</option>)}</select></label><label>Action <select aria-label="Demo action" value={action} onChange={e=>setAction(e.target.value)}>{Object.keys(pack.clips).map(id=><option key={id} value={id}>{title(id)}</option>)}</select></label><label>Emotion <select aria-label="Demo emotion" value={emotion} onChange={e=>setEmotion(e.target.value)}>{pack.inputs.emotion.options.map(id=><option key={id} value={id}>{title(id)}</option>)}</select></label>
    {pack.inputs.hair&&<label>Hair <select aria-label="Demo hair" value={hair} onChange={e=>setHair(e.target.value)}>{pack.inputs.hair.options.map(id=><option key={id} value={id}>{title(id)}</option>)}</select></label>}</div>
    <div className="demo-toolbar demo-colors">{Object.entries(pack.appearanceDefaults).map(([name,value])=><label key={name}>{title(name)}<input aria-label={`${name} color`} type="color" value={colors[name]||value} onChange={e=>setColors({...colors,[name]:e.target.value})}/></label>)}</div>
    <div className="demo-board"><div ref={host} className="react-modal" style={{width}} tabIndex={0} aria-label="Draggable character card" onKeyDown={e=>{if(e.key.startsWith('Arrow')){e.preventDefault();move(position.current.x+(e.key==='ArrowLeft'?-16:e.key==='ArrowRight'?16:0),position.current.y+(e.key==='ArrowUp'?-16:e.key==='ArrowDown'?16:0));}}} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,start:{...position.current}};}} onPointerMove={e=>{const d=drag.current;if(d)move(Math.max(-170,Math.min(170,d.start.x+e.clientX-d.x)),Math.max(-70,Math.min(70,d.start.y+e.clientY-d.y)));}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
    {mounted&&<Posecraft ref={player} scene={scene} inputs={{[character]:{action,emotion,...(pack.inputs.hair?{hair}:{})}}} hostRef={host} reducedMotion={policy==='system'?'system':policy==='reduced'} label={`${scene.name} in a moving card`} onEvent={e=>{if(e.type==='transition')setEvent(`${e.actor}: ${e.from} → ${e.to}`);}} onError={e=>setEvent(e.message)}/>}</div></div>
    <div className="demo-toolbar"><button aria-label="Pause" onClick={()=>player.current?.pause()}><Icon name="pause"/></button><button aria-label="Play" onClick={()=>player.current?.play()}><Icon name="play_arrow"/></button><button aria-label="Reset" onClick={()=>{move(0,0);player.current?.reset();setAction('idle');setEmotion('neutral');setHair('none');}}><Icon name="restart_alt"/></button><button onClick={()=>setMounted(v=>!v)}>{mounted?'Unmount':'Mount'}</button><label>Width <input aria-label="Container width" type="range" min="280" max="650" value={width} onChange={e=>setWidth(+e.target.value)}/></label></div>
    <div className="event-log" role="status">{event}</div><p className="demo-caption">Drag the card or use its arrow keys. System motion follows your device preference; Motion on enables the full preview. Rusty has seated head, paw and tail actions. <a href="./wwwzard.html">Original wwwzard cloth and typing demo →</a></p>
  </main>;
}
createRoot(document.getElementById('app')).render(<StrictMode><Demo/></StrictMode>);
