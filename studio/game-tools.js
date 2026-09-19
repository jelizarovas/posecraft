import {assertDocument} from '../src/schema.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validName=value=>/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
const set=(path,value)=>({op:'set',path,value});
const field=(id,label,value,attrs='')=>`<label class="field">${label}<input id="game-${id}" value="${esc(value)}" ${attrs}></label>`;
const options=(values,current)=>values.map(value=>{const [id,label]=Array.isArray(value)?value:[value,value];return `<option value="${esc(id)}" ${id===current?'selected':''}>${esc(label)}</option>`;}).join('');
const select=(id,label,values,current)=>`<label class="field">${label}<select id="game-${id}">${options(values,current)}</select></label>`;
const freshName=(mapping,base)=>{let name=base,n=2;while(Object.hasOwn(mapping,name))name=base+'-'+n++;return name;};

/** Semantic names are authored through the same validated undo transactions as poses. */
export function createGameTools({getDocument,commit}){
 let page='actors',actorId=null,anchorName=null,aliasName=null,reactionName=null;
 const doc=()=>getDocument();
 function render(target){
  const d=doc(),game=d.game??{anchors:{},actors:{}},anchors=game.anchors??{},actors=game.actors??{};
  if(!d.actors.some(a=>a.id===actorId))actorId=d.actors[0]?.id;
  const actor=d.actors.find(a=>a.id===actorId),pack=actor&&d.packs[actor.pack],binding=actors[actorId]??{};
  if(!Object.hasOwn(anchors,anchorName))anchorName=Object.keys(anchors)[0];
  if(!Object.hasOwn(binding.actions??{},aliasName))aliasName=Object.keys(binding.actions??{})[0];
  if(!Object.hasOwn(binding.reactions??{},reactionName))reactionName=Object.keys(binding.reactions??{})[0];
  target.innerHTML=`<div class="inspector-heading">Game bindings<small>Names for your game</small></div><nav class="prop-tabs"><button id="game-tab-actors" class="${page==='actors'?'active':''}">Characters</button><button id="game-tab-anchors" class="${page==='anchors'?'active':''}">Anchors</button></nav><p id="game-error" class="note" role="alert"></p><div id="game-fields"></div>`;
  const el=id=>target.querySelector('#game-'+id),error=message=>{el('error').textContent=message;};
  function edit(change){
   try{const next=structuredClone(doc());next.game??={};next.game.anchors??={};next.game.actors??={};change(next.game);next.requiredFeatures=[...new Set([...(next.requiredFeatures??[]),'game-bindings'])];assertDocument(next);if(JSON.stringify(next.game)===JSON.stringify(doc().game)&&JSON.stringify(next.requiredFeatures)===JSON.stringify(doc().requiredFeatures)){render(target);return;}commit([set(['game'],next.game),set(['requiredFeatures'],next.requiredFeatures)]);}
   catch(e){error(e.message);}
  }
  const updateActor=change=>edit(g=>{g.actors[actorId]??={};change(g.actors[actorId]);});
  const rename=(mapping,from,to)=>{if(!validName(to))throw new Error('Use a name starting with a letter, up to 80 characters: letters, numbers, . _ : -');if(to!==from&&Object.hasOwn(mapping,to))throw new Error('That name already exists.');if(to!==from){mapping[to]=mapping[from];delete mapping[from];}};
  el('tab-actors').onclick=()=>{page='actors';render(target);};el('tab-anchors').onclick=()=>{page='anchors';render(target);};
  if(page==='anchors'){
   const anchor=anchors[anchorName];
   el('fields').innerHTML=`${select('anchor','Named anchor',Object.keys(anchors),anchorName)}<button id="game-anchor-add" class="text-button">Add anchor</button>${anchor?`${field('anchor-name','Name',anchorName,'maxlength="80"')}${select('anchor-type','Target kind',[['point','Scene point'],['joint','Character joint'],['prop','Prop'],['object','Shared object']],anchor.type)}<div id="game-anchor-target"></div><button id="game-anchor-remove" class="text-button">Remove anchor</button>`:''}<p class="note">Your game uses these names to move and look at scene targets. Prop, object and joint offsets follow the target transform. Renaming a name also requires updating the host game that calls it.</p>`;
   el('anchor').onchange=e=>{anchorName=e.target.value;render(target);};
   el('anchor-add').onclick=()=>{const name=freshName(anchors,'anchor');edit(g=>{g.anchors[name]={type:'point',x:Math.round(d.bounds.width/2),y:Math.round(d.bounds.height/2)};anchorName=name;});};
   if(!anchor)return;
   el('anchor-name').onchange=e=>edit(g=>{rename(g.anchors,anchorName,e.target.value);anchorName=e.target.value;});
   el('anchor-remove').onclick=()=>edit(g=>{delete g.anchors[anchorName];});
   el('anchor-type').onchange=e=>edit(g=>{
    const type=e.target.value;
    if(type==='point')g.anchors[anchorName]={type,x:d.bounds.width/2,y:d.bounds.height/2};
    else if(type==='joint'){if(!actor)throw new Error('Add a character first.');g.anchors[anchorName]={type,actor:actor.id,joint:pack.joints[0].id,offsetX:0,offsetY:0};}
    else{const node=d[type+'s']?.[0];if(!node)throw new Error('Add a '+(type==='object'?'shared object':'prop')+' first.');g.anchors[anchorName]={type,[type]:node.id,offsetX:0,offsetY:0};}
   });
   const point=anchor.type==='point',axis=point?['x','y']:['offsetX','offsetY'],limit=point?10000:1000;
   el('anchor-target').innerHTML=(anchor.type==='joint'?select('anchor-actor','Target character',d.actors.map(a=>[a.id,a.name]),anchor.actor)+select('anchor-joint','Target joint',d.packs[d.actors.find(a=>a.id===anchor.actor).pack].joints.map(j=>j.id),anchor.joint):!point?select('anchor-node','Target '+anchor.type,(d[anchor.type+'s']??[]).map(p=>[p.id,p.name]),anchor[anchor.type]):'')+`<div class="two-col">${axis.map(key=>field('anchor-'+key,point?key.toUpperCase():key==='offsetX'?'Offset X':'Offset Y',anchor[key]??0,`type="number" min="-${limit}" max="${limit}" step="1"`)).join('')}</div>`;
   for(const key of axis)el('anchor-'+key).onchange=e=>edit(g=>{g.anchors[anchorName][key]=e.target.value===''?NaN:Number(e.target.value);});
   if(anchor.type==='joint'){
    el('anchor-actor').onchange=e=>edit(g=>{const a=d.actors.find(a=>a.id===e.target.value);Object.assign(g.anchors[anchorName],{actor:a.id,joint:d.packs[a.pack].joints[0].id});});
    el('anchor-joint').onchange=e=>edit(g=>{g.anchors[anchorName].joint=e.target.value;});
   }else if(!point)el('anchor-node').onchange=e=>edit(g=>{g.anchors[anchorName][anchor.type]=e.target.value;});
   return;
  }
  if(!actor){el('fields').innerHTML='<p class="note">Add a character to author game capabilities.</p>';return;}
  const clips=Object.keys(pack.clips),actions=binding.actions??{},reactions=binding.reactions??{},reaction=reactions[reactionName],emotions=pack.inputs?.emotion?.options??[],locomotion=binding.locomotion;
  el('fields').innerHTML=`${select('actor','Character',d.actors.map(a=>[a.id,a.name]),actorId)}<label class="face-auto"><input id="game-speech" type="checkbox" ${binding.speech?'checked':''}>Speech hook enabled</label>${select('gaze','Look joint',[['','No gaze'],...pack.joints.map(j=>j.id)],binding.gaze?.joint??'')}${binding.gaze?field('gaze-angle','Maximum gaze angle',binding.gaze.maxAngle??30,'type="number" min="0" max="180"'):''}<fieldset><legend>Movement</legend>${select('locomotion','Locomotion',[['','Default / automatic'],['ground-x','Ground X'],['planar','Walk across scene'],['float','Float through scene']],locomotion?.mode??'')}${locomotion?`<div class="two-col">${field('speed','Speed',locomotion.speed??120,'type="number" min="1" max="1000"')}${field('clearance','Clearance',locomotion.clearance??20,'type="number" min="0" max="500"')}${field('cellSize','Navigation cell size',locomotion.cellSize??32,'type="number" min="8" max="4096"')}</div>${select('movement-clip','Movement clip',[...(locomotion.mode==='planar'?[]:[['','Automatic']]),...clips],locomotion.clip??'')}<p class="note">Clearance is the navigation radius in scene units. Walking across the scene needs an authored movement clip; it does not add foot IK. Floating uses scene X and Y.</p>`:''}</fieldset><fieldset><legend>Action aliases</legend>${select('alias','Alias',Object.keys(actions),aliasName)}<button id="game-alias-add" class="text-button">Add alias</button>${aliasName?`${field('alias-name','Action name',aliasName,'maxlength="80"')}${select('alias-clip','Animation clip',clips,actions[aliasName])}<button id="game-alias-remove" class="text-button">Remove alias</button>`:''}</fieldset><fieldset><legend>Semantic reactions</legend>${select('reaction','Reaction',Object.keys(reactions),reactionName)}<button id="game-reaction-add" class="text-button">Add reaction</button>${reaction?`${field('reaction-name','Reaction name',reactionName,'maxlength="80"')}${select('reaction-action','Action',[['','No action'],...[...new Set([...clips,...Object.keys(actions)])]],reaction.action??'')}${select('reaction-emotion','Emotion',[['','No emotion'],...emotions],reaction.emotion??'')}<button id="game-reaction-remove" class="text-button">Remove reaction</button>`:''}</fieldset><p class="note">Clip names remain callable without aliases. Your game owns dialogue, quests and rewards; these bindings describe available character performances.</p>`;
  el('actor').onchange=e=>{actorId=e.target.value;render(target);};
  el('speech').onchange=e=>updateActor(b=>{b.speech=e.target.checked;});
  el('gaze').onchange=e=>updateActor(b=>{if(e.target.value)b.gaze={joint:e.target.value,maxAngle:b.gaze?.maxAngle??30};else delete b.gaze;});
  if(binding.gaze)el('gaze-angle').onchange=e=>updateActor(b=>{b.gaze.maxAngle=e.target.value===''?NaN:Number(e.target.value);});
  el('locomotion').onchange=e=>updateActor(b=>{if(e.target.value){b.locomotion={...b.locomotion,mode:e.target.value,speed:b.locomotion?.speed??120,clearance:b.locomotion?.clearance??20,cellSize:b.locomotion?.cellSize??32};if(e.target.value==='planar'&&!b.locomotion.clip)b.locomotion.clip=clips.find(c=>/walk/i.test(c))??clips[0];}else delete b.locomotion;});
  if(locomotion){for(const key of ['speed','clearance','cellSize'])el(key).onchange=e=>updateActor(b=>{b.locomotion[key]=e.target.value===''?NaN:Number(e.target.value);});el('movement-clip').onchange=e=>updateActor(b=>{if(e.target.value)b.locomotion.clip=e.target.value;else delete b.locomotion.clip;});}
  el('alias').onchange=e=>{aliasName=e.target.value;render(target);};
  el('alias-add').onclick=()=>updateActor(b=>{b.actions??={};aliasName=freshName({...Object.fromEntries(clips.map(c=>[c,c])),...b.actions},'action');b.actions[aliasName]=clips[0];});
  if(aliasName){
   el('alias-name').onchange=e=>updateActor(b=>{const previous=aliasName;rename(b.actions,previous,e.target.value);for(const r of Object.values(b.reactions??{}))if(r.action===previous)r.action=e.target.value;aliasName=e.target.value;});
   el('alias-clip').onchange=e=>updateActor(b=>{b.actions[aliasName]=e.target.value;});
   el('alias-remove').onclick=()=>updateActor(b=>{if(!clips.includes(aliasName)&&Object.values(b.reactions??{}).some(r=>r.action===aliasName))throw new Error('Choose another action for reactions using this alias before removing it.');delete b.actions[aliasName];});
  }
  el('reaction').onchange=e=>{reactionName=e.target.value;render(target);};
  el('reaction-add').onclick=()=>updateActor(b=>{b.reactions??={};reactionName=freshName(b.reactions,'reaction');b.reactions[reactionName]={action:clips[0]};});
  if(reaction){el('reaction-name').onchange=e=>updateActor(b=>{rename(b.reactions,reactionName,e.target.value);reactionName=e.target.value;});for(const key of ['action','emotion'])el('reaction-'+key).onchange=e=>updateActor(b=>{if(e.target.value)b.reactions[reactionName][key]=e.target.value;else delete b.reactions[reactionName][key];});el('reaction-remove').onclick=()=>updateActor(b=>{delete b.reactions[reactionName];});}
 }
 return {render};
}
