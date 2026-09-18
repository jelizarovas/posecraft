# Posecraft 0.1 API

The new scene API supplements the original skeletal API in `posecraft`. Existing imports remain compatible. All new browser-independent modules can run in Node. React is an optional peer; the SVG and scene imports do not import React, Studio, or optional solvers.

## Portable scene

`examples/characters/{ona,wwwzard,rusty,dummy}.json` are complete importable scenes. The original `examples/ona.posecraft.json` retains its boolean `greeting` input for compatibility. `src/schema.d.ts` defines the public types. `validateDocument(unknown)` returns errors with field paths. `assertDocument` throws with the same diagnostics. Unsupported schema versions and required capabilities fail explicitly. No migration is needed for this first version.

A scene contains an ID, name, revision, bounds, embedded reusable packs, and independent actors. An actor has an ID, pack ID, name, transform, appearance overrides, and optional persisted input values. Pack edits affect every instance of that pack; appearance and placement edits affect one actor. Duplicate a pack under a new ID to give an actor independent authored animation. No external asset fetches or account are required.

Each pack has parent-first joints, ordered path parts bound to joints, typed inputs, clips, states, an initial state, and optional spring settings. Parts contain path geometry and allowlisted numeric transforms. Spatial parts can also carry [weighted meshes and corrective shapes](skinned-mesh.md). Draw / Rig imports a documented subset of SVG paths and basic shapes; importing images, masks, gradients, text, attachments, or nested scene instances remains deferred. Unrecognized extension metadata is retained but never executed.

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

Transactions apply to a cloned document and commit only if all commands and the resulting scene validate. Use `{op:'delete', path:['lighting','emitter']}` to remove an existing optional object field. Array changes use `set` with a complete replacement array. Every commit, undo, and redo advances revision. The history holds 60 authored versions. Persistent documents contain no runtime or DOM state.

### Authoring helpers

`posecraft/timeline-editing` exports `editTimelineKeys(clip, selection, operation)`. Select keys with `{track, time}` and move, copy, scale, delete or change their outgoing easing. It returns a new clip and selection. Collisions, stale selections and out-of-range times reject the complete edit. Commit the returned clip through `DocumentStore`. See [timeline editing](timeline.md).

`posecraft/vector-authoring` exports `createDrawing`, `shapePath`, `importSVG`, `assignArtwork`, `movePivot` and `reparentJoint`. Pivot and parent changes preserve the resting artwork. `importSVG` needs a DOMParser, supplied by the browser or passed explicitly. It rejects unsupported SVG rather than silently dropping effects. See [Draw / Rig](draw.md).

`posecraft/project-bundle` exports asynchronous `createProjectBundle(episode, loadReference)` and `readProjectBundle(bundle)`. The reader returns `{project, assets}`, where assets maps reference IDs to image Blobs. Bundles include referenced PNG, JPEG or WebP images and verify their checksums and size limits. Browser callers can supply `validateImage` to check decoding before importing. These helpers do not write browser storage. See [portable project files](project-files.md).

`posecraft/emitters` samples seeded flame, smoke and ember effects directly at a time. `posecraft/scene-graph` provides default emitter settings, inherited folder visibility and safe removal helpers. Scenes declare `procedural-emitters` and `scene-groups` capabilities. `lighting.emitter` binds the existing point light to a source, including its pulse. See [scene effects and folders](emitters.md) for settings, particle caps and migration of older campfire drafts.

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

Input and acceleration history is retained for the first 180 seconds, up to 20,000 events. `seek(0..180)` resets and replays that history using fixed steps, without emitting duplicate application events. Editing input after seeking discards future recorded events. Replay is deterministic within the same JS runtime; cross-device bitwise identity is not promised. The current simulation has no stochastic operations, so scenario seed is fixed at zero. Reset creates initial playback state and clears history. It does not reapply React input props until they change.

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

