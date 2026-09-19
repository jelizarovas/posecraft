# Directing a game scene

Little Lands owns quests, learning, rewards and saved world state. Posecraft owns the visible performance. The semantic API lets game code request actions without selecting animation tracks or joint coordinates.

This first adapter supports Posecraft's existing illustrated 2D/2.5D scene documents, in both main-thread and worker execution. The native workout has a separate [mechanism-backed adapter](workout.md) with named actions and safe completion. Try the [corner shop example](https://jelizarovas.github.io/posecraft/demos.html#corner-shop).

## Browser and React

```js
import {mountScene} from 'posecraft/browser';

const scene = mountScene(element, document, {
  onEvent: event => console.log(event),
  onSpeechRequest: ({actor, text, emotion, signal}) =>
    dialogue.show({actor, text, emotion, signal})
});

const keeper = scene.actor('shopkeeper');
await keeper.lookAt('shop.sign');
await keeper.moveTo('shop.front');
await keeper.do('inspect');
await keeper.react('success');
await keeper.say('You fixed it!');
scene.object('shop-light').set('enabled', true);
```

`onSpeechRequest` returns when the host has finished displaying or speaking the line. Posecraft does not create subtitles, request a microphone, start TTS or choose a language. Listen to its abort signal to dismiss cancelled dialogue. Declaring speech support does not create lip sync; author speaking clips separately if the character has them.

```jsx
import {useRef} from 'react';
import {PosecraftScene} from 'posecraft/react';

function Shop({document, dialogue}) {
  const scene = useRef(null);
  return <>
    <button onClick={() => scene.current.actor('shopkeeper').react('success')}>
      Celebrate
    </button>
    <div style={{width: '100%', height: 420}}>
      <PosecraftScene ref={scene} scene={document}
        onSpeechRequest={request => dialogue.show(request)} />
    </div>
  </>;
}
```

`PosecraftScene` is an alias for the existing `Posecraft` component. Existing `inputs`, `behavior`, event callbacks and playback methods still work. There is no new `actors={{state, mood}}` prop; author the mapping in the scene or use the established `inputs` prop.

For a host with its own render loop, call `createGameScene(controller, options)` from `posecraft/game`. The controller must keep stepping. The facade creates no animation timer. Dispose the facade before disposing its controller.

## Author names once

Add `game-bindings` to `requiredFeatures`, then save bindings in the scene JSON:

```json
{
  "game": {
    "anchors": {
      "shop.front": {"type": "prop", "prop": "shop", "offsetX": -185, "offsetY": 160},
      "shop.sign": {"type": "prop", "prop": "shop", "offsetY": -118},
      "player": {"type": "point", "x": 175, "y": 440}
    },
    "actors": {
      "shopkeeper": {
        "actions": {"inspect": "think", "notice": "nod"},
        "reactions": {
          "success": {"action": "celebrate", "emotion": "happy"},
          "encourage": {"action": "wave", "emotion": "happy"}
        },
        "gaze": {"joint": "head", "maxAngle": 20},
        "speech": true
      },
      "friend": {
        "reactions": {"success": {"action": "wag", "emotion": "happy"}}
      }
    }
  }
}
```

This is a fragment, not a complete scene. Clip IDs are available as action names by default; `actions` adds aliases. Every referenced actor, clip, expression and joint must exist. The same `react('success')` call can celebrate with Ona and wag with Rusty.

Targets can be fixed points, prop-local offsets, shared-object-local offsets, or actor-joint offsets. Prop rotation, attachment transforms and current object/joint positions are included. Each command resolves its target when issued. A completed look does not continuously track a moving target. Hidden, disabled or missing targets fail explicitly.

Bindings travel with downloaded and reopened scene JSON. This pass provides JSON/agent authoring and validation; a dedicated Studio bindings inspector is still to come.

## Completion and cancellation

`do()` performs one cycle, including clips authored as loops. It resolves on simulation completion, not on a wall-clock delay. Completed actions and moves blend back to the underlying animation over 0.2 simulation seconds while retaining the ground position. `moveTo()` resolves only after arrival. Paused or offscreen scenes retain pending commands until simulation resumes. Reduced-motion scenes apply a static final pose and complete without waiting for animation frames.

The current locomotion capability is `ground-x`: the actor walks to the named target's horizontal coordinate on the supported floor. It does not fly to the target's Y coordinate or route around obstacles. Blocked paths, clamped destinations and actors lacking a walking collision rig fail. `lookAt()` uses the declared gaze joint and its angle limits; it is not an eye-tracking or full-body facing solver.

One actor has one active command. A new command cancels that actor's previous command with `AbortError`. Different actors can run in parallel:

```js
await Promise.all([
  scene.actor('shopkeeper').react('success'),
  scene.actor('friend').react('success')
]);

const controller = new AbortController();
const finished = scene.actor('shopkeeper').moveTo('shop.front', {
  signal: controller.signal
});
controller.abort();
try { await finished; }
catch (error) { if (error.name !== 'AbortError') throw error; }
```

Cancellation retains the current ground position. It does not promise a physically animated stop. Reset, seek and disposal cancel pending commands. These commands are ephemeral host instructions; their pending promises are not serialized into scene files or replay checkpoints.

Recipes are plain data, suitable for agents:

```js
const sequence = scene.actor('shopkeeper').sequence([
  {do: 'notice'},
  {lookAt: 'shop.sign'},
  {moveTo: 'shop.front'},
  {do: 'inspect'},
  {react: 'success'},
  {say: 'The shop is ready to open.'}
]);

await sequence.finished;
// Elsewhere: sequence.cancel();
```

Use `scene.sequence()` with an `actor` field on every step to direct multiple actors serially. Recipes validate before starting and stop on the first failure. `actor.cancel()` cancels the current command; use the sequence handle to cancel the complete recipe. `actor.send(event, payload)` dispatches an event to that actor's existing behavior graph.

`scene.object(id)` and its `prop(id)` alias currently address shared runtime objects, not decorative props. They expose `set('enabled', boolean)`. On a worker this queues the validated setting; it is not an awaitable physics acknowledgement. Arbitrary fields such as `set('on', true)` need an authored mapping in a future extension.

## Agent discovery

```sh
npx posecraft describe corner-shop.posecraft.json
```

Or use `scene.describe()`, `actor.capabilities()` or `describeGameScene(document)` from `posecraft/game-bindings`. The manifest reports action aliases, reactions, declared speech/gaze support, locomotion, targets, object properties and available event names. A speech binding also requires a host speech handler. Unsupported capabilities are not inferred from a character's appearance.

Public completion events include `actor.action.completed`, `actor.arrived`, `actor.look.completed`, `actor.reaction.completed` and `actor.speech.completed`. Cancellation and failure events include the actor and request ID. The lower-level controller also emits `actor.command.completed` and `actor.command.failed` acknowledgements.

## Next requirements from Little Lands

Use a tested Git commit or local package for the game integration. This repository remains private to npm publication and is not a registry release.

The next consumer-driven additions are semantic save/restore, actor sleep/wake with measured costs, per-actor quality levels, floating/planar navigation, and a Studio bindings editor. Existing scene-level offscreen suspension is not actor-level sleep. Existing seeded behavior graphs remain available; this pass does not add a generic procedural-idle generator. The native workout adapter now implements its own character/action contract; general native scene commands remain separate.
