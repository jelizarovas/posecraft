# Reactions, physical modes, and sound

Open **Feel** in Studio, or use the controls above the card in the React playground. Sound starts only after pressing **Sound off** to enable it. Poke, pet, startle, drop, toss, hurt, and catch buttons exercise the same public interaction API used by consumers.

## Body modes

| Mode | Behavior |
| --- | --- |
| Animated | Authored clips with the original container spring. Returns to the authored pose and clears the physical simulation when selected. |
| Floating ragdoll | Articulated dynamic bodies, no gravity, passive joints, momentum, and container collisions. |
| Falling ragdoll | Gravity and passive joints. It can fall, tumble, and come to rest. |
| Protective | Bounded joint motors follow authored targets and use protective poses before predicted impact. Bounded upright torque assists recovery. |

Changes between the three physical modes preserve body positions and velocities. Resistance controls motor torque in Protective and contributes to passive damping. Zero resistance disables the motors. Gravity is a 0..2 multiplier outside Floating. Bounce is restitution, 0..1. These controls do not change mass or artwork.

The protective strategy can be automatic, cover head, curl/hold self, or break fall. A projected floor or wall contact within 0.38 seconds selects a protective target. Automatic selection uses body tilt to choose head protection or bracing. Responses respect each pack's joint limits and available limbs. Curling and self-holding are authored poses; there is no hand-to-body attachment constraint.

Actual contact arrival speed triggers impact and hurt responses. Sustained support forces do not count as repeated impacts. Hurt is followed by a recovery response; sufficiently stable floor support and a near-upright body return to calm. Recovery uses bounded assistance, so a difficult position may finish resting instead of standing. This is not a complete gait, balance, or foot-placement controller.

## Faces and events

All four packs have 14 selectable expressions: neutral, happy, excited, sad, angry, surprised, sleepy, curious, scared, hurt, dizzy, focused, relieved, and wink. Facial variants alter eye and mouth geometry; hurt adds red cheek marks. Ona also has separate brows. Choosing an expression in the UI disables automatic face changes for that actor until **Automatic facial responses** is enabled again.

Response states include calm, startled, scared, falling, bracing, protecting, curling, hurt, recovering, resting, floating, happy, and relieved. They are separate from the action state machine. The evaluated frame exposes `actor.response` and the effective `actor.inputs.emotion`. Input defaults are retained while a transient response chooses a face.

```js
import { SceneController } from 'posecraft/scene';
const player = new SceneController(scene);
player.setBehavior('ona', {
  mode: 'protective', resistance: 0.65,
  gravity: 1, bounce: 0.15, strategy: 'protect', autoFace: true
});
player.subscribe(event => console.log(event));
player.interact('ona', 'drop');
const frame = player.step(1 / 60);
console.log(frame.actors[0].response, frame.actors[0].physics);
```

Persist settings in `actor.behavior`. `setBehavior` applies transient settings and records them for replay. `interact(actor, type, strength = 1)` accepts tap, pet, startle, drop, toss, hurt, or catch, with strength 0..2. Drop lifts the physical rig within available space and releases it downward. Toss adds velocity and spin. Catch stops it and suspends gravity for one second. Studio and the playground select a physical mode when Drop or Toss is used from Animated; SDK callers select the desired mode explicitly.

Events include `{type:'response', actor, from, to, strength, time}`, `{type:'impact', actor, part, speed, strength, time}`, and `{type:'interaction', actor, interaction, strength, time}`. `error` reports unsupported geometry, such as a physical rig that cannot fit in its container. Replay includes behavior and interaction events and suppresses duplicate application events while seeking.

```jsx
<Posecraft ref={playerRef} scene={scene}
  behavior={{ona: {mode: 'protective', resistance: 0.8, autoFace: true}}}
  onEvent={handleEvent} />
// From an application interaction:
playerRef.current.interact('ona', 'pet');
```

## Sound

`posecraft/audio` is a separate browser audio adapter. It synthesizes short effects locally with Web Audio. It needs no recordings, downloads, accounts, microphone access, or paid audio service. The `SoundEffects` module can be imported during SSR and creates an AudioContext only on `unlock()` from a user gesture. See the [Web Audio startup contract](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume).

```js
import { SoundEffects } from 'posecraft/audio';
const sounds = new SoundEffects({volume: 0.25});
const unsubscribe = player.subscribe(event => sounds.handle(event));
enableSoundButton.onclick = () => sounds.unlock();
muteButton.onclick = () => sounds.mute();
// During cleanup:
unsubscribe();
sounds.dispose();
```

Effects cover interactions, action changes, protection, hurt, impacts, and relief. Voices are capped at six with a 90 ms interval to avoid a burst of overlapping sounds. Quiet/resting state changes are silent. `setVolume(0..1)`, `mute()`, and `dispose()` control playback. Muting cancels active voices. A host can use the same events with its own audio assets instead.

