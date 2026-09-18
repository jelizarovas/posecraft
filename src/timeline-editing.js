import {DocumentStore} from './commands.js';
const easings = ['linear', 'smooth', 'step'];
const number = value => typeof value === 'number' && Number.isFinite(value);
const id = key => JSON.stringify([key.track, key.time]);
const quantize = time => Math.round(time * 1000) / 1000;

/** Pure clip edit. Callers commit the returned clip in one validated DocumentStore transaction. */
export function editTimelineKeys(clip, selection, operation) {
  if (!clip || !number(clip.duration) || clip.duration < .1 || clip.duration > 180 || typeof clip.loop !== 'boolean' || !clip.tracks || typeof clip.tracks !== 'object' || Array.isArray(clip.tracks)) throw new Error('Invalid animation clip.');
  for (const [track, keys] of Object.entries(clip.tracks)) {
    if (!Array.isArray(keys) || !keys.length || keys.length > 1000 || keys.some((key, i) => !Array.isArray(key) || key.length < 2 || key.length > 3 || !number(key[0]) || !number(key[1]) || key[0] < 0 || key[0] > clip.duration || i > 0 && key[0] <= keys[i - 1][0] || key[2] !== undefined && !easings.includes(key[2]))) throw new Error(`Invalid keys in ${track}.`);
  }
  if (!Array.isArray(selection) || !selection.length) throw new Error('Select one or more keys first.');
  const selected = new Map();
  for (const ref of selection) {
    if (!ref || typeof ref.track !== 'string' || !number(ref.time) || !Object.hasOwn(clip.tracks, ref.track) || !clip.tracks[ref.track].some(key => key[0] === ref.time)) throw new Error('A selected key no longer exists. Select it again.');
    selected.set(id(ref), ref);
  }
  if (!operation || !['move', 'copy', 'scale', 'delete', 'easing'].includes(operation.type)) throw new Error('Unknown key operation.');
  if (['move', 'copy'].includes(operation.type) && !number(operation.offset)) throw new Error('Enter a finite time offset in seconds.');
  if (operation.type === 'scale' && (!number(operation.factor) || operation.factor <= 0 || !number(operation.pivot))) throw new Error('Scale must be positive and its anchor must be a finite time.');
  if (operation.type === 'easing' && !easings.includes(operation.easing)) throw new Error('Choose Linear, Smooth or Step easing.');
  const result = structuredClone(clip), nextSelection = [];
  for (const [track, keys] of Object.entries(clip.tracks)) {
    const output = [], affected = [];
    for (const key of keys) {
      if (!selected.has(id({track, time:key[0]}))) { output.push([...key]); continue; }
      if (operation.type === 'delete') continue;
      if (operation.type === 'copy') output.push([...key]);
      const next = [...key];
      if (['move', 'copy'].includes(operation.type)) next[0] = quantize(key[0] + operation.offset);
      if (operation.type === 'scale') next[0] = quantize(operation.pivot + (key[0] - operation.pivot) * operation.factor);
      if (operation.type === 'easing') next[2] = operation.easing;
      if (!number(next[0]) || next[0] < 0 || next[0] > clip.duration) throw new Error(`Keys must stay between 0 and ${clip.duration} seconds. No keys changed.`);
      affected.push(next); nextSelection.push({track, time:next[0]});
    }
    output.push(...affected); output.sort((a,b) => a[0] - b[0]);
    if (output.some((key,i) => i > 0 && Math.abs(key[0] - output[i-1][0]) < .0000001)) throw new Error(`Keys would overlap in ${track}. No keys changed.`);
    if (output.length > 1000) throw new Error('A track can hold at most 1,000 keys. No keys changed.');
    if (output.length) result.tracks[track] = output; else delete result.tracks[track];
  }
  return {clip:result, selection:nextSelection};
}

/** Retime one shared pack clip and its explicit clip-local references atomically.
 * Graph deadlines, live procedural motion and transition blend clocks cannot be
 * inferred from animation keys; unsupported dependencies are rejected. */