For opt-in get-up, return-to-mark walking, `walkTo(actorId, sceneX)`, recovery diagnostics and the phone-motion adapter, see [assisted recovery](reactions.md#assisted-get-up-and-walking).

Opt-in `pack.spatial: true` enables keyable yaw/pitch, layer depth and shape controls. Part metadata defines curved facial surfaces, visibility, clipping and compatible vector morphs. See [spatial rigs](spatial.md). Original packs retain their existing 2D behavior.

Optional `scene.lighting` adds surface shading, highlights, cast/contact shadows and planar reflections to the SVG renderer. See [lighting](lighting.md) for fields, Studio controls, rendering costs and receiver limits.

Actors may set `layer` to `background`, `characters` or `foreground`. Default actors use the character layer. Backgrounds draw before props and lighting effects; foregrounds draw after characters. Set `unlit: true` for emissive fire or painted scenery that should neither receive surface shading nor cast shadows. Declare `scenery-layers` when relying on this ordering.

A spatial part may set `opacityChannel: "jointId.opacity"`. The joint opacity channel ranges from 0 to 1 and defaults to 1. It controls that part only; children do not inherit it. Use a shared channel on several parts to fade them together. Input-based `showWhen` still applies. See the campfire scene for food, smoke, ember and meteor tracks.

## Campfire ensemble

The optional `scene.ensemble` descriptor is `{type: "campfire", seed: 20260917, members: ["camper-0", "camper-1", "camper-2", "camper-3"], sky: "night"}`. Declare `campfire-ensemble` in required features. It requires the four compatible campfire rigs, cooking clips and meteor scenery from `createDemo("campfire-night")`; it is not a generic behavior graph. A seed is an unsigned 32-bit integer.

`SceneController` and `WorkerSceneController` expose `triggerEnsemble("conversation" | "doze" | "meteor" | "share" | "share-missed" | "share-help" | "burn")`. Invalid events and scenes without an ensemble reject the command. Requests enter the existing three-minute replay log. Read `frame.ensemble.events` for the latest 32 event records and `frame.ensemble.sharing` for the handoff state. During sharing, `frame.ensemble.share` reports `phase`, `giver`, `receiver`, `giverHand`, `receiverHand`, optional `observer`, `noticed`, `owner` (null after consumption or release) and `contact` (the projected hand distance, null before reaching). Moving campers expose `groundY` for their current shadow and lighting support plane. Event records contain `type`, actor IDs, scene time and a detail string. Evaluated campers add `activity` and `heat`. No wall-clock timer or external service drives the ensemble.

The seeded decision clock runs at 20 Hz; pose sampling uses scene time between decisions. The same seed and requests reproduce the same event sequence across frame rates. Cooking mechanics remain editable clips. Manual clip previews, non-campfire actions and physical modes opt that actor out of the live director. The worker skips redundant background/cooking-clip ticks while the director samples them. Director episodes currently use the authored clips, without the ensemble.

`actor.groundY` optionally sets the floor/contact line for that actor's cast effects. It defaults to the scene floor line. When explicitly set on a spatial actor, it also supplies approximate depth for point-light exposure. Use it for staged casts at different depths; it is a visual receiver setting, not a collision floor or perspective solver.

## Built-in depth rig authoring

`posecraft/character-rigs` exports `addSpatialRig(pack, "ona" | "dummy", {studies?: boolean})` and `addOnaArmJoints(pack)`. Both mutate and return a caller-owned pack. Clone a source pack first. `studies: false` retains the original action defaults and clips; the default adds turn, glance, reach, tuck and limb-rotation studies. Existing depth rigs are preserved.

Apply `addOnaArmJoints` after creating Ona's depth artwork. It keeps the original shoulder IDs and physical attachments, adds forearm/wrist joints, and uses the shared soft-limb renderer. Legacy bend tracks are copied to editable elbow curves without replacing existing elbow keys. Existing pose/action interfaces and scene exports consume these joints without a gallery dependency.

`SceneController.seek` explicitly samples the requested time even while animation playback is paused or reduced-motion preview is enabled. It restores those policies afterward. The 0–180 second replay limit still applies.

## Contact constraints

`posecraft/contacts` exports `solveContact` and `applyContacts`. Scenes can declare up to 16 saved hand/foot constraints to points or actor joints. Clip timing, repeating windows, joint limits, projected depth and endpoint orientation are supported in the scene worker and Director. See [the contact schema and authoring guide](contacts.md). Scene clips and explicit worker scrubbing now support up to 180 seconds.

## Live illustrations and event authoring

A scene may set `presentation: "live"` and a saved `behaviorGraph` with variables, states, entry actions, conditional event/delay branches, and global event handlers. `presentation: "sequence"` disables graph execution; it does not flatten clips or bake simulation. Live playback has no duration limit. The existing 0–180 second seek range is a debugging replay window, not an illustration lifetime.

`SceneController` and `WorkerSceneController` expose `dispatch(event, {actor?, x?, y?})`, `setVariable(name, booleanOrNumber)`, and `pointer({binding, phase, x, y})`. `posecraft/behaviors` exports the standalone bounded `BehaviorRuntime`. `posecraft/pointer-browser` connects declared pointer bindings to SVG input; `mountScene` attaches these automatically. Coordinates use scene units. Frames expose `behavior` and `emitterOverrides`. See [live scene authoring](live-scenes.md) for schema limits, authoring controls and campfire examples.

`posecraft/scene-export` exports `inspectSceneFeatures` and `createSceneExport`. Studio downloads HTML backed by the deployed runtime directory. `npm run compile:scene -- input.scene.json empty-output-directory` emits a self-hosted website with a selected runtime graph; serve it over HTTP(S). Illustration exports omit Planck, rigid-body recovery and the full SceneController. The shared renderer still includes common rendering capabilities; this is not physics baking or a minimum-per-shape compiler.

## Bottle water and buoyancy

A scene can declare `fluid` and the `bottle-fluid` capability. `posecraft/bottle-fluid` provides `BottleFluid`, area-conserving polygon helpers and types; `posecraft/bottle-browser` provides the shared grab/touch/phone adapter. Scene, worker and illustration controllers expose `fluidInput(command)` and frames expose `fluid`. Commands distinguish grab/move/release/cancel point sets, motion acceleration and gravity, wind, and an impulse nudge. See [bottle liquid scenes](fluids.md) for saved fields, controls and approximation limits.

## Action variations and stats

`behaviorGraph.activities` defines weighted clips, time windows, speed ranges, pose offsets and stat-dependent success. `variableBounds` limits numeric stats; `perform` and `add` actions run attempts and update values. Scene, worker and illustration players share seeded results. Frames expose `behavior.actions` and `behavior.variables`. See [action variations and stats](actions.md) for authoring, outcome timing and examples.


## Shared objects, character decisions and additive motion

See [shared props and Catch](shared-objects.md), [actor decision graphs](actor-behaviors.md) and [motion layers](motion-layers.md). Their validated scene fields are `objects`, `objectPhysics`, `objectGames`, `actorBehaviors` and `motionLayers`. Public modules use those same names (`scene-objects`, `prop-games`, `actor-behaviors`, `motion-layers`). Scene, worker and illustration controllers expose `objectCommand`, `dispatchActor` and `setActorVariable`; frames carry object ownership, passing-game statistics and independent character states.

## Rendering, replay and website controls

`renderer: 'svg' | 'canvas'` is saved per scene. [The renderer guide](renderers.md) describes the evaluated drawing contract, picking and explicit Canvas capability gates. Studio character/mesh guides remain SVG. Pointer and bottle controls work with either mounted renderer.

[Replay checkpoints](checkpoints.md) cache supported state under an explicit memory budget. [Scroll bindings](scroll.md) save authored clip sampling or live input/variable mappings without replaying physics for each scroll event. Studio → Motion & website authors the primary binding and previews it; the data API supports multiple mappings. Browser, React and illustration mounts attach saved scroll configurations.

## Semantic agent authoring

`posecraft/agent-authoring` provides revision-safe inspect, diagnose, propose and apply operations. [The agent guide](agent-authoring.md) documents CLI commands, bounded simulation, actual PNG previews and the six-tool stdio MCP server (`posecraft-mcp`). Clip, contact and pointer builders expand to ordinary validated transactions. They do not execute code from scene documents.


## Navigation, actor depth and physical motion recording

`posecraft/navigation` exports the incremental `PathJob`, `navigationObstacles`, `navigationSegmentClear` and bounded `approachPoint` helper. `WorkerSceneController.findPath` also accepts an `area` rectangle. Catch integrates routing through its saved `navigation` field; see [walking-area authoring](navigation-authoring.md). The route work budget counts heap entries processed; stale entries can consume budget without expanding a node.

Set `renderer: 'canvas', canvasDepth: 'actor'` for [per-actor depth composition](renderers.md). Unsupported mesh materials fail explicitly. Scene-unit ordering between actors and scenery remains unchanged.

`posecraft/scene-baking` exports asynchronous `bakeSceneMotion(scene, options)`. It returns a validated document, undoable commands and measured error diagnostics without mutating the source. `node tools/cli.mjs bake scene.json request.json output.json` writes a new baked document and refuses to overwrite a file. See [supported recordings and limits](physics-baking.md).


## Moving contact targets and attached props

`SceneContact.target` accepts `{type: 'object', object: id}` and `{type: 'prop', prop: id}`, with optional rotated `offsetX`/`offsetY`. Optional `fadeIn` and `fadeOut` ramp contact strength inside its clip window. Declare `contact-targets` for these fields. Inactive unavailable targets report a null target/error and an explicit reason; contact diagnostics include effective weight. [Contact reference](contacts.md).

Props may declare a `joint` or `object` attachment. `posecraft/scene-attachments` exports `evaluatedProps(scene, frame)`, the pure evaluator used by SVG, Canvas and prop-target contacts. Declare `prop-attachments` and disable the decoration's static collider. [Attachment reference](attachments.md).

Director samples saved shared-object ownership against shot placement and clip poses. It does not run a scene's live transfer graph, Catch or object physics. For a film, author the ownership needed by each scene/shot; importing a live demo does not bake its events.
