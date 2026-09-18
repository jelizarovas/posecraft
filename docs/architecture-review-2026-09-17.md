# Architecture review and next implementation order

Reviewed against commit `2b1807a`, September 17, 2026. This corrects the two supplied reviews and proposes an implementation order. The original implementation order is preserved below. The September 17 implementation and measured limits are recorded in [the implementation report](implementation-2026-09-17.md). It does not replace the production-film requirements in [the Studio roadmap](studio-roadmap.md).

## Findings checked against the code

| Review claim | Current evidence | Decision |
| --- | --- | --- |
| Serializable scenes and revision-checked transactions are a useful authoring foundation | `src/schema.js` and `src/commands.js` validate scene data and atomic edits. The CLI already inspects, edits, simulates and exports SVG previews. | Build semantic operations on these transactions. Both Studio and agents must call the same operations. |
| Switching to Canvas/WebGL requires no simulation changes | Simulation is headless, but `src/svg.js` calls `spatialParts` and performs deformation, fragment construction, masks, lighting and draw ordering. Frames are not a complete renderer-independent drawing description. | Extract and test a shared evaluated drawing contract before adding another renderer. Preserve full/lite/worker parity. |
| Physics-free website packaging is missing | `inspectSceneFeatures` selects illustration versus physics. `tools/compile-scene.mjs` selects optional illustration providers. The mesh export browser check already verifies a compiled scene without Planck. General SceneController/browser entry points still import the physical runtime. | Extend the existing compiler and measure exported dependency bytes. Do not invent bundle-size claims or build a second exporter. |
| Bottle foam and splashes are static artwork | `src/liquid-waves.js` evolves 33 wave samples and up to 16 moving drops. Foam paths are regenerated from the wave surface. Bottle controls already support dragging, two-point rotation and device motion. | Preserve those behaviors. The next physical improvement is distributed hull buoyancy and ship-to-water feedback. |
| The ship is not affected by waves | `BottleFluid.tick` samples surface height and slope, updates ship velocity and angular velocity, and checks hull/mast contacts against the bottle. It uses a center sample, not distributed buoyancy. | Improve the coupling and its energy bounds. Replacing it with decorative emitter foam alone would not improve buoyancy. |
| Campfire is completely outside the behavior system | The scene has a saved behavior graph for fire state, recovery and pointer events. Cooking, social attention, sharing and gaze remain in `CampfireEnsemble`. | Migrate reusable behavior mechanisms incrementally, preserving the current seeded event sequences. |
| Gaze damping and flickering cel coverage need adding | `stepLooks` already uses critically damped head motion. `animatedLight` varies intensity and cel coverage. | Review their visible quality; add eye-leading gaze and better material lighting where needed. Do not duplicate existing controls. |
| Gym fatigue is only a fixed animation | Activities already choose variations and failures from fatigue/thirst, modify stats, and recover between activities. Pose bindings exist. The clips still supply most movement. | Improve contact-preserving continuous effort and breathing through shared authoring tools. More random joint noise alone will not fix anatomy. |
| Long seeks replay from zero | Both SceneController and IllustrationController reset and replay fixed ticks and input logs. Worker seek moves this work off the UI thread but does not eliminate it. | Benchmark seek latency, then introduce complete, versioned checkpoints with replay equivalence tests. |
| Catch can be added with a ball body and a few callbacks | Each `PhysicalCharacter` owns its own Planck world. There is no shared dynamic-prop ownership/attachment system. | Establish shared object contacts, attachment ownership and constrained retrieval before presenting catch as a reusable Studio capability. |

Executed feature inspection confirms that Gym, Campfire and Bottle currently select the illustration runtime; Shake & Settle selects physics. This is capability evidence, not a frame-rate measurement.

## Product direction

Use Campfire, Bottle and Gym as the initial featured scenes. Add Catch when its reusable systems pass the checks below. Keep Light & Shade, Turn & Pose, Drop Lab, Zero Gravity and Expression Lineup as technical labs. Keep the Director examples accessible for camera and shot editing. Preserve all existing links and downloadable projects.

Removing an entry from the featured gallery does not mean deleting its regression coverage. The staircase also remains useful for two-character coordination and support contacts. A smaller featured gallery must not silently drop the user's requested scenarios.

## Implementation order

### 1. Establish visual and performance acceptance

Create reproducible samples for full turns, folded limbs, bench transitions, shared props, campfire handoffs and bottle motion. Review stills and motion at the actual embed size. Measure simulation time, mesh evaluation, DOM updates, frame-time percentiles, memory, seeking and compressed export size separately. Use one, four and sixteen visible characters, and include a physical phone before claiming mobile performance.

Completion: a saved scenario, seed and input trace reproduce each reported defect, and a before/after report records both visible quality and cost. Numeric contact tests supplement visual review.

