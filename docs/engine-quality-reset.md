# Engine and character quality reset

September 18, 2026. This responds to the user's rejection of the Atlas 3D pilot's visual quality. It supersedes incremental Atlas silhouette patches as the next implementation priority. This document records the diagnosis and acceptance contract. The first native bench workflow is implemented; its limits and review evidence are tracked below.

## Product standard

The user's priority is the quality of the finished scene, the experience of authoring it, and its cost on a real website. Feature breadth is secondary. The target includes professional animators who can bring their existing assets and expect predictable editing, motion and delivery.

Evaluate those priorities separately:

- **Result:** appealing character design and motion remain convincing through turns, contact, interruption and changes in proportions. A technically correct render of weak artwork does not pass.
- **Authoring:** a creator can import a character, place equipment, define an action, see reach/support problems, fix them with meaningful controls, and publish without editing implementation code. Record task completion time, mistakes and repair effort with people who did not implement the feature.
- **Website cost:** measure transfer and startup, main-thread responsiveness, simulation and GPU time, sustained frame delivery, memory, offscreen suspension and reduced-motion behavior. Compare equivalent assets, quality settings and interactions on the same devices. A narrow desktop viewport is not a phone measurement.

Competitive superiority is an outcome to establish with fair comparisons and creator feedback, not a status inferred from architecture, a single CPU timing or an ambition statement. Keep the software and scene data inspectable and portable so professional users can evaluate the workflow without losing their source work.

## What failed

The GPU experiment established a rendering option and a lower measured CPU submission cost. It did not establish a production character pipeline. The previous release treated finite geometry, preserved projected anchors, screenshot collection and a working demo as stronger evidence of quality than they were. The user did not accept the result visually.

| Failure | Current evidence | Required correction |
| --- | --- | --- |
| Screen coordinates substitute for a physical skeleton | `src/spatial.js` uses local joint offsets with zero Z; pose Z contributes to painter ordering. `src/contacts.js` minimizes projected XY error. | Author a native 3D bind skeleton, transforms and contact frames. Camera projection happens after pose solving. Preserve the separate 2D format through an explicit compatibility path. |
| Equipment has competing definitions | `examples/gym-room.js` generates projected furniture and targets; `examples/gym-three-room.js` separately reconstructs furniture and depth. Static 3D furniture is not driven by Studio equipment edits. | Store each object's geometry, transform, grip points and supporting surfaces together. Moving a bench must move all of them. |
| The renderer repairs pose defects | `evaluateThreeAtlasPose` in `src/three-atlas.js` knows Atlas's dimensions, guesses depth and allows up to 15% reach stretch. It infers bar contact from proximity. | Remove anatomy and equipment-specific guesses from drawing. Named rig chains and explicit grip/support states produce one authoritative solved pose. Unreachable contacts trigger diagnostics and motion recovery, not silent bone elongation. |
| The asset lacks designed deformation | `examples/gym-skin.js` lofts rings with coordinate-based weights and one left-elbow corrective. The 3D head, beard, hands and shoes are constructed from overlapping primitives in code. | Establish a deliberately modeled silhouette, shoulder/hip topology, skin weights, twist distribution, corrective shapes and facial controls. A connected mesh alone does not supply these. Procedural generation remains useful only when its output meets the same asset bar. |
| Movement and physical support are separate approximations | Gym pose formulas set many joints and transitions directly. Existing contact solves are projected. `PhysicalCharacter` uses per-character 2D worlds. | Layer approved motion with world-space goals, reach/support constraints and collision proxies. Treat active ragdoll as a later controlled system, not a substitute for animation or an attribute automatically supplied by 3D rendering. |
| Tests preserve defects as well as correct behavior | GPU parity uses the same adapter as its reference. Shared frame labels come from one host function. Screenshot tests check existence/finite bounds and collect images. | Add independent geometric constraints and a blocking review of complete motion. Label correctness, visual approval and performance as separate outcomes. |
| Reuse has not been demonstrated | The pilot depends on Atlas names, dimensions, a projected gym and code-defined face features. | Repeat the same pipeline on a separately authored character and changed equipment geometry without character-specific renderer branches. |

## Architecture to build toward

Retain the scene/document transactions, event and behavior systems, seeded replay, worker scheduling, ownership/attachment concepts, authoring UI and selective export infrastructure. Their 3D bindings require explicit work and tests; compatibility is not automatic.

