# Native 3D foundation

The native 3D modules evaluate a declared skeleton and named object contacts in world space. They are an experimental foundation separate from the existing 2D scene format and the Atlas renderer pilot. The scene3d contract supplies geometry, validation and contact diagnostics. A separate bench-study3d project now connects authored GLB characters, a procedural movement sequence and a native Studio editor; see [Native 3D Studio](native-studio.md). That workflow does not change the scene3d schema or establish visual acceptance.

The [quality reset](engine-quality-reset.md) remains the acceptance plan. Passing the tests described here does not approve a character's appearance or movement.

## World and data conventions

A document has `kind: 'scene3d'`, `schemaVersion: 1`, `units: 'meters'` and `up: 'Y'`. The world is right-handed, with Y up and positive Z forward. Positions are `[x, y, z]`; rotations are unit quaternions `[x, y, z, w]`. Bend limits and yaw inputs use radians. Matrices contain 16 column-major elements.

Object and actor transforms apply uniform scale, then rotation, then translation. Nonuniform scale is unsupported. Joint bind transforms are local to the parent. A pose override replaces that joint's local position or rotation; it is not an additive change. Omitting a pose field keeps the corresponding bind transform.

The scene stores:

- `rigs`, each with a joint hierarchy and named three-joint chains.
- `actors`, each referencing a rig, placement transform and local pose overrides.
- `objects`, each with its box geometry, transform and named local anchor frames.
- `contacts`, each naming an actor chain and an object's anchor.
- An orthographic `camera`, evaluated separately from every world transform.

A chain contains `root`, `middle`, `tip`, a model-space `pole` point and a middle-joint `bend` range. Zero bend is straight. The chain's three joints must be directly connected. No actor or joint name has special meaning to the solver.

An object's anchors inherit its transform, including uniform scale for position and rotation for orientation. Geometry and anchors therefore share one saved placement. An anchor may lie outside the box, as the fixture's grips do. The box is descriptive geometry in this increment; it does not provide a collider or physically support the actor.

Validation rejects malformed JSON, unknown fields, missing references, hierarchy cycles, invalid quaternions and resource limits. The scene currently permits up to 32 rigs, 128 joints and 32 chains per rig, 64 actors, 128 objects, 32 anchors per object and 256 contacts. Only one enabled contact may use a particular actor and chain role.

## Evaluate a contact study

From a module at the repository root:

```js
import {createBenchContact3D} from './examples/bench-contact-3d.js';
import {compileScene3D} from './src/scene-3d.js';

const document = createBenchContact3D({height: 1.75});
const scene = compileScene3D(document);
const original = scene.evaluate();

const bench = structuredClone(document.objects[0].transform);
bench.position[2] += 0.06;
const moved = scene.evaluate({objectTransforms: {bench}});

console.log(moved.contacts.map(({id, status, error}) => ({id, status, error})));
const saved = JSON.stringify(scene.serialize());
const reloaded = compileScene3D(JSON.parse(saved)).evaluate();
```

`compileScene3D` validates and copies the source. `evaluate()` returns actors with their solved local pose and world joints, objects with matrices and world anchors, contact diagnostics and a cloned camera. `evaluateScene3D(document)` is the convenience entry for one evaluation.

Optional `evaluate` overrides accept `actorPoses`, `objectTransforms` and `camera`. Actor poses merge supplied local fields with the actor's authored pose. An object transform override supplies the complete position, rotation and uniform scale. Overrides are validated but do not edit the compiled document. `serialize()` returns the original compiled document, not the last override or solved pose. Copy overrides into the source document explicitly when saving an edit.

Returned data is independent of the source and subsequent evaluations. The evaluator has no playback clock, random state or accumulated solver history. Changing the camera cannot change a hand, joint or contact result.

`createBenchContact3D` accepts height from 1 to 3 meters, bench position and bench yaw. It creates one supine skeleton and two stationary grip targets. Height changes bind proportions. The fixture does not animate a bench press, apply a bar's weight or simulate chest support. Some combinations of height and equipment placement can be unreachable; that is a diagnostic to handle, not a reason to stretch the arm.

## Contact results

The analytic two-bone solve changes joint rotations to reach a position and orient the tip. It preserves the segment lengths in the supplied pose, including actor placement scale. It does not move the actor root or enlarge a bone to hide a reach error. Explicitly authored local position overrides can change segment lengths before solving; they are not solver-generated stretch.

Each contact reports world-space `target` and `actual` frames, positional `error` in meters, `orientationError` in radians, measured `boneLengths` and `maxStretch`. The solver's stretch multiplier is always 1.

| Status | Meaning |
| --- | --- |
| `solved` | The final pose reaches both the target position and orientation within numerical tolerance. |
| `unreachable` | The target is farther than the two lengths combined or inside their minimum possible reach. |
| `limited` | Bone lengths permit the target, but the authored middle-bend range prevents it. |
| `conflict` | A later contact displaced an earlier solution's position or orientation. |
| `disabled` | This contact did not constrain the pose. Its error is still measured. |

Contacts run in authored order. The evaluator measures all final errors after the last solve so overlapping chain roles cannot leave an obsolete success result. This is not a simultaneous whole-body optimizer. It reports conflicts rather than deciding which support to release, moving the body or planning recovery.

The pole chooses the bend side. At a collinear singularity the solver uses a deterministic fallback. There is no temporal pole smoothing. Current limits constrain the middle bend only; shoulder cones, wrist twist limits, full-body balance and collision avoidance are not implemented.

## Independent acceptance checks

Run `node --test test/scene-3d.test.js`. These tests calculate expected positions using axis rotations, trigonometry and Euclidean distances, without calling the production transform helper to generate their expected answers.

The checks cover positive and negative depth targets, a 121-step depth sweep, translated and rotated anchor frames, uniform scale, unequal segment proportions, near and far unreachable targets, bend limits, disabled contacts, positional and orientation conflicts, camera independence, source isolation and JSON reload. The bench fixture adds both grips at three heights and three bench rotations, then moves the bench independently of the torso.

Tests use a `1e-7` tolerance for lengths and positions in these meter-scale fixtures. That is a numerical regression tolerance, not a visual approval threshold. Different proportions in the same simple skeleton do not count as an independently authored second character.

## Next acceptance gates

Before this can replace the current character pipeline:

1. Bind a deliberately authored weighted mesh and facial controls to this skeleton contract. Review shoulders, hips, elbows, knees and twists for volume loss, intersections and visible deformation defects.
2. Run a complete approach, sit, recline, grip, press, release and rise sequence against moved equipment. Include interrupted actions and unreachable recovery. Review continuous motion at normal and quarter speed from several cameras.
3. Repeat the workflow on an independently authored character with different proportions and topology, without character-specific renderer branches.
4. Expose equipment placement, chain limits, contact diagnostics and action transitions in Studio. Prove that saved edits survive reload and produce the same solved transforms in worker playback and supported exports.
5. Measure sustained simulation and drawing on actual target devices, including startup, memory, GPU work, offscreen suspension and reduced motion.

The native bench editor has its own bounded project store, GLB loader, renderer, action evaluator and self-contained website export. It remains separate from the existing 2D Studio store and scene playback controllers. Existing 2D scenes and the Atlas comparison page continue through their existing paths. The implementation of a workflow does not mark the acceptance gates above complete: continuous movement, skin deformation and target-device performance still require review. No physical muscles, active ragdoll, skinning quality or performance advantage is established by the foundation tests.