### 2. Separate evaluation from drawing

Extract a drawing representation shared by Studio, exports and renderers: geometry, material, visibility, masks, object-space transforms, actor/part identifiers, picking information and scene depth. Cache topology and reuse buffers. Decide from measurements which evaluation work moves into the existing dedicated worker. A service worker is not the animation simulation loop.

Implement a bounded Canvas or GPU prototype against that representation, selected explicitly per scene. Test masks, cel lighting, attached materials, mesh intersections, props, picking, reduced motion and disposal before claiming parity. GPU depth testing deserves particular evaluation for the current mesh occlusion problems; replacing SVG with a painter-sorted Canvas alone would preserve those errors.

Completion: identical replay samples pass visual comparisons in both renderers, and measured benefits justify any added download and initialization cost. SVG remains supported.

### 3. Add shared object ownership and action contacts

Define scene-level dynamic objects, collision filters, fixed-step ownership, attach/release operations, grip break conditions and events. Establish how animated actors interact with shared bodies and how existing per-character ragdolls participate. One object has one authoritative state; a handoff cannot give two actors independent copies.

Expose these operations in Studio with target picking, contact windows, reach diagnostics and undo. Save them as validated data. Playback and website exports must use the same implementation.

Completion: two different actors can pick up, carry, exchange and drop the same prop. Missed grips, interruption, disabled actors, replay and reload produce defined outcomes without snapping a distant prop into a hand.

### 4. Build Catch from those tools

Use throw preparation, release, delayed observation, trajectory estimation, interception, reach, catch/miss, settle, retrieval and return states. Estimate flight using the actual gravity and damping model, and stop estimating beyond its supported collision assumptions. Use swept catch tests or continuous collision handling so a fast ball cannot skip a hand between ticks.

Separate an unreachable throw from a reachable catch that fails. Retrieval must follow the ball's actual position, respect obstacles, stoop within joint limits and acquire ownership only at contact. Seed variations and cap planning work per tick. Ragdoll dives are a later action variant after the basic catch/retrieval cycle is reliable.

Completion: exported scenes support catch, miss, bounce, pickup and role reversal indefinitely. Studio can change skill, throw variation, reaction delay and success conditions. No catch behavior exists solely inside the demo page.

### 5. Improve existing scenes through reusable controls

- Gym: editable effort/breathing layers and corrective deformation. Keep constrained hands planted while torso and free joints show strain. Preserve recovery, variable timing and asymmetric effort. Improve body shapes before adding tremor.
- Bottle: sample buoyancy across the hull, apply torque and bounded reaction impulses to the water. Retain volume conservation, glass containment, drops, phone input and two-grip controls. Distinguish decorative particles from fluid volume.
- Campfire: expose actor-scoped variables, concurrent activities, attention targets, interruptions and prop ownership. Then migrate cooking/sharing in small steps. Keep the current ensemble as a compatible reader until old projects can be migrated with undo.

Completion: each new setting can be authored in Studio, saved, reopened and used in a different scene. Shared changes also pass the older demo regressions.

### 6. Add semantic authoring and agent diagnostics

Provide inspect, propose, validate, simulate and preview operations over the shared editing API. Semantic builders expand into ordinary reviewable scene data and revision-checked transactions. Start with supported clip/contact/interaction operations; a command named `generate-cycle` must not imply a general locomotion solver that does not exist.

Add diagnostics for unreachable states, invalid ownership, contact error and track discontinuities. Distinguish intentional step/hold keys from unintended discontinuities. Add raster preview capture with bounded time and size. An MCP server can expose these operations once their contracts are stable; it should not contain a separate editing implementation.

Completion: an agent can propose an edit, inspect its diff and diagnostics, preview the result, then apply it without bypassing revision checks or invoking arbitrary code from scene data.

### 7. Add seeking checkpoints and scroll bindings

Checkpoint authored/illustration state first. Include seeds, event cursors, active variations, transitions, pointers, springs, ensemble state, waves and accumulated time. Invalidate checkpoints when edits or earlier input events change their history. Physical snapshots also need solver/contact state sufficient to preserve the promised replay behavior; copying body transforms alone is not a deterministic checkpoint.

Bind normalized scroll progress and velocity to declared inputs or variables with units, clamping and reduced-motion behavior. Define whether scrolling samples an authored sequence or influences a live scene. Avoid replaying a minute of physics for every scroll event.

Completion: sampled output and event delivery agree with replay from zero, checkpoint memory is bounded, and measured scrub/scroll latency improves.

## Release rule

Every runtime capability needs validated data, Studio authoring, undo/save/reopen, appropriate export capability detection, worker/full/lite agreement where supported, and visual checks. A demo-specific workaround does not complete that capability. Audio editing, dialogue, frame-accurate movie export and project portability remain separate production-studio requirements.
