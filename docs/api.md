# Posecraft 0.1 API

The new scene API supplements the original skeletal API in `posecraft`. Existing imports remain compatible. All new browser-independent modules can run in Node. React is an optional peer; the SVG and scene imports do not import React, Studio, or optional solvers.

## Portable scene

`examples/characters/{ona,wwwzard,rusty,dummy}.json` are complete importable scenes. The original `examples/ona.posecraft.json` retains its boolean `greeting` input for compatibility. `src/schema.d.ts` defines the public types. `validateDocument(unknown)` returns errors with field paths. `assertDocument` throws with the same diagnostics. Unsupported schema versions and required capabilities fail explicitly. No migration is needed for this first version.

A scene contains an ID, name, revision, bounds, embedded reusable packs, and independent actors. An actor has an ID, pack ID, name, transform, appearance overrides, and optional persisted input values. Pack edits affect every instance of that pack; appearance and placement edits affect one actor. Duplicate a pack under a new ID to give an actor independent authored animation. No external asset fetches or account are required.

Each pack has parent-first joints, ordered path parts bound to joints, typed inputs, clips, states, an initial state, and optional spring settings. Parts contain path geometry and allowlisted numeric transforms. Importing arbitrary SVG, images, masks, gradients, text, mesh deformation, attachments, and nested scene instances is deferred. Unrecognized extension metadata is retained but never executed.

Angles use degrees. Positive X goes right and positive Y goes down. Joint translations and art use SVG units; time uses seconds. Scale-to-fit uses the viewBox and preserves aspect ratio. Container resizing changes presentation only, not world dimensions, gravity, or authored transforms. The current inertial response is intentionally tuned in CSS pixels, independent of device pixel ratio.

### Library inputs and appearance

All four packs accept string `action` and `emotion` inputs. Read their allowed values from `pack.inputs`; Ona has 13 actions, wwwzard 10, seated Rusty eight, and the original Dummy six. Dummy has 15 articulated joints including elbows, wrists, knees, and ankles. Expressions are neutral, happy, excited, sad, angry, surprised, sleepy, curious, scared, hurt, dizzy, focused, relieved, and wink. Ona also accepts `hair`: none, short, swept, bob, curls, or ponytail. These values can be persisted in `actor.inputs` or changed through `setInput`.

`actor.appearance` maps color channels to hex colors. `pack.appearanceDefaults` lists the library defaults. Parts can declare `variantInput` and a `variants` map containing allowlisted `d`, numeric `transform`, and boolean `visible` fields. `showWhen` supports input-based visibility. `pack.expressions` maps emotion names to additive joint-channel offsets; final rotation constraints still apply. These features require `appearance-variants` and `expressions` capabilities.

## Editing

```js
import { DocumentStore } from 'posecraft/commands';
const store = new DocumentStore(scene);
store.transact([
  {op: 'set', path: ['actors', 0, 'appearance', 'clothing'], value: '#bddae5'}
], scene.revision);
store.undo();
store.redo();
```

Transactions apply to a cloned document and commit only if all commands and the resulting scene validate. Every commit, undo, and redo advances revision. The history holds 60 authored versions. Persistent documents contain no runtime or DOM state.

## Runtime and SVG

```js
import { SceneController } from 'posecraft/scene';
import { renderSVG } from 'posecraft/svg';
const player = new SceneController(scene);
player.setInput('ona', 'action', 'wave');
player.setAcceleration(1200, 0);
const frame = player.step(1 / 60);
const svg = renderSVG(scene, frame);
```

Clips contain strictly increasing keys `[seconds, value, easing?]`. Easing is `smooth`, `linear`, or `step`. Rotation keys obey joint limits. Supported channels are joint rotation and X/Y offsets. States select a clip and transition on a typed input equality condition. The first matching transition wins. Transitions start from the displayed blended pose, last 0..2 seconds, and emit an event through `subscribe`. Triggers, timed transitions, and editing arbitrary graphs remain future work.

The existing skeletal engine samples clips and transitions. A bounded damped spring then adds to the designated joint's rotation and X/Y offsets, followed by joint limits and final forward kinematics. Animation owns the base pose and the spring owns this additive offset. That spring remains the Animated mode. Physical modes use articulated Planck bodies, limited joints, contacts, and bounded motor assistance. See [reactions and sound](reactions.md) for profiles, behavior modes, interaction events, diagnostics, and supported limits.

`step` uses fixed 1/120-second substeps and accepts at most 0.1 seconds per call. Excess elapsed time is dropped. `sampleHost({x,y,time,teleport})` smooths measured velocity over 60 ms before deriving acceleration from translation samples, ignores the first two derivative samples, clamps acceleration to ±6000 px/s², and rebaselines gaps over 0.1 seconds or jumps over 300px. Constant velocity produces no force. Use explicit `teleport` for discontinuities; pass `setAcceleration` for deterministic authored tests.

Input and acceleration history is retained for the first 60 seconds, up to 20,000 events. `seek(0..60)` resets and replays that history using fixed steps, without emitting duplicate application events. Editing input after seeking discards future recorded events. Replay is deterministic within the same JS runtime; cross-device bitwise identity is not promised. The current simulation has no stochastic operations, so scenario seed is fixed at zero. Reset creates initial playback state and clears history. It does not reapply React input props until they change.