## Collision model and limits

The scene runtime uses MIT-licensed [Planck](https://piqnt.com/planck.js/docs/), pinned to 1.4.2 for Node 22 compatibility. Packs declare rectangular collision proxies, densities, physical parent relationships, and protective target poses. Artwork remains separate from collision geometry. Each character has its own rectangular-container world containing the scene's enabled static prop boxes. Rotated props participate in prediction, impacts, and support detection. There are no inter-character or self-collisions, grips, or moving support attachments in this slice.

World units are 50 scene pixels per meter. Simulation uses the scene's 120 Hz clock with two 240 Hz contact steps, or four 480 Hz steps for rigs with more than ten physical bodies. Each step uses 20 velocity and 20 position iterations. Physical container acceleration is clamped to 2000 px/s² per axis. Linear and angular velocity are bounded at 600 px/s and 12 radians/s. Discrete contacts with these bounds avoid per-body continuous collision corrections separating an articulated chain. Joint limits have normal solver tolerance; stress tests allow up to four degrees of transient error and verify anchor separation. Root rotation is a free world rotation, not an angle relative to a parent joint.

`frame.actors[i].physics` exposes current response, predicted impact time, contact points/normals/parts, center, velocity, muscle strength, and current impact. Studio's Feel view shows orange contact points, a blue center marker, and a velocity line. `renderSVG` and `mountSVG` accept `physicsDebug: true` to display them. Oversized collision profiles are rejected on explicit mode entry; a loaded scene that cannot simulate reports an error and retains an authored fallback.

Reduced motion holds physical transforms, disables integration, and permits discrete face changes. Hidden/offscreen browser scenes suspend as before. Physical profile changes or replacing a scene object rebuild the simulation. Changing physical modes through `setBehavior` preserves the existing world.

Existing local Studio library drafts are upgraded once, preserving edited clips, geometry, joint limits, and per-instance colors. The prior draft is retained in `posecraft.studio.v2.before-responses`. Imported custom packs are not automatically rewritten.

## Agent scenarios

CLI simulation accepts behavior and interaction events alongside input and acceleration events:

```json
{"duration":2,"events":[
  {"time":0,"type":"behavior","actor":"ona","value":{"mode":"protective","strategy":"protect"}},
  {"time":0,"type":"interaction","actor":"ona","interaction":"drop"}
]}
```

Run `node tools/cli.mjs simulate examples/characters/ona.json scenario.json`. Output includes contact diagnostics and emitted response/impact events. Tightening joint limits requires clamping both animation keys and `physics.responses` targets in the same transaction; Studio does this automatically.

Prop prediction sweeps oriented body boxes along their current linear velocities over 0.38 seconds. It holds orientation constant for that prediction window. Actual contacts come from the solver, including rotational motion. Props must be placed clear of the character at its starting pose to avoid an initial overlap.

## Assisted get-up and walking

`actor.behavior.autoRecover: true` enables assisted recovery in Falling ragdoll and Protective modes. It defaults to false so raw physics scenes retain their behavior. In Studio, use **Feel → Stand up & return**. The shake demo enables it from the start; Drop and Toss in the drop lab enable it too. Floating remains passive.

After floor contact and a quiet interval, the controller captures the visible physical pose, blends upright over 1.25 seconds, then walks toward the original actor placement at 75 scene pixels per second. A new toss or significant container acceleration interrupts assistance and starts physics at the current visible pose. The actor's authored placement is its home mark. A loaded auto-recovery scene starts standing on its support. Recovery root rotation is free, as it is in physics; limb limits remain constrained.

`SceneController`, `WorkerSceneController` and browser players expose `walkTo(actorId, sceneX)`. Commands while falling/getting up are ignored. Supported straight routes animate the walk clip or a limited fallback gait. Blocked routes stop at the current standing position with `frame.actors[i].recovery.blocked === true`. Recovery diagnostics contain `phase` and a target position. Phases are `getting-up`, `returning`, `walking`, `home`, and `blocked`.

This is authored assistance, not physically balanced walking. It checks approximate body bounds against static props and support along a straight route. It does not use the separate A* route API, walk around obstacles, climb stairs or plant feet. Prefer a broad flat floor for this first version. Avatar collisions remain independent. The scene worker runs both physics and assistance; sensor events only supply coalesced force samples.

`posecraft/device-motion` exports `PhoneMotion` and the pure `MotionSignal` filter. Call `phone.enable()` directly inside a button handler, feed `phone.signal.sample(performance.now()).ax/ay` to the scene controller's `setAcceleration`, and call `disable()` on pause/hide/disposal. Do not also call `sampleHost` in that loop, since it would replace the force. Permission and readings remain local. The filter removes gravity when only gravity-inclusive samples are available, accounts for screen orientation, bounds forces and fades stale samples.
