# Character and scene contract proposal

Status: proposed, not implemented. The existing `posecraft` export remains compatible. No Ukis migration or deployment is part of this proposal.

## Separate the runtime from the artwork

The core evaluates bones, constraints, numeric channels, state layers, and events. Character packs provide appearance, artwork, pivots, poses, and motion. Scenes place character instances and props and coordinate their interactions. The editor produces the same data that applications consume.

Ona and wwwzard must use the same core without character-name branches. Ukis owns contact records, navigation, modal geometry, and the dock. None of those belong in character packs.

Keep one npm package initially, with explicit subpath exports as modules become ready:

| Proposed export | Responsibility |
| --- | --- |
| `posecraft` | Existing runtime and math API, retained |
| `posecraft/schema` | Validate and migrate versioned documents |
| `posecraft/scene` | Instance registry, shared scene clock, attachments, interaction events |
| `posecraft/svg` | Static SVG rendering and imperative frame updates |
| `posecraft/react` | Character and Scene components, lifecycle and visibility management |
| `posecraft/editor` | Optional authoring UI, not imported by runtime consumers |

Character packs remain separate data modules. Do not export Ona or wwwzard from the core. The eventual package names for packs are undecided. No subpath in this table exists yet except the root export.

## Versioned data

Every document has `schemaVersion: 1`, a stable `id`, and a discriminating `kind`. IDs refer to authored content, not household members or database rows. Reject unsupported versions instead of guessing.

`CharacterPack` contains:

- `kind: "character"`, `id`, `revision`, and provenance/license metadata.
- `bounds`: a default view box and authored motion bounds. Bounds include props and extreme poses. Keep the camera stable during playback rather than resizing every frame.
- `appearance`: typed color and variant slots, with defaults and allowed values. Hair is an attachment variant with front and back parts, not a new character ID.
- `joints`: stable IDs, parent IDs, rest transforms, and rotation limits. Coordinates use SVG units with positive Y down. Rotations use degrees.
- `parts`: vector geometry, joint binding, local transform/pivot, appearance slot bindings, and default draw order. Art can be split across rendering layers without splitting its physical joint chain.
- `anchors`: named points in joint or part-local coordinates, such as palm grip, collar, or book grip.
- `poses`, `clips`, and `stateMachines`: reusable animation definitions.
- `capabilities`: supported motions and an explicit still fallback. Missing animation is not permission to substitute unrelated art.

`SceneDocument` contains:

- `kind: "scene"`, `id`, `revision`, `bounds`, and pack references pinned to revisions.
- `actors`: independent instance IDs, character references, placement transforms, appearance overrides, initial poses, and inputs.
- `props`: independent IDs, vector references, placement, anchors, and draw slots.
- `attachments`: relationships between named anchors. A held prop has one owning anchor and may have a second grip solved by IK. A leash is a connector between endpoints, not a child of both actors.
- `interactions`: actor motions, synchronization markers, attachment changes, and cancellation behavior on a shared timeline.
- `fallback`: a declared static composition for unsupported motions or reduced motion.

`MotionSet` contains reusable clips, poses, and state machines for a named rig contract. Reusing an animation across incompatible rigs requires an explicit joint/anchor mapping, not matching a character name.

All persisted content is JSON-compatible. No JavaScript callbacks, raw HTML, executable expressions, DOM references, or personal records are serialized. The current runtime accepts callbacks, so a compiler must translate declarative predicates and tracks to runtime definitions. Trusted procedural extensions such as robe physics remain registered code outside documents.

## Example scene shape

This is a reference shape, not an importable asset. It requires the referenced packs and motions.

```json
{
	"schemaVersion": 1,
	"kind": "scene",
	"id": "greeting-pair",
	"revision": 1,
	"bounds": { "x": 0, "y": 0, "width": 400, "height": 240 },
	"packs": [{ "id": "ona", "revision": 1 }],
	"actors": [
		{ "id": "host", "character": "ona", "transform": { "x": 100, "y": 140, "scaleX": 1, "scaleY": 1, "rotation": 0 }, "appearance": { "clothing": "#e6bd57", "hairStyle": "none" }, "pose": "idle" },
		{ "id": "guest", "character": "ona", "transform": { "x": 280, "y": 140, "scaleX": 1, "scaleY": 1, "rotation": 0 }, "appearance": { "clothing": "#bddae5", "hairStyle": "bob" }, "pose": "idle" }
	],
	"props": [],
	"attachments": [],
	"interactions": [],
	"fallback": { "poseByActor": { "host": "idle", "guest": "idle" } }
}
```

Character identity and instance identity are separate. `ona`, `rusty`, `miau-miau`, and the existing `jordan` identifier remain distinct. No Miau Miau artwork or equivalence to Jordan has been confirmed.

## Draw order and attachments

Bone parenting controls movement. Render slots control occlusion. An upper arm can render behind the torso while its forearm and hand render in front. A continuous sleeve may use multiple drawing passes with a shared seam mask. Do not rotate detached image pieces around guessed pivots.

Use stable ordered slots plus explicit discrete draw-order keys. Numeric depth values do not physically blend two layers. Switch at an authored time or when the limb crosses the body edge. Cross-actor ordering must be possible so a prop or one actor's hand can pass in front of another actor.

Evaluate each frame from the current sampled pose, never from previous-frame world transforms:

1. Sample and mix local poses, then apply local joint limits.
2. Calculate current world transforms, including actor placement, scale, and reflection.
3. Process the validated dependency graph in topological order. Resolve each target anchor from current world transforms, convert it into the solver's coordinate space, solve its constrained chain, and immediately recompute affected descendants before another constraint reads them.
4. Place each owned prop from its owner's resolved anchor. Solve secondary grips against the prop's current anchors and recompute affected transforms. A secondary grip cannot move the prop owner or create a feedback cycle.
5. Calculate connectors from the final endpoint transforms, resolve draw slots, and render.

