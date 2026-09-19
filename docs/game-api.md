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
await scene.object('shop-light').set('enabled', true);
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

Bindings travel with downloaded and reopened scene JSON. In Studio, open Scene → Game bindings to edit aliases, reactions, gaze, speech, locomotion and anchors. Edits are validated and undoable. Semantic scenes export with the full player so these APIs remain available outside Studio.

## Completion and cancellation

`do()` performs one cycle, including clips authored as loops. It resolves on simulation completion, not on a wall-clock delay. Completed actions and moves blend back to the underlying animation over 0.2 simulation seconds while retaining the ground position. `moveTo()` resolves only after arrival. Paused or offscreen scenes retain pending commands until simulation resumes. Reduced-motion scenes apply a static final pose and complete without waiting for animation frames.

The default locomotion capability is `ground-x`: the actor walks to the target's horizontal coordinate on the supported floor. Bind `locomotion: {mode: 'float', speed: 90, clearance: 18, cellSize: 20}` for movement to both scene coordinates. `planar` uses the same navigation and requires a `clip` containing an authored walk cycle. Speed is scene units per second; clearance is an authored navigation radius, independent of the artwork size. The root joint reaches the named anchor. Root yaw follows travel direction when the pack supports spatial channels. This does not create a missing turnaround asset or solve foot contacts.

Floating and planar navigation use bounded A* around visible prop colliders and enabled static shared objects, with acceleration and braking along a conservative route. Unreachable endpoints fail, and a newly blocked route stops with an error. Moving objects and other actors are not crowd-avoidance obstacles. Automatic replanning is not provided. `lookAt()` uses the declared gaze joint and angle limits; it does not provide eye tracking.

Actors have independent motion, gaze and speech channels. Walking and actions share motion; a replacement on the same channel cancels its predecessor with `AbortError`. Looking and speaking can run alongside walking. `priority` is 0..100, default 0. A lower-priority request rejects without interrupting an active higher-priority request on that channel. Priority lasts until completion. Different actors also run in parallel:

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

`scene.object(id)` and its `prop(id)` alias address shared runtime objects, not decorative props. `set('enabled', boolean)`, `place(target)`, `attach(actor, joint, {maxDistance, offsetX, offsetY})` and `release({actor, vx, vy})` return promises acknowledged after the simulation applies them. Failed reach/ownership checks reject instead of reporting success. Static objects support only enable/disable. Attaching a prop does not animate an arm reaching for it. Arbitrary named properties such as `open` still need host logic or a behavior graph.

## Saved state and sleeping actors

```js
const saved = await scene.snapshot();
// Store this JSON alongside, but separately from, the host game's quest state.
await scene.restore(JSON.parse(JSON.stringify(saved)));
await scene.actor('friend').sleep();
await scene.actor('friend').wake();
```

Snapshots have a version and scene signature. They retain inputs, animation state, navigated root positions, behavior state/variables/random seeds/delay clocks, object transforms/ownership and sleeping flags. Restore validates the whole snapshot before mutation. A changed scene definition requires an explicit migration; v1 refuses an incompatible save. Runtime promises, queued events, interrupted activities, physics velocities and host rewards are not restored. State-entry effects do not replay. Restore cancels pending commands and speech; await it before issuing new commands.

Semantic saves support animated game scenes. Specialized ensembles, fluid scenes, prop games, active ragdolls and previews reject capture explicitly. Existing movie/replay checkpoints remain a separate feature.

Sleep freezes an actor's evaluated pose, animation and scoped behavior clock. Wake resumes without catching up missed time, and a new public action, movement, gaze or speech command wakes its actor. Global scene behaviors and rendering still have costs. Sleep rejects unsupported physical or specialized scenes, active scene activities and actors carrying objects. It is explicit scheduling, not automatic distance culling or a claim of zero-cost rendering. Sleep/wake is acknowledged on workers.

## Agent discovery

```sh
npx posecraft describe corner-shop.posecraft.json
```

Or use `scene.describe()`, `actor.capabilities()` or `describeGameScene(document)` from `posecraft/game-bindings`. The manifest reports action aliases, reactions, declared speech/gaze support, locomotion, targets, object properties and available event names. A speech binding also requires a host speech handler. Unsupported capabilities are not inferred from a character's appearance.

Public completion events include `actor.action.completed`, `actor.arrived`, `actor.look.completed`, `actor.reaction.completed` and `actor.speech.completed`. Cancellation and failure events include the actor and request ID. The lower-level controller also emits `actor.command.completed` and `actor.command.failed` acknowledgements.

## Release scope

Use a tested Git commit or local package for the game integration. This repository remains private to npm publication and is not a registry release.

The illustrated SDK candidate includes commands, navigation, semantic saves, sleep/wake and Studio bindings. Per-actor quality tiers, crowd avoidance, richer object-property mappings, a general procedural idle authoring tool and native 3D parity remain separate work. Run `npm run test:consumer` to test the installed tarball outside this repository. See [Littlelands integration](littlelands-integration.md) for packaging and the release acceptance scene. Real-phone performance and art/motion review remain required before calling this production-ready.
