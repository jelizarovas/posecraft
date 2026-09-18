# Agent authoring and diagnostics

Agents and other clients can inspect a scene, propose supported edits, preview the candidate, then apply it to a new file. The authoring functions use the same `DocumentStore` transactions and scene validator as Studio. Scenes remain JSON data; none of these operations evaluates code stored in a scene.

## Shared API

`src/agent-authoring.js` exports:

- `inspectScene(document)` lists actors, joints, inputs, clips, contacts, interactions and diagnostics.
- `diagnoseScene(document)` returns validation errors and conservative authoring warnings.
- `proposeSceneEdit(document, {expectedRevision, operations})` produces a reviewable proposal without changing the document.
- `applySceneProposal(document, proposal)` returns the validated document at the next revision. A stale revision fails before editing.

Supported semantic operations are `create-clip`, `create-contact`, and `create-interaction`. Creation refuses an existing ID. Clip tracks and contact/interaction values use the ordinary schema. A builder does not generate gait, discover inverse-kinematics targets, or infer a new behavior graph.

For example, save this request as `request.json`:

```json
{
  "expectedRevision": 0,
  "operations": [{
    "type": "create-clip",
    "pack": "drawing",
    "id": "wave",
    "duration": 1,
    "loop": false,
    "tracks": {"root.rotation": [[0, 0], [0.5, 20], [1, 0]]}
  }]
}
```

The pack and joint must exist in the scene. To create a contact or pointer binding, use `{ "type": "create-contact", "value": ... }` or `{ "type": "create-interaction", "value": ... }`, with a complete [contact](contacts.md) or [pointer interaction](live-scenes.md). Up to 16 operations form one atomic transaction. All commands and a human-readable summary are included in the proposal. Invalid data rejects the whole proposal.

## CLI workflow

Run from the project directory. Paths must remain inside that directory; use the MCP server's explicit root for a different workspace.

```text
node tools/cli.mjs agent-inspect scene.json
node tools/cli.mjs agent-propose scene.json request.json proposal.json
node tools/cli.mjs agent-validate scene.json proposal.json
node tools/cli.mjs agent-preview scene.json preview.png 0 proposal.json
node tools/cli.mjs agent-apply scene.json proposal.json edited.json
node tools/cli.mjs agent-simulate edited.json scenario.json
```

File proposals bind the transaction to both the source revision and its SHA-256 content hash. Reformatting or changing the source after proposing requires a new proposal. Apply writes a new output file and never overwrites the source, proposal, or an existing output. The completed file is linked into place only after its temporary content has been written. Errors remove the temporary file. Existing low-level `edit` remains available, but also refuses an existing output.

A simulation request can contain `duration` from 0 to 60 seconds, `samples` from 1 to 120, and up to 256 ordered events. Events have a `time` and one supported `type`:

| Type | Other fields |
| --- | --- |
| `input` | `actor`, `name`, `value` |
| `variable` | `name`, `value` |
| `event` | `event`, optional `payload` |
| `pointer` | `command`, using the saved pointer binding API |
| `object` | `command`, using the shared-object API |
| `acceleration` | `ax`, `ay`, each within −6,000..6,000 |
| `interaction` | `actor`, `interaction`, optional `strength` |
| `behavior` | `actor`, `value`, using supported behavior settings |

Inputs are processed at fixed simulation ticks. The result records sampled states, contact errors, the final frame and up to 512 runtime events. For a specific authored clip, supply `preview: {actor, clip, time}` through MCP or the service API. This changes the returned preview after simulation; it does not rewrite the scene or trigger the clip's behavior graph.

Static diagnostics report schema errors, structurally unreachable states, very rapid non-step track changes, and large loop seams. Explicit step keys are treated as authored holds, not accidental curve discontinuities. Reachability does not prove conditions are satisfiable. Simulation reports contacts exceeding 0.5 scene units and invalid or separated active object grips; it is a bounded sample, not a proof that every possible interaction succeeds.

## Local MCP server

Start the actual stdio server with:

```text
node C:/apps/posecraft/tools/mcp-agent.mjs --root C:/apps/posecraft
```

Configure an MCP client to launch that command and those arguments. No HTTP listener or account is required. The server implements newline-delimited JSON-RPC, `initialize`, `tools/list` and `tools/call`, and exposes `posecraft_inspect`, `posecraft_propose`, `posecraft_validate`, `posecraft_apply`, `posecraft_simulate`, and `posecraft_preview`. Inspect the published tool schemas for arguments. A PNG preview returns the image as well as its saved path.

All reads and writes stay under the configured root, including resolved directory links. JSON files are limited to 5 MB; individual MCP requests to 1 MB; the request queue to eight waiting calls. Simulation runs in a worker with a 15-second deadline and a 256 MB old-generation memory limit. PNG capture is limited to 2,048 pixels per side and 4,194,304 pixels total. Raster capture uses the installed Playwright browser, disables page JavaScript, blocks network requests, and has separate launch/render deadlines. Windows uses installed Edge; other platforms need Playwright Chromium. No browser or package is installed automatically.

The raster is a single SVG-rendered frame. Movie export, audio rendering, arbitrary procedural scripts, and unsupported editing operations are outside this API.
