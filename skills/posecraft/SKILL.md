---
name: posecraft
description: Author, validate, preview, and embed Posecraft 2D scenes using this repository's shared scene SDK and CLI. Use for Posecraft character packs, animation tracks, state inputs, studio projects, or React embedding.
---

# Posecraft

Read [the API](../../docs/api.md) for document fields, supported features, and runtime ownership. Use [Ona](../../examples/ona.posecraft.json) as a working scene. Keep artwork provenance and license notices with reused assets.

Run these commands from the repository root:

```sh
node tools/cli.mjs capabilities
node tools/cli.mjs inspect examples/ona.posecraft.json
node tools/cli.mjs validate examples/ona.posecraft.json
node tools/cli.mjs preview examples/ona.posecraft.json preview.svg 0.5
```

Make edits through `DocumentStore.transact` or `posecraft edit`. A transaction file contains `expectedRevision` and `commands`. Operations are `set` with an array path and JSON value. Use the revision from `inspect`; a conflict means reread before editing. Write the result to a separate output path to retain rollback. Validate and render that result, inspect the SVG, and open its JSON in Studio. Studio and agents use the same validation and command implementation.

```json
{"expectedRevision":0,"commands":[{"op":"set","path":["actors",0,"appearance","clothing"],"value":"#bddae5"}]}
```

Use `simulate` with an ordered scenario file to test input transitions and acceleration. Time is seconds, angles are degrees, coordinates are SVG units. Host acceleration is CSS pixels per second squared. The simulation step is 1/120 second. Report capability gaps instead of inventing data fields that the runtime will ignore.

The JSON runtime accepts structured path geometry, not raw SVG markup or scripts. The existing wwwzard example is trusted code and has not yet been converted into a portable pack. Ona has shoulder articulation, not elbow or palm IK. Keep Ukis application records, navigation, and modal choreography outside this repository. Changes to consumers and public publication follow the user's requested scope.
