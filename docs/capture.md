# Acting with a webcam

Open [Director](https://jelizarovas.github.io/posecraft/director.html) and choose **Perform**.

1. Select an actor and put the episode playhead where the take should begin.
2. Choose **Enable camera** and grant camera access. Face forward with relaxed arms, then choose **Calibrate neutral**. Keep your face and hands in view with even lighting.
3. Rehearse against the live avatar. Tilt your head, raise your hands, turn your wrists, smile, wink, close your eyes or open your mouth. Choose **Record**, act, then **Stop recording**. Takes stop at 30 seconds.
4. Turn the camera off and use **Play take** or the take slider to review. **Save take** exports animation data as JSON. **Open take** validates a saved take against the selected rig.
5. **Apply at playhead** bakes the take into that actor's rotation and expression tracks in the selected shot. It truncates at the shot boundary. Undo restores the previous shot. In **Motion**, select a body part and correct its rotation at a frame. Changing **Expression key** keys that expression at the playhead; **Clear face keys** returns to a single expression.

The camera preview is mirrored. Inference uses the original image and converts handedness for an unmirrored source. Calibration stores neutral head roll and visible wrist positions. Arm lifts are estimated from wrist height; this is not shoulder/elbow/body motion capture. Recalibrate after moving the camera or changing your position.

Ona records head tilt and arm lifts. Dummy and wwwzard also have wrist rotation channels. Rusty records head tilt and expressions; it has no human arm rig. Open, fist, point and pinch are geometric labels in take metadata. The current rigs do not articulate fingers. Face blendshapes become discrete neutral, happy, surprised, sleepy, wink, angry or sad drawings. These labels select artwork; they do not identify a person's internal emotional state. Head rotation remains continuous. Tracking loss eases joints toward their rest pose and selects the neutral expression.

## Local processing and performance

Camera access only starts from the Enable camera button. No microphone is requested. Camera frames are transferred to a dedicated vision worker, processed, and closed. They are not retained in takes, reference storage or exported episodes. The SDK's fetch boundary permits only same-origin GET requests, blocking its usage telemetry. The first session downloads about 24 MB of self-hosted, pinned model/WASM assets. Normal browser caching can reuse them later.

The camera stops when you turn it off, leave Perform, change actor/shot/rig, hide or close the page, or encounter a tracking failure. A camera permission request canceled before it resolves also releases any eventual stream. Returning to Perform does not reopen the camera. Takes remain in memory until saved or applied. Camera permission still depends on the browser and requires HTTPS or localhost.

Tracking uses CPU inference in its own worker, at most 15 input frames per second, scaled to fit 640 by 480 pixels. There is one bitmap in flight and no frame backlog. Slower devices capture fewer samples. The model can miss motion under occlusion or poor lighting. This MVP has been tested in desktop Edge with prerecorded images and a simulated camera stream, not with the user's physical webcam or on mobile hardware.

Applying a take also runs in a worker. It samples the affected rotation channels across the shot at the episode frame rate, preserving the original poses outside the take at those frames. Conflicting procedural rotation layers are baked before removal. Unaffected channels remain unchanged. Expressions use held keys. A shot must fit within 2000 keys per channel, approximately 83 seconds at 24 fps or 33 seconds at 60 fps. Reduce the shot duration if baking reaches that limit. Interpolated between-frame values may differ from the original clip.

## Take API

```js
import { PerformanceRetargeter, assertTake, sampleTake, applyTake } from 'posecraft/performance';
import { assertEpisode } from 'posecraft/episode';

const take = assertTake(JSON.parse(takeSource), pack);
const preview = sampleTake(take, 0.5);
const next = structuredClone(episode);
applyTake(next, 'hello', 'ona', take, 0.25);
assertEpisode(next); // Commit through the host's undo/history mechanism.
```

A take contains `schemaVersion: 1`, `kind: 'performance-take'`, `duration` in seconds and ordered `frames`. Every frame has `time`, a `pose` map of absolute `joint.rotation` values, and an `emotion` string supported by the rig. Frames may also retain `face` tracking presence and `gestures` labels. Both endpoints are required; at most 1000 frames and 30 seconds are accepted. All frames must have identical rotation channels within joint limits. Raw video, audio, face meshes and identity data are absent from recorded takes.

`PerformanceRetargeter.calibrate(features)` sets a neutral reference. `sample(features, seconds)` smooths and constrains the rig channels. `performanceFeatures(result)` reduces MediaPipe face landmarks, blendshapes and hand landmarks to the supported controls. `applyTake` mutates a supplied episode and is synchronous in the SDK; Director calls it in its episode worker. The camera controller and tracking worker belong to Studio, so importing the core runtime does not load vision models or request camera access.

Actor cues now accept optional `expressions: [[shotSeconds, emotion], ...]`. These keys are strictly increasing, bounded by shot duration and validated against the pack's emotion options. Each expression is held until the next key. Before the first key, the cue's static emotion or actor input applies.

## Reproducing the checks

Download the official MediaPipe test fixtures into ignored `test-results/`:

- `https://storage.googleapis.com/mediapipe-assets/portrait.jpg` as `vision-face.jpg`
- `https://storage.googleapis.com/mediapipe-assets/right_hands.jpg` as `vision-hands.jpg`

Start the development server on port 5178, then run `npm run test:vision` and `npm run test:capture`. The vision check runs the real face and hand models, and accelerates the SDK telemetry timer to verify no external request occurs. The capture check substitutes a canvas video stream for the camera and records an actual inferred head tilt. It covers export/import, expression edits, applying a take, undo/redo, one frame in flight, stream cleanup, denied permissions, cancellation and compact layouts. `npm test` covers calibration, limits, tracking loss, take validation, exact sampled baking and expression timing. `npm run test:director` covers the existing sequence editor.

Models come from the official [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) and [Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) distributions. The [asset record](../public/vision/README.md) pins source URLs and checksums. The SDK is Apache 2.0; Posecraft's own code remains MIT.
