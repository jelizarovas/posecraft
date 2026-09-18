# Native 3D Studio

Open `native-studio.html` for the bench movement editor. It uses a separate native project format; it does not convert existing 2D scenes or replace the character timeline. The first multi-angle review fixed bench intersections, turn poles and hand grips. The [review record](native-3d-review.md) lists remaining limits; this is not a general production character system.

## Author a study

1. In **Character**, select Athlete A or Athlete B and set height in meters.
2. In **Bench**, set floor position, facing, furniture scale and rack height. The movement is rebuilt from the character's proportions and the furniture transform. A rejected fit leaves the previous project and preview intact.
3. In **Movement**, set repetitions, effort, tempo and optional elbow/knee bend limits. Scrub or play the approach, sit, recline, grip, press, rerack and rise sequence. **Finish safely** asks the held-bar action to complete its current segment and continue through rerack, release and rise. It does not stop or reverse the pose immediately; during the approach, use Pause or Restart. Restart restores the full sequence. This temporary playback choice is not saved in project JSON. Contact diagnostics report positional error in meters internally and millimeters in the inspector; they are not force or muscle measurements.
4. Orbit and zoom the stage, then choose **Camera → Save current view** to persist that view. The three view presets also save camera edits. All cameras are orthographic, including the three-quarter view.
5. Use **Save** to download project JSON, **Open** to reopen it, and **Undo/Redo** for session edits. The current draft also saves under `posecraft.native3d.v1` in this browser. Custom character bytes are not included in that draft.

**Website** downloads one self-contained HTML file containing the selected catalog GLB, project and bundled native player. This requires the built Studio, which supplies `runtime/native-three-player.js`; a source-only development server does not supply that export bundle. The saved camera and action settings drive the same native evaluator. The exported player requires WebGL and includes orbit controls and playback. Its motion worker is embedded too. Offscreen or hidden playback suspends, and reduced-motion preference starts paused.

## Project and renderer APIs

`src/bench-project-3d.js` exports `createBenchProject3D()`, `validateBenchProject3D(value)`, `assertBenchProject3D(value)` and `BenchProject3DStore`. A project is plain JSON:

```js
{
  kind: 'bench-study3d', version: 1, name: 'Bench movement study',
  character: {asset: 'athlete', height: 1.75},
  bench: {position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: 1, rackHeight: 1},
  camera: {position: [3, 2.2, 3.4], target: [0, .85, 0], height: 3.6},
  settings: {reps: 3, effort: .6, tempo: 1}
}
```

The study's floor plane shares the bench-origin height. Positions are meters, Y is up, and rotations are unit XYZW quaternions. The bench origin is floor center; local +Z is its foot end. Rack height is local, defaults to 1 meter when omitted, and follows furniture scale. Height is .9–2.4m, furniture scale .5–2, rack height .65–1.5m, repetitions 1–12, effort 0–1 and tempo .25–3. Optional `settings.elbowMax` and `settings.kneeMax` are 20–175 degrees, defaulting to 170. The action also respects the rig’s authored maximum, so project settings can only narrow that range. These syntax limits do not guarantee a reachable physical arrangement. Tilted benches and impossible fits can also be rejected by action construction.

The store returns independent snapshots, retains at most 60 undo steps and rejects stale `replace(project, expectedRevision)` calls. Internal revisions are not saved in project JSON. Unknown fields, nonfinite values, malformed quaternions, accessors and oversized structures are rejected. File import is limited to 64KB and validation to 512 data nodes.

`createNativeThreeView(canvas, {...project, assetUrl?})` from `src/native-three-view.js` is asynchronous. Its result provides async `setProject(project)`, deterministic `sample(time)`, `render(time)`, `cameraState()`, `stats()`, `exportHTML(project)` and `dispose()`, plus `duration`, `action`, `character` and the last `frame`. The view owns Three.js rendering, character loading and action evaluation. Live playback uses `renderAsync(time)` to evaluate motion in an embedded dedicated Web Worker. Scrubbing uses the identical action locally. `finishSafely(time)` selects recovery playback and `resetMovement()` restores the original sequence. `stats().motionWorker` reports whether worker evaluation is available; startup failure falls back to local evaluation and records `workerError`. Call `dispose()` when removing it. `setProject` prepares and validates a replacement action before replacing the active one.

## Assets and import boundaries

The catalog models are Quaternius **Universal Base Characters Standard** Superhero Male and Superhero Female. The stable `regular.glb` filename refers to the female superhero model, not the paid Regular body. They contain independently authored proportions, weighted meshes, fingers and original PBR materials. They have no supplied animation clips or facial morph targets.

The original license is CC0. See the [asset provenance and processing notes](../public/assets/native-3d/README.md), [source manifest](../public/assets/native-3d/provenance.json) and [preserved license](../public/assets/native-3d/LICENSE-Quaternius.txt). The importer uses skin weights and inverse bind matrices from these assets; the procedural action supplies poses.

**Import rigged GLB** accepts a compatible humanoid GLB 2 file up to 25MB. It is a session-only preview. Saving JSON retains the catalog choice, reopening JSON returns to that catalog character, and website export is disabled while a custom import is active. Other skeleton naming or missing role mappings can be rejected. This is not a portable asset package or a general rig editor.

## Scope and checks

This editor authors one bench study, not arbitrary scenes or motion clips. The action uses geometric contact constraints; it does not simulate load, muscle strength, whole-body collision, balance recovery or physical support. An error-free contact result does not establish convincing movement or skin deformation. Equipment and skeleton placement must still be reviewed continuously from several views.

`test/bench-project-3d.test.js` checks validation, isolated snapshots, stale edits and bounded undo. `test/native-studio-browser.mjs` checks actual editor changes, undo/redo, save/reload, failed imports preserving the draft, the two catalog characters and compact layouts. These are functional checks. The [quality reset acceptance plan](engine-quality-reset.md) remains applicable.
