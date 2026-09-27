import {addContactWindow} from './wwwzard-contact-window.js';
import {addWwwzardNightLighting} from './wwwzard-night.js';
import {addWwwzardPlantGusts} from './wwwzard-plant.js';
import { createWwzardIllustration } from './wwzard-illustration.js';
import { addContactMotion } from './wwwzard-contact-motion.js';
import {addContactAttention} from './wwwzard-contact-attention.js';
import {addWwwzardWindowTheme} from './wwwzard-window.js';
import {addContactKeyboard} from './wwwzard-contact-keyboard.js';
import {addWwwzardHostTransition} from './wwwzard-host-transition.js';

const perform = activity => ({ type: 'perform', activity });
const set = (variable, value) => ({ type: 'set', variable, value });
const when = (variable, value) => ({ variable, op: 'eq', value });
const edge = (id, from, to, event, condition) => ({
  id, from, to, event, weight: 1, ...(condition ? { when: condition } : {}),
});
const after = (id, from, to, seconds, condition) => ({
  id, from, to, after: { min: seconds, max: seconds }, weight: 1,
  ...(condition ? { when: condition } : {}),
});
const activity = (actor, name, options = {}) => ({
  actor, variants: [{ id: name, clip: name, weight: 1, speed: { min: 1, max: 1 } }],
  transition: { duration: .2, interrupt: true, ...options },
  success: { base: 1, modifiers: [] }, onStart: [], onSuccess: [], onFailure: [],
});

