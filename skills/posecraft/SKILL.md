---
name: posecraft
description: Author, validate, preview, and embed Posecraft 2D scenes using this repository's shared scene SDK and CLI. Use for Posecraft character packs, animation tracks, state inputs, studio projects, or React embedding.
---

# Posecraft

Read [the API](../../docs/api.md) for document fields, supported features, and runtime ownership. Use [Ona](../../examples/characters/ona.json) as a working scene. Keep artwork provenance and license notices with reused assets.

Run these commands from the repository root:

```sh
node tools/cli.mjs capabilities
node tools/cli.mjs inspect examples/characters/ona.json
node tools/cli.mjs validate examples/characters/ona.json
node tools/cli.mjs preview examples/characters/ona.json preview.svg 0.5
```

Make edits through `DocumentStore.transact` or `posecraft edit`. A transaction file contains `expectedRevision` and `commands`. Operations are `set` with an array path and JSON value. Use the revision from `inspect`; a conflict means reread before editing. Write the result to a separate output path to retain rollback. Validate and render that result, inspect the SVG, and open its JSON in Studio. Studio and agents use the same validation and command implementation.

```json
{"expectedRevision":0,"commands":[{"op":"set","path":["actors",0,"appearance","clothing"],"value":"#bddae5"}]}
```

Use `simulate` with an ordered scenario file to test input transitions and acceleration. Time is seconds, angles are degrees, coordinates are SVG units. Host acceleration is CSS pixels per second squared. The simulation step is 1/120 second. Report capability gaps instead of inventing data fields that the runtime will ignore.

The JSON runtime accepts structured path geometry, not raw SVG markup or scripts. Portable Ona, wwwzard, seated Rusty, and original Dummy scenes are in `examples/characters/`. Read their declared input options before setting action, emotion, or hair. Persist defaults per instance in `actor.inputs`; use `actor.appearance` for colors. wwwzard uses rigid sleeves in Studio; its separate trusted-code demo retains procedural cloth. Ona has shoulder articulation; elbow/palm IK and Rusty locomotion are not implemented. When tightening a joint limit, clamp affected rotation keys in the same transaction. Use `previewClip` to inspect an authored key independently of the live state-machine clock. Keep Ukis application records, navigation, and modal choreography outside this repository. Changes to consumers and public publication follow the user's requested scope.

For physical modes, facial response states, sound effects, and scenario events, read [reactions](../../docs/reactions.md). Physical profiles use collision boxes and bounded protective targets; clamp `physics.responses` when tightening joint limits. Distinguish physical mode changes, which preserve momentum, from Animated mode, which returns to the authored pose. Treat curl/hold-self as a pose, not a grip constraint. Audio is a separate optional adapter that starts from a user gesture.

For static props, use the `props` fields in the API. Collision boxes have local offsets and rotate with their visible rectangle. Keep starting collision boxes clear of physical characters. Validate, render with `colliders: true`, and simulate the intended fall. Inspect contact `surface` IDs to prove a prop was hit. Props are static during playback; do not promise moving attachments or dynamic prop bodies.

Read [performance](../../docs/performance.md) for the worker boundary and routing limits. Browser controllers default to queued commands and cached snapshots; use the synchronous scene controller for CLI verification. Cancel obsolete path requests. Do not describe static-obstacle routes as walking or crowd avoidance. Preserve one in-flight simulation batch, bounded work, and worker termination on disposal.

For multi-scene sequences, read [Director](../../docs/director.md). Use `posecraft/episode` and the `episode-validate`, `episode-inspect`, and `episode-preview` CLI commands. Keep source frames/timestamps separate from reusable assets, shot keys, and seeded motion recipes. Compare intermediate frames before replacing keys with a procedural rule. Do not promise pixel-perfect reconstruction, automated tracing, lip sync, or movie encoding. Episode playback samples authored animation; interactive physics must be baked by a future pipeline.

For webcam takes, read [capture](../../docs/capture.md). Use `posecraft/performance` to validate, sample and apply numeric performance takes. Keep camera acquisition behind an explicit UI action; automated tests use fixtures or simulated streams. Preserve the single in-flight bitmap, same-origin asset-only fetch policy, and camera/worker cleanup. Retarget only supported joints and keep the distinction between continuous rotation, discrete facial drawings, gesture labels and unimplemented finger/body capture. After applying a take, validate the episode and inspect both the captured interval and surrounding frames.

For ready-made multi-character examples, use `createDemo(id)` and `demoCatalog` from `examples/showcase.js`; see [demos](../../docs/demos.md). The factory returns independent scene or episode documents. Gallery editor copies use separate local storage. Preserve that isolation when adding presets, and run the demo validation and browser checks before publishing another gallery entry.

For assisted get-up and walking, use `behavior.autoRecover` and `walkTo(actor, sceneX)` as documented in [reactions](../../docs/reactions.md#assisted-get-up-and-walking). Keep the distinction between authored assistance and physical balance. Walk commands need standing actors and clear supported routes; blocked recovery stays in place. Phone input is an explicit opt-in adapter, separate from host position sampling. Use synthetic sensor events for automated tests, and disable sensors on pause, hide, switching demos and disposal.

For turns, foreshortening and front/back overlap, read [spatial rigs](../../docs/spatial.md). Use the opt-in study packs before modifying original artwork. Keep morph paths topologically identical, choose valid clip masks, and inspect front, both profiles, both rear quarters and back. Depth keys change layer order without detaching joint anchors. Yaw/pitch move connected bones in depth. Projection is visual only; do not describe it as 3D collisions or a finished turnaround sheet. Save keys through the same validated scene API, and inspect combined turn/bend poses as well as isolated controls.
