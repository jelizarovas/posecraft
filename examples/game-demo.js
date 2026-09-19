import {mountScene} from '../src/browser.js';
import {createGameExample} from './game-scene.js';
import './game-demo.css';
const $=id=>document.getElementById(id),scene=createGameExample();let player,sequence,busy=false,session=0;
const captions={'actor.arrived':'Reached the shop','actor.look.completed':'Noticed the sign','actor.action.completed':'Action finished','actor.reaction.completed':'Reaction finished','actor.command.cancelled':'Action cancelled'};
function event(e){if(!captions[e.type])return;const item=document.createElement('li');item.textContent=captions[e.type];$('events').prepend(item);while($('events').children.length>6)$('events').lastChild.remove();}
function speech({actor,text,signal}){
 $('speech').textContent=`${actor==='friend'?'Rusty':'Ona'}: ${text}`;$('continue').hidden=false;
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{$('continue').hidden=true;$('continue').removeEventListener('click',done);signal.removeEventListener('abort',cancel);};
  const done=()=>{cleanup();resolve();},cancel=()=>{cleanup();reject(Object.assign(new Error('Dialogue cancelled.'),{name:'AbortError'}));};
  $('continue').addEventListener('click',done);signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
 });
}
function mount(){player?.dispose();player=mountScene($('scene'),scene,{execution:'worker',reducedMotion:$('reduced').checked,onSpeechRequest:speech,onEvent:event,onError:fail});window.gameDemo={player,scene};}
function setBusy(value){busy=value;$('repair').disabled=value;$('encourage').disabled=value;$('cancel').disabled=!value;}
function fail(error){$('quest').textContent=error.message;setBusy(false);}
$('repair').onclick=async()=>{
 const current=++session;setBusy(true);$('sign').textContent='CORNER SHOP';$('quest').textContent='Sign repaired. Let’s show Ona.';
 sequence=player.sequence([{actor:'shopkeeper',do:'notice'},{actor:'shopkeeper',lookAt:'shop.sign'},{actor:'shopkeeper',moveTo:'shop.front'},{actor:'shopkeeper',do:'inspect'},{actor:'shopkeeper',react:'success'},{actor:'shopkeeper',say:'You fixed it! The shop is ready to open.'}]);
 try{await sequence.finished;if(current!==session)return;player.object('shop-light').set('enabled',true);await player.actor('friend').react('success');if(current===session){$('quest').textContent='The shop is open.';$('speech').textContent='Quest complete. Little Lands can award the reward here.';}}
 catch(error){if(current===session)$('quest').textContent=error.name==='AbortError'?'Stopped. The repaired sign belongs to the game.':error.message;}
 finally{if(current===session)setBusy(false);}
};
$('encourage').onclick=async()=>{const current=++session;setBusy(true);try{await Promise.all([player.actor('shopkeeper').react('encourage'),player.actor('friend').react('encourage')]);}catch(error){if(current===session)$('quest').textContent=error.message;}finally{if(current===session)setBusy(false);}};
$('cancel').onclick=()=>{session++;sequence?.cancel();player.actor('shopkeeper').cancel();player.actor('friend').cancel();setBusy(false);$('quest').textContent='Stopped. Ready for another cue.';$('speech').textContent='Choose an interaction to direct the scene.';};
function reset(){session++;sequence?.cancel();mount();setBusy(false);$('sign').textContent='CORNER SH—P';$('quest').textContent='The shop sign needs a little help.';$('speech').textContent='Choose an interaction to direct the scene.';$('events').replaceChildren();}
$('reset').onclick=reset;$('reduced').onchange=reset;
$('manifest-toggle').onclick=()=>{const hidden=!$('manifest').hidden;$('manifest').hidden=hidden;$('manifest-toggle').setAttribute('aria-expanded',String(!hidden));if(!hidden)$('manifest').textContent=JSON.stringify(player.describe(),null,2);};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(scene,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='corner-shop.posecraft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('pagehide',()=>player?.dispose());mount();