/** Portable contact illustration. Host dispatches event names, never form text. */
export function createWwwzardContactScene() {
  const scene = createWwzardIllustration();
  scene.id = 'wwwzard-contact';
  scene.name = 'Wwwzard, contact desk';
  // Keep the shared room artwork and original coordinates with the character.
  // Website layouts size the complete scene instead of drawing replacement props.
  scene.requiredFeatures = [...new Set([
    ...scene.requiredFeatures, 'behavior-graphs', 'pointer-interactions',
  ])];
  scene.lighting = { enabled: false };
  addContactMotion(scene);
  const hero = scene.packs.wwzard;
  hero.inputs = { action: { type: 'string', default: 'ready', options: Object.keys(hero.clips) } };
  scene.actors.find(actor => actor.id === 'wwzard').inputs = { action: 'ready' };

  const states = {
    ready: { actions: [set('wakeIntent', 0), perform('ready')] },
    typing: { actions: [set('wakeIntent', 0), perform('typing')] },
    resumedTyping: { actions: [set('wakeIntent', 0), perform('typing')] },
    preparing: { actions: [set('wakeIntent', 0), perform('prepareWindy'), perform('planePrepare'), perform('windowOpen'), perform('windowGust')] },
    retrying: { actions: [set('prepared', true), set('outcome', 0), perform('prepare'), perform('planePrepare')] },
    prepared: { actions: [perform('prepared'), perform('planeHold')] },
    preparingSend: { actions: [set('wakeIntent', 0), perform('prepareWindy'), perform('planePrepare'), perform('windowOpen'), perform('windowGust')] },
    sending: { actions: [perform('sending'), perform('planeThrow')] },
    waiting: { actions: [] },
    acknowledged: { actions: [perform('sent'), perform('planeHide'), perform('windowClose')] },
    closing: { actions: [perform('close'), perform('screenClose')] },
    settlingToNap: { actions: [perform('nap-entry'), perform('screenNap')] },
    nap: { actions: [perform('nap'), perform('screenNap')] },
    opening: { actions: [perform('open'), perform('screenOpen')] },
    error: { actions: [set('prepared', false), perform('error'), perform('planeHide')] },
    visitor: { actions: [perform('visitor')] },
  };
  const edges = [];
  const add = (from, to, event, condition) =>
    edges.push(edge(from + '-' + event + '-' + to, from, to, event, condition));
  const delay = (from, to, seconds, condition) =>
    edges.push(after(from + '-after-' + to, from, to, seconds, condition));
  for (const from of ['ready', 'typing', 'visitor']) {
    if (from !== 'ready') add(from, 'ready', 'ready');
    if (from !== 'typing') add(from, 'typing', 'typing');
    add(from, 'preparing', 'almost-done');
  }
  // Input and idle signals do not hide a prepared paper plane.
  delay('preparing', 'prepared', 1.5);
  delay('retrying', 'prepared', 1.5);
  add('retrying', 'preparingSend', 'sending');
  delay('prepared', 'prepared', 3.2);
  delay('ready', 'ready', 4.4);
  delay('typing', 'typing', hero.clips.typing.duration);
  delay('resumedTyping', 'ready', hero.clips.typing.duration);
  add('resumedTyping', 'typing', 'typing');
  add('resumedTyping', 'ready', 'ready');
  add('resumedTyping', 'preparing', 'almost-done');
  add('resumedTyping', 'preparingSend', 'sending');
  add('resumedTyping', 'visitor', 'visitor');
  for (const from of ['ready', 'typing', 'visitor']) {
    add(from, 'preparingSend', 'sending');
    if (from !== 'visitor') add(from, 'visitor', 'visitor');
  }
  for (const from of ['prepared']) {
    add(from, 'sending', 'sending');
  }
  add('preparing', 'preparingSend', 'sending');
  delay('preparingSend', 'sending', 1.5);
  delay('visitor', 'prepared', hero.clips.visitor.duration, when('prepared', true));
  delay('visitor', 'ready', hero.clips.visitor.duration, when('prepared', false));
  delay('sending', 'acknowledged', 1.4, when('outcome', 1));
  // A failed response still lets the released plane clear the window.
  delay('sending', 'retrying', 1.4, when('outcome', 2));
  delay('sending', 'waiting', 1.4, when('outcome', 0));
  add('waiting', 'acknowledged', 'sent');
  add('waiting', 'retrying', 'error');
  delay('acknowledged', 'closing', hero.clips.sent.duration);
  delay('closing', 'settlingToNap', hero.clips.close.duration);
  delay('settlingToNap', 'nap', hero.clips['nap-entry'].duration);
  delay('nap', 'nap', hero.clips.nap.duration);
  delay('opening', 'ready', hero.clips.open.duration, when('wakeIntent', 0));
  delay('opening', 'resumedTyping', hero.clips.open.duration, when('wakeIntent', 1));
  delay('opening', 'preparing', hero.clips.open.duration, when('wakeIntent', 2));
  delay('opening', 'preparingSend', hero.clips.open.duration, when('wakeIntent', 3));
  delay('error', 'ready', hero.clips.error.duration);
  add('error', 'typing', 'typing');
  add('error', 'ready', 'ready');
  add('error', 'preparing', 'almost-done');
  add('error', 'preparingSend', 'sending');
  for (const from of Object.keys(states)) {
    // A new composition can interrupt the thank-you or nap immediately.
    // Reopen a shut lid; otherwise return directly to the writing pose.
    add(from, ['nap','closing','settlingToNap','opening'].includes(from) ? 'opening' : 'ready', 'compose');
    if (!['error','sending','preparingSend','waiting','retrying'].includes(from)) add(from, 'error', 'error');
    if (from === 'nap' || from === 'closing' || from === 'settlingToNap') {
      add(from, 'opening', 'wake');
      add(from, 'opening', 'laptop-click');
      add(from, 'opening', 'typing');
      add(from, 'opening', 'almost-done');
      add(from, 'opening', 'sending');
    }
  }
  const activities = {};
  for (const name of ['ready', 'typing', 'prepare', 'prepared', 'sending', 'sent', 'error', 'visitor', 'nap-entry', 'nap']) {
    activities[name] = activity('wwzard', name, name === 'typing' ? { duration: .12 } : {});
  }
  for (const name of ['close', 'open']) {
    const match = { actor: 'screen', channel: 'hinge.bend' };
    activities[name] = activity('wwzard', name, { duration: .25, match });
    activities['screen' + name[0].toUpperCase() + name.slice(1)] = activity('screen', name, { duration: .25, match });
  }
  activities.prepareWindy=activity('wwzard','prepare-windy');
  activities.windowOpen=activity('window','window-open',{match:{actor:'window',channel:'windowHinge.bend'}});
  activities.windowClose=activity('window','window-close');
  activities.windowGust=activity('room','window-gust');
  activities.screenNap = activity('screen', 'nap');
  for (const name of ['prepare', 'hold', 'throw', 'hide']) {
    activities['plane' + name[0].toUpperCase() + name.slice(1)] = activity('plane', name);
  }
  scene.behaviorGraph = {
    seed: 240927, variables: { delivered: false, outcome: 0, prepared: false, wakeIntent: 0 },
    initial: 'ready', states, edges, activities,
    handlers: [
      { event: 'sent', actions: [set('delivered', true), set('outcome', 1)] },
      { event: 'typing', actions: [set('wakeIntent', 1)] },
      { event: 'almost-done', actions: [set('prepared', true), set('wakeIntent', 2)] },
      { event: 'sending', actions: [set('prepared', false), set('delivered', false), set('outcome', 0), set('wakeIntent', 3)] },
      { event: 'wake', actions: [set('wakeIntent', 0)] },
      { event: 'compose', actions: [set('wakeIntent', 0), set('prepared', false), set('delivered', false), set('outcome', 0), perform('planeHide')] },
      { event: 'laptop-click', actions: [set('wakeIntent', 0)] },
      { event: 'error', actions: [set('delivered', false), set('outcome', 2)] },
    ],
  };
  scene.presentation = 'live';
  scene.interactions = [
    { id: 'contact-visitor', actor: 'wwzard', gesture: 'click',
      response: 'event', event: 'visitor', resistance: 0 },
    { id: 'contact-laptop', actor: 'screen', gesture: 'click',
      response: 'event', event: 'laptop-click', resistance: 0 },
  ];
  addWwwzardPlantGusts(scene);
  addContactWindow(scene);
  addWwwzardWindowTheme(scene);
  addContactKeyboard(scene);
  addContactAttention(scene);
  return addWwwzardNightLighting(addWwwzardHostTransition(scene));
}