export function retimeSceneClip(document,{packId,clipId,duration}={}){
 const store=new DocumentStore(document),pack=store.document.packs[packId],source=pack?.clips[clipId];
 if(!source)throw Error('Choose an existing pack and clip.');
 if(!number(duration)||duration<.1||duration>180||Math.abs(duration-quantize(duration))>1e-9)throw Error('Duration must be 0.1..180 seconds at millisecond precision.');
 const actorIds=new Set(document.actors.filter(a=>a.pack===packId).map(a=>a.id)),notes=[],affected=[];
 for(const graph of [document.behaviorGraph,...(document.actorBehaviors||[]).filter(s=>actorIds.has(s.actor)).map(s=>s.graph)].filter(Boolean)){
  for(const recipe of Object.values(graph.activities||{}))if(actorIds.has(recipe.actor)&&[...recipe.variants,...recipe.failureVariants||[]].some(v=>v.clip===clipId))throw Error('This clip is used by an activity recipe. Retime its windows and completion effects explicitly first.');
 }
 if(actorIds.size&&document.presentation!=='sequence'&&(document.behaviorGraph||document.actorBehaviors?.some(s=>actorIds.has(s.actor))))throw Error('Live behavior graphs may depend on clip timing. Retime an authored sequence or remove that dependency first.');
 if(document.motionLayers?.some(l=>actorIds.has(l.actor)&&l.enabled!==false&&(!l.clips||l.clips.includes(clipId))))throw Error('This clip has a live motion layer. Retime its wall-clock frequency explicitly first.');
 if(document.ensemble&&[document.ensemble.sky,...document.ensemble.members||[]].some(id=>actorIds.has(id))||document.fluid&&[document.fluid.vessel,document.fluid.contents].some(id=>actorIds.has(id))||document.objectGames?.some(g=>g.enabled!==false&&g.participants.some(p=>actorIds.has(p.actor))))throw Error('A live procedural controller owns this actor. Its timing cannot be inferred from clip keys.');
 const scale=duration/source.duration,next=structuredClone(source),retime=t=>quantize(t*scale);next.duration=duration;
 for(const [track,keys]of Object.entries(next.tracks)){
  keys.forEach(key=>key[0]=retime(key[0]));
  if(keys.some((key,i)=>i&&key[0]<=keys[i-1][0]))throw Error(`Retiming would merge keys in ${track} at millisecond precision. No changes made.`);
 }
 if(source.events!==undefined){
  if(!Array.isArray(source.events)||source.events.length>128||source.events.some(e=>!e||typeof e!=='object'||Array.isArray(e)||!number(e.time)||e.time<0||e.time>source.duration||typeof e.name!=='string'||!e.name.trim().length||e.name.length>80))throw Error('Clip events must contain up to 128 named markers inside the clip.');
  const times=new Map();next.events=source.events.map(event=>{const time=retime(event.time);if(times.has(time)&&times.get(time)!==event.time)throw Error('Retiming would merge distinct event times at millisecond precision.');times.set(time,event.time);return {...structuredClone(event),time};});
 }
 const commands=[{op:'set',path:['packs',packId,'clips',clipId],value:next}];
 if(document.contacts?.some(c=>actorIds.has(c.actor)&&c.clip===clipId)){
  const contacts=document.contacts.map(c=>{
   if(!actorIds.has(c.actor)||c.clip!==clipId)return structuredClone(c);
   const result=structuredClone(c);for(const key of ['start','end','fadeIn','fadeOut','period'])if(result[key]!==undefined){result[key]=retime(result[key]);if(c[key]>0&&result[key]===0)throw Error(`Retiming would collapse contact ${c.id} ${key} to zero.`);}
   if(c.end>c.start&&result.end<=result.start)throw Error(`Retiming would collapse contact ${c.id}'s window.`);
   if((result.fadeIn||0)+(result.fadeOut||0)>result.end-result.start+1e-10)throw Error(`Rounded fades no longer fit contact ${c.id}'s window.`);
   affected.push(c.id);return result;
  });commands.push({op:'set',path:['contacts'],value:contacts});
 }
 if(document.contacts?.some(c=>actorIds.has(c.actor)&&c.clip===undefined))notes.push('Unfiltered contacts retain their times because they also apply to other clips.');
 if(document.scroll?.mode==='authored'&&document.scroll.clips.some(c=>actorIds.has(c.actor)&&c.clip===clipId)){
  const scroll=structuredClone(document.scroll);for(const cue of scroll.clips)if(actorIds.has(cue.actor)&&cue.clip===clipId){for(const key of ['start','end'])if(cue[key]!==undefined)cue[key]=retime(cue[key]);if((cue.end??duration)<=(cue.start??0))throw Error('Retiming would collapse an authored scroll window.');}commands.push({op:'set',path:['scroll'],value:scroll});
 }
 if(Object.values(pack.states).some(state=>state.transitions?.length))notes.push('State transition blend durations keep their original wall-clock seconds.');
 notes.push('Only this scene is updated. External episode cues, host schedules and other files are not retimed.');
 return {document:store.transact(commands,document.revision),commands:structuredClone(commands),expectedRevision:document.revision,scale,contacts:affected,notes};
}
