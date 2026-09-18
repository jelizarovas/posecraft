# Bake physical motion into an editable clip

Open a physical study scene in Studio. Select a character, open **Feel**, and choose a physical **Body mode**. Turn off **Automatic facial responses** if the recording would change expressions: this bake requires constant character inputs throughout its window.

Open **Scene → Motion & website → Bake physics into a clip**. Choose the character, start time, recording length, clip name, sample rate and error tolerances. **Record motion** evaluates a fresh simulation from the saved scene. It does not capture unsaved dragging or pointer gestures from the current preview. Recording can be cancelled.

When recording finishes, review the sample/key counts, measured errors, any widened joint limits and the preview scrubber. The source remains unchanged until **Apply baked motion**. Applying uses one undoable transaction: the character switches to an isolated copied rig and the new animated clip. Its source rig stays in the document, so other characters sharing that rig are unaffected. **Undo** restores the physical setup. If the source changes after recording—even through Undo—the stale result cannot be applied; record again against the current revision.

## API

```js
import {bakeSceneMotion} from 'posecraft/scene-baking';

const result = await bakeSceneMotion(scene, {
  actor: 'loose',
  start: 0,
  duration: 2,
  fps: 30,
  clipId: 'landing-take',
  maxPositionError: 0.5,
  maxAngleError: 0.5,
  signal: abortController.signal,
  onProgress: ({phase, progress}) => {
    // phase: simulate, refine, validate; progress: 0..1 within that phase
  },
});

// Review result.diagnostics and result.document first.
// Use the original revision when applying the returned ordinary commands.
store.transact(result.commands, scene.revision);
```

`result.document` is a validated copy at the next revision. `result.commands` contains ordinary DocumentStore edits. Diagnostics identify the actor, private pack and clip; recording window; evaluated sample/key counts; measured position and angle errors; widened limits; removed contacts; and remaining physical actors.

The optional `events` array accepts ordered controller replay events for character input, behavior, interaction, acceleration and walking. The Studio form records from saved initial conditions; replay-event authoring is available through the API.

## Bounds and supported scenes

Recordings last 0.1–8 seconds, with start and end inside 0–180 seconds. Start and duration round to the 120 Hz simulation grid. Initial sample rates are 15, 24, 30, 60 or 120 fps; adaptive refinement adds samples where needed. Position and angle tolerances each range from 0.01 to 5, measured in scene pixels and degrees. Validation checks every recorded 120 Hz sample, including joint endpoints. It does not bound motion between those samples or promise identical physics across engine versions.

The selected character must have a physical rig and undergo physical or recovery motion in the chosen window. Solver movement is converted back to editable local channels; the process does not merely copy the existing authored pose. Recorded inputs and appearance must stay constant. Selected-actor contacts are removed from the result so they cannot override the baked path; other actors depending on that actor through a contact cause an explicit rejection.

This first bake supports isolated physical study scenes. It rejects scenes with ensemble choreography, fluid, shared objects or Catch, live scene/actor graphs, live placement bindings, additive motion layers, pointer interactions or scroll bindings. Other physical characters can remain in the scene, but only the selected character moves onto the new clip clock. Their timing and the scene lighting remain unchanged.

Work is capped at 961 fixed-step samples, 250,000 scalar samples, 50,000 output keys and 10,000 supplied replay events. Existing scene and clip resource limits also apply. Rejection and cancellation preserve the source document.
