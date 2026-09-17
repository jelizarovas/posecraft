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

The JSON runtime accepts structured path geometry, not raw SVG markup or scripts. Portable Ona, wwwzard, and seated Rusty scenes are in `examples/characters/`. Read their declared input options before setting action, emotion, or hair. Persist defaults per instance in `actor.inputs`; use `actor.appearance` for colors. wwwzard uses rigid sleeves in Studio; its separate trusted-code demo retains procedural cloth. Ona has shoulder articulation; elbow/palm IK and Rusty locomotion are not implemented. When tightening a joint limit, clamp affected rotation keys in the same transaction. Use `previewClip` to inspect an authored key independently of the live state-machine clock. Keep Ukis application records, navigation, and modal choreography outside this repository. Changes to consumers and public publication follow the user's requested scope.

For physical modes, facial response states, sound effects, and scenario events, read [reactions](../../docs/reactions.md). Physical profiles use collision boxes and bounded protective targets; clamp `physics.responses` when tightening joint limits. Distinguish physical mode changes, which preserve momentum, from Animated mode, which returns to the authored pose. Treat curl/hold-self as a pose, not a grip constraint. Audio is a separate optional adapter that starts from a user gesture.