Use the existing GPU renderer for drawing. Support an ordinary authored asset pipeline with GLB/glTF meshes, skeletons, animation clips and morph targets. Store runtime-specific rig semantics, joint limits, contact frames and action definitions as versioned Posecraft data alongside those assets. glTF transports the asset and baked animation; it does not supply our runtime behavior or constraint solver. [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

The native 3D scene uses one documented world space, unit scale and transform convention. Skeletons, equipment, collision shapes, attachments and cameras all refer to that space. Drawing order is an artistic property, never a replacement for physical depth. A stylized orthographic camera remains supported.

The intended evaluation order is:

1. Resolve behavior intent, action state and explicit interruptions.
2. Sample and blend authored motion, including root travel, gaze and expression.
3. Apply declared style/effort layers and turn these into pose goals.
4. Solve joint limits, grips, stance, support and collision avoidance together, with a defined priority when goals conflict. Physical response participates here when enabled.
5. Apply corrective deformation and produce the solved skeleton, expressions, attachments and diagnostics.
6. Render that result. The renderer cannot move a hand to conceal a contact error.

Exact coupling and solver choice must be demonstrated in the acceptance scene before being generalized. Avoid building a second custom rendering engine or a new physics solver when an established component meets the requirements.

## Next implementation milestone

The [native 3D modules](native-3d.md) provide versioned world-space scene data, quaternion skeleton evaluation, rigid two-bone contacts and reach/conflict diagnostics. The [native Studio](native-studio.md) now connects two authored skinned GLBs, a proportion-aware bench action, palm frames and finger poses, editable furniture/camera/bend limits, safe completion, worker playback, JSON reopening and a self-contained website export. It remains a focused bench authoring workflow rather than a replacement for the general 2D Studio. See [implementation and review evidence](native-3d-review.md) for what was checked and what is still missing.

Build a reusable character-and-contact lab, then use it to replace the gym's pose conversion. New showcase scenes are not the next quality milestone.

### A. Asset and spatial contract

- Version the native 3D asset and rig data separately from the existing 2D schema.
- Load and inspect a skeleton and weighted mesh without Atlas-specific joint-name assumptions.
- Store bind transforms, semantic chains, joint limits, grip frames, foot support shapes and face controls as editable data.
- Retain original source assets and license/provenance records. Do not treat generated thumbnails as usable rigged assets.
- Make camera orbit a diagnostic: changing the camera must not change anatomy, contacts or prop ownership.

### B. One convincing character and one complete action sequence

Use a deliberately authored Atlas replacement with front, side, rear and three-quarter shape approval before adding effort effects. Inspect shoulders overhead, elbow twists, deep hip bends and knees before approving weights.

Prove idle, a full turn, walk/start/stop, approach, sit, recline, press, rise and walk away in a coherent 3D room. Add grip/release and one-hand hanging only against explicit support targets. Move or resize the bench and bar to expose hardcoded choreography. An unreachable target must result in repositioning, a defined fallback or a clear authoring diagnostic.

Use authored timing and pose transitions to show anticipation, load and recovery. Fatigue may change timing, posture and selected actions, but it cannot override planted contacts or add unconstrained random shaking.

The first complete proof is one bench action that remains correct after changing the bench transform, actor proportions and camera angle. Make the bar an independent scene object with explicit ownership and grips. Cinematic kinematic constraints can establish this before introducing a physical load model; a weight drawn as an Atlas joint is not evidence of coupled load physics.

### C. Reuse, authoring and export

Repeat the same actions on a second independently authored character with different proportions and topology. Use declared retargeting and corrections rather than name checks or copied renderer code.

The scene must then be editable in Studio: place equipment, pick grips/supports, adjust joint limits, inspect reach errors and author action transitions. Save, reload and export the same data. Preserve the existing lightweight 2D path for illustrations that benefit from it. Measure feature-selected 3D packaging separately.

## Acceptance gates

The following are proposed starting tolerances to validate against approved motion, not current capabilities or sufficient proof of visual quality:

- Planted grip error at most 0.2% of character height; stance drift at most 0.5%; unintended floor penetration at most 0.2%.
- Rigid bone lengths remain fixed within numerical tolerance. Any intentional cartoon stretch is an explicit authored control, not solver compensation.
- Check nonadjacent body collisions and mesh intersections, regional volume collapse and flipped normals through the pose range. Calibrate deformation limits per region rather than promising that one volume number measures anatomy.
- Measure transitions in position, orientation and velocity, including interrupted actions. Establish motion-specific velocity and acceleration envelopes from approved samples instead of one generous jump threshold.
- Inspect full sequences at normal and quarter speed from multiple cameras, both close-up and at embed size. Collecting screenshots is not approval. Baseline updates require a recorded visual review; they cannot automatically bless the latest output.
- Run the same saved acceptance scene through Studio, reload, worker playback and supported exports. Independently inspect the solved transforms, not only labels written by the page.
- Benchmark one, four and sixteen characters, with and without interactions. Record simulation, rendering, GPU timing when available, memory, download size and sustained physical-phone behavior separately. Do not infer battery savings from CPU submission time.

The milestone is complete only when both the visible result and these invariants pass. A faster renderer, more controls or a larger test count cannot substitute for that result.

## Pilot disposition

Keep the published Atlas 3D page as a diagnostic comparison. Its CPU measurements remain useful. Do not promote its synthesized depth, hardcoded facial geometry or inferred bar contact into the general engine contract. The current roadmap's larger Studio and cartoon goals remain valid; this foundation precedes further expansion.