`previewClip(actorId, clipId, time, overrides?)` freezes an authored clip at a chosen time while the spring continues stepping. Overrides are finite joint channels; final joint limits apply. `clearPreview(actorId)` returns that actor to its state machine. These transient editor previews are not serialized or recorded in replay history. `animationPlaying = false` holds the state-machine animation clock while allowing spring simulation; `pause()` stops both. Replay assumes the animation clock is running.

`renderSVG` and `mountSVG` accept `bones`, `limits`, `selectedActor`, and `selectedJoint` options for picking overlays and local-angle limit arcs. Studio clamps all rotation keys when tightening a joint limit; SDK callers must include any necessary key edits in the same transaction.

## Browser and React

```jsx
import { Posecraft } from 'posecraft/react';
<Posecraft scene={scene} inputs={{ona: {action: 'wave', emotion: 'happy'}}}
  hostRef={modalRef} label="Ona waves hello"
  onEvent={event => console.log(event)} />
```

Browser and React players now default to a dedicated simulation worker. Their controller uses asynchronous commands and cached frames; use `execution: "main"` for the synchronous adapter. The Node `SceneController` is unchanged. Read [performance and routing](performance.md) for queue limits, lifecycle, failure handling, and cancellable paths.

Give the wrapper a nonzero width and height. React renders the wrapper; the runtime updates SVG attributes without React frame renders. Its ref exposes play, pause, reset, seek, and controller. Use immutable scene objects; changing the scene reference replaces the runtime. Input changes preserve playback. Errors invoke `onError` and initial load failure shows a textual fallback.

`mountScene(element, scene, options)` offers the same behavior without React. `host` is the moving parent. Prefer `motion(seconds) => ({x,y,teleport})` from application animation state; otherwise the adapter reads the parent's viewport-relative bounding box. Only translation is supported. Scroll, resize, visibility changes, and resume establish a new baseline. DOM measurements cannot reliably distinguish all layout changes from intentional animation; use explicit motion for those cases. The observer never measures animated internal parts.

Scenes pause offscreen and while the document is hidden. Reduced motion is respected by default with a static authored state and no frame loop; discrete input changes still update the pose. The adapter cleans up RAF, listeners, observers, and SVG on disposal. Module imports are safe during server rendering. A described empty wrapper is the SSR placeholder.

`react-demo.html` is the separate React consumer and exercises StrictMode, dragging, resizing, state input, and unmount/remount. Ukis's tokenized modal handoff and frozen-frame transfer are not implemented; its current consumer has not been migrated.

## Agent CLI

```sh
node tools/cli.mjs capabilities
node tools/cli.mjs inspect examples/ona.posecraft.json
node tools/cli.mjs edit examples/ona.posecraft.json transaction.json changed.json
node tools/cli.mjs validate changed.json
node tools/cli.mjs preview changed.json preview.svg 0.5
node tools/cli.mjs simulate changed.json scenario.json
```

Transactions require `expectedRevision` and `commands`. A scenario contains `duration` in seconds and sorted `events`. Events support `{time,type:"input",actor,name,value}`, `{time,type:"acceleration",ax,ay}`, `{time,type:"behavior",actor,value}`, and `{time,type:"interaction",actor,interaction,strength?}`. Simulation output includes engine/schema version, revision, fixed step, evaluated transforms, spring diagnostics, and emitted events. SVG preview samples authored initial-state animation; use SDK simulation plus `renderSVG` for a scenario frame.

The repo skill is `skills/posecraft/SKILL.md`. It is available alongside the runtime and can be copied into an agent's skill directory. No paid service or model call is used for playback.

## Static props and collision boxes

A scene may include up to 32 `props`. Each prop is a visible rectangle with its own collision rectangle. Both use scene coordinates, independent of actor placement. `x` and `y` locate the visual rectangle center. `rotation` turns both rectangles in degrees. Collider `x` and `y` are offsets in the prop's local coordinates. Width and height must be 4..4096. Friction is 0..2 and bounce is 0..1.

```json
{"id":"platform","name":"Platform","x":320,"y":355,"width":220,"height":20,"rotation":-8,"fill":"#b9c8c2","collider":{"enabled":true,"width":200,"height":20,"x":0,"y":0,"friction":0.75,"bounce":0.1}}
```

Set `props` through the existing transaction API. Add `prop-colliders` to `requiredFeatures` when a scene depends on support for props. Older documents without props remain valid. Disabled colliders keep the visible prop. Animated mode does not collide; Floating, Falling ragdoll, and Protective do. Props are static during playback and are included in every character's physical world. Prop edits in Studio restart the physical preview. There are no dynamic props, prop keyframes, or inter-character collisions yet.

`renderSVG` and `mountSVG` accept `colliders: true` to show collision rectangles, and `selectedProp` to highlight one. Contact diagnostics and impacts include `surface`, either a prop ID or `bounds`. `predictedSurface` identifies the anticipated collision. Contact normals point from the support into the character, so negative Y indicates support from below.

## Episodes and camera

`posecraft/episode` provides the separate versioned episode document, `EpisodeController`, absolute frame sampling, and seeded motion baking. It embeds compatible scene documents; existing scene imports keep their meaning. Episode frames supply camera and actor placement transforms to the SVG renderer. See [Director](director.md) for the schema, CLI commands, reference workflow, worker behavior, and production limits.

For webcam acting and saved animation takes, see [capture](capture.md) and `posecraft/performance`. `ShotActor.expressions` stores held `[shotSeconds, emotion]` keys. Director's vision worker and camera controls are opt-in and separate from the embeddable scene runtime.