Reject cyclic constraint/attachment dependencies in the first implementation. A two-hand grip uses one prop owner and a secondary IK constraint rather than a parent cycle. Reject singular placement transforms. Mirrored and nonuniformly scaled actors require explicit conversion into the chain's local metric; do not feed world-space distances directly into a two-bone solver that assumes local bone lengths.

Required tests cover same-frame moving targets, reordered independent actors, mirrored actors, uniform and nonuniform scale, constrained/unreachable targets, and a prop held by one actor while another grips it. Assertions compare final world-space grip endpoints and confirm that no dependency reads a stale transform.

Passing an object changes ownership at one event marker while preserving the object's world transform. Cancellation specifies whether to retain the current owner, return the object, or release it. Do not replay an event merely because playback reverses or a component remounts.

## Playback and host integration

The proposed scene controller supports play, pause, resume, speed, seek, input changes, events, and disposal. One-shots hold or transition at completion as defined. Loops use a shared phase when actors must stay synchronized.

An interrupted transition starts from the displayed mixed pose. Pause and offscreen suspension preserve the playhead without accumulating a large catch-up delta. Seeking updates the pose without emitting interaction side effects by default.

The host owns the outer `data-motion-art` wrapper and its geometry. Posecraft owns transforms inside the SVG. The React adapter creates a controller once per instance and updates SVG attributes directly during playback, without a React render every frame. Configuration changes update that instance without resetting its animation unless explicitly requested.

The proposed handoff is an ownership protocol, not a DOM clone or a clip/playhead export. Each transfer has a unique token and passes through active, captured, claimed, and committed or cancelled states. Repeated calls with the same token are idempotent; stale tokens cannot restore or resume a newer owner.

1. Capture atomically pauses the source at its last displayed frame and exports frozen SVG plus controller state. The SVG contains explicit evaluated transforms, styles, geometry, draw order, and attachments, with no running CSS or SMIL animation. Placement stays in an inner group. All SVG IDs and local references are remapped together. Cloning DOM and disabling animation does not freeze computed animated child transforms.
2. The host chooses exactly one visible representation: source, inert transit snapshot, or destination. While the snapshot is visible, neither live view advances. Posecraft does not move or hide application panels itself.
3. Claim restores into a paused destination and acknowledges that its first rendered frame matches the capture. The snapshot remains until acknowledgement. The transfer state includes layer states, playheads, active transition source poses and progress, weights, inputs, pending one-shot state, event cursors, interaction phase, attachment owner/offsets, and any registered procedural state required for continuity.
4. Commit retires the old presentation and grants the destination sole playback ownership. Resume occurs at most once, and only if playback was active before capture and visibility/reduced-motion policy permits it. Restoration never replays completion, prop-transfer, or attachment events.
5. Cancel restores the source if it remains mounted. If the source is gone, retain a paused snapshot/state for an explicit replacement claim or dispose the transfer. Never resume a detached controller. A claimed destination that unmounts before commit cannot keep ownership.

Reverse closing captures the modal's current displayed state in a new transfer, rather than restoring the original opening playhead. Replacement and back navigation invalidate the previous token. Reduced motion bypasses the transit animation but still performs atomic ownership transfer and paused restoration. Offscreen owners retain state without advancing.

Protocol tests must cover opening interrupted by closing, repeated commit/cancel, replacement/back navigation, offscreen or removed source, destination unmount before and after commit, and reduced-motion bypass. Verify exactly one visible artwork, at most one ticking owner, identical capture/restoration pose and references, preserved blend progress and prop ownership, no replayed events, and full cleanup of abandoned transfers. These are requirements for an unimplemented protocol, not claims about today's controller.

Use per-instance SVG ID namespaces, including masks, gradients, clips, title, and description. Internal references cannot point into another character instance. Never mutate a shared pack when recoloring or posing an actor.

## Performance, accessibility, and import boundaries

One scheduler can tick the visible scene controllers. Still poses require no animation loop. Offscreen scenes and hidden tabs pause; disposal removes frames, observers, and listeners. Reduced motion uses an authored still pose and disables decorative loops. Essential state changes remain available without motion.

Decorative illustrations are hidden from assistive technology. Meaningful illustrations require a title or accessible label. The editor needs labeled touch targets, keyboard controls, and non-color state indicators. Transparent backgrounds must remain legible on both light and dark surfaces.

The import boundary validates version, finite values, coordinate ranges, unique IDs, references, parent cycles, attachment cycles, keyframe order, durations, and resource limits. Vector import uses a structured allowlist, not injected markup. Reject scripts, event handlers, external URLs, foreignObject, embedded styles, and unsupported elements. Resolve permitted local paint and clip references within the pack.

## Delivery gates

1. Add schema validation and a deterministic compiler with malformed-import tests. Preserve the existing runtime API.
2. Build a static SVG renderer and two-instance test scene. Compare Ona and wwwzard against their approved artwork.
3. Rig Ona's articulated source parts. Add idle/blink, greeting, walk, read/hold, reach, stretch, and celebration. Preserve all 37 current scenes through explicit static fallbacks.
4. Add scene interactions, prop anchors, interruption tests, and controller snapshots.
5. Add the React adapter and test six visible cards, reduced motion, offscreen suspension, unmount cleanup, and modal handoff in a separate fixture.
6. Share the tested replacement and migration plan with Ukis before modifying its consumer. Publishing, licensing changes, and deployment are separate actions.

The current extraction has none of the new schema, renderer, scene-controller, or React-adapter APIs yet. Its joint runtime is the starting implementation, not evidence that these gates have passed.
