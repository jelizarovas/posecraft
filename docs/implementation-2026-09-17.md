# Engine and Studio implementation — September 17, 2026

This implements the seven bounded workstreams in [the architecture review](architecture-review-2026-09-17.md). It does not mark the broader film-production roadmap complete. SVG remains the default renderer; all existing demo URLs and downloadable scenes remain available under Featured scenes, Technical labs or Director.

| Workstream | Baseline at `2b1807a` | Implemented result |
| --- | --- | --- |
| Reproducible acceptance | Separate scene regressions | Seeded Catch samples, renderer pixel comparisons, exported Gym/Catch checks, 1/4/16 mesh workload and seek benchmarks |
| Evaluation/rendering | Geometry and materials embedded in SVG rendering | Shared evaluated drawing contract, optional saved Canvas selection, common picking, restricted per-pixel mesh-depth experiment |
| Shared props | Independent per-character physical worlds | Bounded scene-level circles/static surfaces, single ownership, checked transfer/release, actor impulse bridge, Studio controls and graph effects |
| Catch | No shared passing game | Saved participants and skills, preparation/flight/interception/miss/retrieval/return, bounded planning and replayable variations |
| Existing scenes | Center-sampled buoyancy and ensemble cooking | Five hull samples with water feedback; editable actor cooking graphs and legacy conversion; reusable Gym breathing/effort layers |
| Agent tools | Low-level edit/inspect/SVG CLI | Semantic proposals, revision/content checks, diagnostics, bounded simulation, PNG preview and stdio MCP |
| Replay/scroll | Replay from zero; no saved scroll bindings | Bounded animated-state checkpoints, cached exact replay, physical fallback, direct authored scroll sampling and live bindings |

## Studio and export

Scene tools now contain **Objects & catching**, **Character decisions**, and **Motion & website**. The panels edit validated document data, preserve undo/reload, and use the same runtime as exported playback. Scene behavior effects can attach, transfer, release, impulse, place or enable an object. Actor graphs have their own variables, sensors, rates, outputs, states and branches. The Campfire converter adds cooking graphs as one undoable edit while keeping the character artwork unchanged.

The compiler selects new object, game, actor-behavior and motion-layer providers when a scene uses them. Catch and Gym compile as illustrations without Planck or the full SceneController. The measured Catch runtime was approximately 180 KB minified / 60 KB gzip, excluding embedded scene JSON. General rendering code is still shared; this is not minimal per-shape compilation or physics baking.

## Measured evidence

The local Edge tests compare SVG and Canvas geometry, pixels and actual gestures. Across the sampled scenes, the largest mean channel difference was 1.319 on a 0–255 scale, with at most 0.049% of pixels differing by more than 70 in any channel. A separate opaque crossing-triangle fixture verifies per-pixel depth and picking.

Mesh evaluation dominates the crowded workload. One/four/sixteen simplified Atlas bodies took median 6.0/18.8/84.6 ms to evaluate; Canvas drawing added 1.2/1.3/5.3 ms. The sixteen-actor workload omits garment/decal meshes consistently to stay inside the existing mesh budget. It does not demonstrate sixteen complete physical avatars at 60 fps. [Renderer evidence and limits](renderers.md).

For ten Campfire seeks with actor graphs, warm checkpoints reduced local p50 from 54.9 to 30.4 ms and p95 from 77.4 to 34.6 ms. Thirty snapshots accounted for about 3.3 MB. Cold seeks still replay; physical solver state is excluded. [Checkpoint evidence](checkpoints.md).

Catch's saved seed `20260917`, sampled through 35 seconds, produces catches, misses, bounces, real pickups and return throws. Full/lightweight/worker playback agrees; standalone compiled export agrees within 1e-8 numeric rounding between Node and Edge. Same-engine cached replay comparisons are exact. Screenshots include the gallery, eight sampled states, desktop/mobile Studio and exported playback.

Final verification: 404 unit tests passed, TypeScript checks passed, and the production build passed. The built-site browser check verified the Catch gallery, saved SVG/Canvas switching, Campfire decision editing and mobile layout. Verification commands and generated artifacts are kept in each feature guide. Browser regressions cover Campfire social/handoff behavior, Gym contacts/actions/water memory, Bottle touch/phone inputs and fluid parity, scene tools, connected mesh export, scoped decisions, new panels, scroll adapters, reduced motion and disposal. No physical-phone performance measurement was performed.

## Deliberate boundaries

- Canvas rejects projected shadows/reflections and editor guides. The depth-buffer experiment accepts a restricted opaque mesh scene; it is not a production GPU renderer. Moving evaluation to a worker, transparent depth compositing and full renderer parity remain optimization work.
- Shared dynamics support circles and static rectangles, with bounded substeps. Actor collisions are a bridge to independent ragdoll worlds. General polygon bodies, articulated avatar collisions and automatic full-body contact planning are not implemented.
- Catch respects blocking boxes and character spacing but does not navigate around arbitrary obstacles or predict ricochets. Blocked retrieval reports and retries instead of snapping an object into a hand. Ragdoll dives remain a later variant.
- Actor graphs expose reusable decisions and cooking thresholds. Campfire social attention, sharing choreography and locomotion remain reusable built-in mechanics. A complete user-authored social action planner is not claimed.
- Gym's connected mesh/correctives and authored asymmetric actions remain the base. Motion layers add small strain/breathing changes; they do not solve anatomy or simulate muscles.
- Film/audio editing, dialogue, frame-accurate movie export, unrestricted procedural algorithms and physical checkpoint baking remain in the wider Studio roadmap.
