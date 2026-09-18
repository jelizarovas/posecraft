# Atlas 3D comparison

The optional [Atlas comparison page](../atlas-3d.html) draws the gym character in 3D beside its SVG reference. It is a renderer pilot for Atlas and the gym room. It does not convert arbitrary Posecraft artwork into 3D or replace the SVG renderer used by existing projects.

Visual status: the user did not accept this pilot's character quality. The [engine quality reset](engine-quality-reset.md) records the architectural and asset problems to address next. Passing browser checks and the CPU measurements below do not establish animation quality.

Both views receive the same evaluated scene frame. The existing gym clips, joint limits, contact solves, seeded action choices and fatigue variables remain the animation source. The 3D renderer changes how that frame is drawn. A depth buffer can resolve overlapping surfaces, but it cannot repair an incorrect pose, unreachable grip or unsupported body position in the source animation.

The body, shorts and muscle surfaces use Atlas's connected mesh data with GPU joint weights and corrective offsets. Vertex buffers stay fixed during playback; joint matrices and correction strengths change. The head, hair, beard, nose, eyes and shoes use volumetric geometry. Physical depth is used for drawing; SVG layer-order hints do not become physical thickness.

The GPU skin adapter accepts at most 32 joints, four influences per vertex and four corrective drivers per surface. The current Atlas model uses 30 joints. These limits belong to this pilot adapter; they do not replace the general scene validator's limits.

Atlas's original poses encode some depth through drawing order. The 3D adapter reconstructs shoulder, hip, elbow and knee depth while retaining the authored hand and foot positions in the image plane. Bar grips use the room bar's depth plane. This is an Atlas-specific reconstruction with bounded reach adjustment, not a general-purpose 3D rig or physical muscle simulation. Its geometry tests compare the GPU skin with that adapted skeleton; they do not claim every 3D joint is unchanged from the SVG rig.

Room geometry includes equipment and the bottle, which follow the same final joint poses. The mirror is an opaque tinted panel, not a simulated reflection. This implementation is specific to Atlas's rig and room. Some source poses were authored for a screen plane, so a new camera angle may reveal limitations that the SVG view conceals.

Use recorded mode to pause and scrub repeatable poses, then compare them with the SVG view. Live mode runs the existing gym behavior. The pose selector isolates review actions so turns, hanging, bench motion and recovery can be inspected without waiting through a full routine. Review camera and lighting changes separately from movement changes; a different camera can make a bad contact less obvious without fixing it.

## Loading and lifecycle

The 3D implementation is loaded for the comparison page. Existing scene documents remain valid and existing SVG website exports keep their renderer. This pilot is not a new generally supported scene renderer or a promise of 3D export support.

The page must stop animation when paused or hidden and release renderer resources when disposed. Reduced-motion preferences should start the comparison paused; deliberate scrubbing is still available. These controls affect the host playback loop, not the saved gym scene.

## Reading measurements

CPU submission time measures the JavaScript work used to update geometry and submit a draw. It does not measure when the GPU finishes rendering. Draw calls and triangle counts describe submitted work, not frame rate by themselves. The side-by-side page also pays for the SVG reference and shared scene evaluation, so its total frame time is not an isolated 3D renderer benchmark.

Browser tests can establish repeatable poses, finite geometry, working controls, shared frame timing and resource cleanup. Desktop headless results do not establish phone performance, GPU cost, battery use or thermal behavior. Those require measurements on the actual device, with warm-up and sustained playback, and comparison at the same resolution and scene complexity.

## Acceptance checks

- Compare front, profile and back views with limb overlap visible.
- Check one-hand hanging, planted grips, bench setup and walking before judging a polished still.
- Confirm both views use the same clip and time after scrubbing, mode changes and pause/resume.
- Check live variables and activity names rather than replacing live behavior with a renderer-only loop.
- Record console errors, resize behavior and reduced-motion behavior, and review desktop/mobile screenshots.

The test report should identify the browser, viewport, device-pixel ratio, review clip and frame time. No visual-quality or performance claim should rely only on a triangle count or a single screenshot.

Run `node test/atlas-three-browser.mjs` against the production preview at port 5199, or set `POSECRAFT_URL` to another served build. The test checks synchronized frame identifiers, recorded review poses, live state, resource-count stability across repeated scrubs, reduced motion and optional loading. Reports and review screenshots are written to `test-results/atlas-three-*`. Stable resource counts during scrubbing do not prove disposal or absence of every possible memory leak.

`node test/atlas-three-performance.mjs` records a separate performance report. It warms up for 20 delivered frames, then measures 90 updates for each desktop/mobile viewport with the SVG comparison shown and hidden. It reports median and 95th-percentile CPU submission, SVG update, worker simulation and observed delivery intervals. It applies no pass/fail speed threshold. Both viewports run in the same headless desktop browser; the narrow viewport is not a phone benchmark.

The September 18, 2026 run used headless Edge 153.0.4234.46 on Windows with device-pixel ratio 1. These are milliseconds, shown as median / p95:

| Viewport and comparison | 3D CPU submission | SVG update | Worker computation | Observed delivery interval |
| --- | --- | --- | --- | --- |
| 1440 × 1000, both views | 1.5 / 1.7 | 15.7 / 18.8 | 15.9 / 19.2 | 33.3 / 50.1 |
| 1440 × 1000, 3D only | 1.2 / 1.6 | Off | 13.6 / 16.7 | 16.7 / 33.4 |
| 390 × 844, both views | 1.3 / 1.5 | 15.4 / 20.3 | 15.8 / 18.3 | 33.3 / 50.1 |
| 390 × 844, 3D only | 1.2 / 1.4 | Off | 16.6 / 18.0 | 16.7 / 33.3 |

That build submitted 82 draw calls and 20,741 triangles. The sampler records each clip time in its trace because wall-clock playback and delivered-frame counts can cover different pose intervals. The low 3D submission cost does not imply equally low GPU cost; shared simulation and browser scheduling still contribute to the observed delivery interval. Re-run the sampler after renderer or animation changes before comparing numbers.
