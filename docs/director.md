# Director: scenes, shots, and reference animation

Open [Director](https://jelizarovas.github.io/posecraft/director.html) or choose **Director: scenes and camera** from Studio's More menu. The included original rehearsal has two sets and three shots. Director is a separate workspace so the existing rig, joint-limit, physics, and keyframe editor keeps its layout.

## Working sequence

1. Build characters and props in Character Studio. In Director, choose **Use Studio scene**, or import an exported scene JSON. Each scene is a reusable set. **Copy set** creates an independent scene; multiple shots otherwise refer to the same set.
2. Add or duplicate shots, choose their scene, set durations, and reorder them. The episode timeline uses seconds and a selectable frame rate. Shots currently use hard cuts.
3. In **Camera**, drag the preview to pan or scroll to zoom. Set camera center, zoom, and rotation, then **Key camera here**. Scrub to another frame and add another key. Interpolation can be smooth, linear, or held until the next key.
4. In **Motion**, choose an actor, action clip, expression, speed, and clip offset. Body-part rotation keys override that actor's pose for this shot. In **Place**, key the actor's position, scale, and rotation independently of the camera. Use Studio for full rig and source-clip editing.
5. Add periodic sway or smooth seeded noise to a joint's rotation. Amplitude, frequency, and seed are explicit. Identical inputs give identical movement at the same time. **Bake layer to rotation keys** samples the layer at the episode frame rate, preserves the resulting constrained pose, and removes the procedural layer. The source clip is not changed.
6. In **Reference**, load a local video or image. Seek to a source time and **Use video frame**. Adjust overlay opacity, or enable the difference view to compare composition and silhouettes. **Export PNG** saves a captured video frame. Imported JPEG/WebP images retain their format when exported.
7. Save the episode JSON and export its reference images alongside it. The top download icon exports the currently rendered composition as SVG. The CLI can render any episode time without opening the browser.

Camera changes remain a draft until keyed. Source images and captured frames are alignment references; they do not become runtime character geometry automatically. Video and images stay in the browser. Captured frames are stored in IndexedDB, while the episode stores a reference ID, filename, and source timestamp. Reopening on the same browser restores the image. Moving the JSON to another device requires reopening the corresponding reference image there.

Capture uses the browser's decoded video frame and its presentation timestamp when available. This follows [MDN's video-frame callback guidance](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback). Codec support and seeking precision depend on the browser. Captures larger than 2048 pixels on their longest edge are downscaled, so use original source frames externally when comparing at a higher production resolution. The reference panel captures individual frames, not an automatic full-episode frame dump.

## From an excerpt to a reconstruction

A reference-driven workflow should retain four distinct forms of data:

| Data | Purpose |
| --- | --- |
| Source frame and timestamp | Ground truth for a particular shot and time |
| Reusable set and character assets | Geometry, colors, draw order, pivots, and limits |
| Shot keys | Camera composition, actor placement, poses, and expression timing |
| Procedural motion recipe | A named rule with amplitude, frequency, phase or seed, then optional baked keys |

For flat cutout animation, the first useful reconstruction is a short shot with a fixed camera and few characters. Match the background and silhouettes first, then facial features and layer order. Track a few recognizable points across additional frames to separate camera motion from actor motion. Two screenshots do not uniquely identify the movement between them. Check intermediate frames and repeated cycles before deciding whether a motion is a tween, a held drawing, a repeating cycle, or a noisy variation.

Noise belongs only where the reference supports it. A held pose should stay held. Mouth changes and blinks usually need discrete timing, while a head tilt can be interpolated. An algorithmic description should include its parameters and seed, plus the reference frames used to check it. Baking gives an editor a way to correct individual frames after fitting a rule.

Exact pixel matching still requires matching geometry, framing, antialiasing, output resolution, and color handling. The difference overlay helps visual inspection; it is not an automated pixel-error score or a guarantee of a pixel-perfect reconstruction. Posecraft does not yet extract reusable rigs or motion algorithms from footage.

## Episode API

```js
import { EpisodeController, assertEpisode } from 'posecraft/episode';
import { renderSVG } from 'posecraft/svg';

const project = assertEpisode(JSON.parse(source));
const episode = new EpisodeController(project);
const frame = episode.frame(4.5);
const svg = renderSVG(project.scenes[frame.scene], frame);
const keys = episode.bakeMotion('hello', 'ona');
```

An episode has `schemaVersion: 1`, `kind: 'episode'`, ID, name, revision, output `size`, `fps`, a `scenes` map of existing scene documents, and an ordered `shots` array. `episodeDuration` sums shot lengths. At a cut boundary the next shot wins; the episode endpoint samples the last shot's endpoint. Sampling is absolute and independent of the order frames are requested.

A shot contains an ID, name, scene ID, duration, and camera tracks for `x`, `y`, `zoom`, and `rotation`. Track keys use the existing `[seconds, value, easing?]` form; time is local to that shot. Actor cues are keyed by actor ID and contain `clip`, `offset`, `speed`, optional `emotion`, optional `placement` tracks, optional joint-rotation `pose` tracks, and optional `motion`. A procedural layer contains `kind: 'sway' | 'noise'`, a joint, channel, amplitude, frequency, and integer seed. The SDK supports rotation and joint X/Y layers; Director's current controls and bake operation expose rotation.

Sampling applies the clip, expressions, shot pose keys, procedural addition, and then joint limits. Actor placement and camera transforms are independent. The camera uses scene-space center coordinates, degrees of rotation, and zoom relative to the output width. The output aspect ratio determines the crop. References are excluded from rendered SVG exports.

```sh
node tools/cli.mjs episode-validate episode.json
node tools/cli.mjs episode-inspect episode.json
node tools/cli.mjs episode-preview episode.json frame.svg 4.5
```

Director evaluates frames in one dedicated worker, retaining one in-flight request and only the latest requested time. Scrubbing does not replay previous shots or run physics for every earlier frame. Static document editing and SVG rendering stay on the UI thread. Existing `kind: 'scene'` documents and their runtime remain compatible.

Limits are 32 scenes, 120 shots, two hours total, 600 seconds per shot, 20 MB per episode, and 2000 keys per track. Bake shorter portions when a shot would exceed the key limit. Frame rates are 12, 24, 25, 30, or 60 fps. The editor retains ten undo states. Media upload limits are 500 MB for local video and 20 MB for reference images.

## Remaining production work

Director currently samples authored clips and deterministic motion layers. It does not simulate ragdoll, protection, or pathfinding during episode playback. Those systems remain in Studio and the interactive runtime; a future bake pipeline can turn their output into shot keys.

Automatic shot detection, batch reference extraction, asset segmentation/tracing/generation, camera tracking, motion fitting, dialogue tracks, lip sync, audio mixing, transitions beyond cuts, and encoded movie export are not implemented. Recreating a full episode is a production workflow to build on this foundation, not an existing one-click operation.

`npm run test:director` verifies camera/placement keys, scene reuse, shot copies, undo/redo, motion baking, local video capture, reference persistence, file round trips, and compact desktop/mobile controls. Runtime tests verify cut boundaries, random-access sampling, seed repeatability, constrained baking, and invalid imports.

## Webcam performance

Use **Perform** to calibrate, rehearse, record and review camera-driven acting. Apply a take at the playhead to create pose and expression keys. **Motion → Expression key** edits facial timing at the selected frame. Read [webcam capture](capture.md) for rig support, privacy, limits and the take API. Actor cues accept optional `expressions: [[seconds, emotion], ...]`; the values are held until the next key.
