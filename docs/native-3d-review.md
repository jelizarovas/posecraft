# Native bench implementation and review

September 18, 2026.

## Implemented path

`native-studio.html` connects authored GLB assets to a native meter-scale rig, a reusable bench action, GPU skinning, worker playback and a self-contained website export. The renderer displays the solved pose. It does not infer Atlas anatomy from screen coordinates or stretch bones to make a grip fit.

The Quaternius Superhero Male and Female use their original mesh topology, skin weights and inverse bind matrices. They are separate authored bodies, with different hand and limb proportions. Texture sizes were reduced for delivery. The creator, original CC0 license, download location, processing and hashes are retained beside the assets.

The action measures the supplied rig and uses the bench's frame and rack height. Its sequence covers approach, stepped turn, sit, recline, grasp, unrack, variable-duration repetitions, rerack, release and rise. Named palm frames provide wrist targets; authored finger rotations close the hands. Both supported grips remain attached to the same rigid bar. A fit outside the rig's reach produces a diagnostic or rejects the edit.

The editor exposes character selection and height, furniture placement/scale/rack height, camera placement, repetitions, effort, tempo and elbow/knee bend maxima. Undo, JSON save/reopen and autosave preserve these settings. Safe finishing completes the held segment before reracking; it is a playback choice, not a saved event graph.

## What the review caught

The first valid numeric poses still failed visual inspection. The knees crossed the bench pad, the feet intersected the base, the free hands kept their T-pose orientation and the grasp aligned wrists rather than palms. The turn also contained an elbow-pole discontinuity. These were fixed in rig/action data and evaluation, not with renderer offsets.

Follow-up pose reviews covered approach, seated transition, reclining, gripping, pressing, release and rising from the three-quarter, side and front views. Hand close-ups included the opposite and overhead views, both male hands and the smaller female hand. The initial finger loop was too loose, so its closure and palm frame were recalibrated. This remains an authored hand pose, not a finger collision simulation.

These reviews establish a usable engineering study. They do not establish final Atlas art direction, animator approval of every transition, or competitive superiority. The source bodies have no facial morph targets or supplied motion clips. The procedural sequence still needs professional movement review before being treated as a production animation reference.

## Reproducible checks

- `npm run test:native-3d` covers rig geometry, malformed scene/project input, transformed targets, fixed lengths, actual imported skin/bone parity, both body proportions, palm contacts, interruptions and the worker client's bounded queue.
- `test/native-action-worker-browser.mjs` compares real worker frames with local sampling through 15 time points, changed furniture, safe completion, reset and failure recovery. Rapid requests retain only the active and latest queued sample.
- `test/native-studio-browser.mjs` edits the actual UI, checks undo/redo, save/reload, rejected imports, both models, bend limits, safe completion and compact layouts.
- `test/native-export-browser.mjs` edits and rotates the bench, samples all action phases, changes the camera, downloads the website and compares its world skeleton and bar against Studio. It checks embedded worker startup, playback, reload, GPU-resource reuse and the absence of external runtime/asset requests.
- `npm run test:types`, `npm run build` and the complete existing unit suite cover package integration and the retained 2D path.

Browser reports and screenshots are written to ignored `test-results/`. Run the editor/export tests against a built preview. The standalone worker test runs against the development server because it imports source modules.

## Performance scope

The selected character is approximately 1.6 or 1.8 MB. The website export includes only that character, the native player and its motion worker; it does not import the legacy gym choreography or Planck physics. It currently costs about 2.9 MB as an uncompressed, self-contained HTML file. A normal hosted asset can benefit from browser caching; a downloaded single file trades that separation for portability.

Live motion evaluates in a dedicated Web Worker. Scrubbing runs the same sampler locally. Rendering and skin updates remain on the main thread. Hidden/offscreen exported playback suspends, and reduced-motion preference starts paused. Worker failure is reported in view statistics and falls back to local evaluation.

The solver now evaluates only the active chain and its ancestors during IK, then produces the full solved skeleton once. A before/after comparison matched 1,838 complete frames exactly. `test/bench-action-performance.mjs` alternates full and sparse evaluation: on Node 22 / Windows, median CPU sampling was 1.231 to .724 ms for Athlete A and 1.264 to .755 ms for Athlete B. This measures motion sampling only.

`test/native-bench-performance.mjs` measures the full imported skeleton's headless action at 1, 4 and 16 instances. It excludes rendering, worker transfer, decoding, collisions and device power. Its results must not be presented as mobile frame rate or battery measurements. The recorded optimized run measured .76 / 2.51 / 8.49 ms median for 1 / 4 / 16 rigs, with p95 1.70 / 3.90 / 12.99 ms. Physical-phone and sustained multi-character GPU measurements remain outstanding.

## Remaining boundaries

This is a focused native bench project format, separate from legacy 2D scene documents. It does not yet author arbitrary 3D scenes, keyframe curves, facial performances, navigation or general behavior graphs. Custom compatible GLB import is a session preview; those bytes are not yet saved into portable projects or website exports.

The contact solver enforces rigid lengths and middle-joint bend limits. It is not a simultaneous balance/collision solver, and does not impose shoulder cones, wrist twist limits or physical muscle forces. Clearance in the bench action uses explicit support geometry and limb targets rather than whole-mesh collision handling. Preparation before taking the bar has no automatic recovery route; it can be paused or restarted. These limits remain part of the quality reset, not completed features.
