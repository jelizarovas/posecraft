# Renderers and evaluated drawing

Scenes may save `renderer: "svg"` or `renderer: "canvas"`. Omission means SVG. Canvas scenes can also save `canvasDepth: "actor"` to resolve opaque mesh intersections within each actor; omission keeps painter order. `mountRenderer(element, scene, frame, options)` selects the saved backend. It returns `update(frame)` and `dispose()`. It does not create an animation loop or own a simulation. Character editing overlays continue to use SVG.

```js
import { mountRenderer } from 'posecraft/render-mount';
const view = mountRenderer(element, scene, controller.frame());
view.update(controller.frame());
view.dispose();
```

Canvas is an optional renderer with explicit capability checks. It is not a universal replacement for SVG, nor a GPU backend. Unsupported features throw `CanvasCapabilityError` with machine-readable reasons; they do not disappear silently.

## Shared contract

`evaluateDrawing(scene, frame, options)` returns version 1 JSON-compatible drawing data. It is DOM-free and can run in a dedicated worker. Each ordered scene unit has an ID, layer, scene depth and ordered path commands. A command includes its evaluated path, affine matrix, solid or radial material, opacity, visibility, transformed clipping paths and actor/part/joint/prop/object picking identity. The result also includes raw evaluated mesh vertices/triangles and statistics.

The SVG and Canvas paths share actor geometry evaluation, fragment ordering, appearance, host visibility and shared-object evaluation through `render-shared.js`. SVG retains its DOM serializer, projected shadow/reflection passes and update bindings; it does not serialize Canvas commands back to SVG. Mesh topology caches in the spatial evaluator remain shared. Canvas bounds and native Path2D caches are capped at 512 and 1024 entries respectively.

Evaluated matrices include camera and actor placement. Picking uses the same visible paths and clipping transforms as painting. `pickDrawing(context, drawing, x, y)` accepts drawing/viewBox coordinates. A mounted Canvas `pick(x,y)` accepts CSS coordinates relative to its configured viewport. The browser input registry maps client coordinates and camera transforms for the existing declared gesture and bottle adapters. Canvas does not manufacture SVG part DOM nodes. Applications that previously queried those nodes should use picking metadata instead.

The input frame remains authoritative: emitters and fluid overlays use `effectsTime ?? localTime ?? time`, so paused effects and reduced motion do not acquire another clock. Evaluation does not mutate scene data. Shared objects use evaluated frame positions, dimensions, visibility and scene depth while retaining stable IDs. Mounted SVG updates the existing object nodes.

## Supported and gated features

| Feature | General Canvas |
| --- | --- |
| Transforms, camera, variants, visibility and appearance | Supported |
| Spatial/deformed paths, directional art, soft limbs and connected meshes | Shared evaluated geometry |
| Part masks and soft-limb fragment masks | Native transformed path clipping |
| Cel/gradient character materials and point-light wash/source | Supported; sampled curve bounds determine material extents |
| Props, shared circles/boxes, scene depth and picking | Supported |
| Procedural emitters and bottle water/foam/splashes | Supported |
| Declared carry/resist/click/fast-hover and bottle grips | Same interaction adapters |
| Floor/wall cast shadows or reflections | Rejected when enabled; use SVG |
| Bones, limits, collider and physics editor overlays | Rejected; use SVG |

Material bounds sample curved paths; they are not exact symbolic extrema. Native SVG/Canvas rasterizers can differ slightly around antialiasing and translucent gradients. The acceptance test uses pixels as well as geometry, not string equality. The Canvas backing surface is capped at 4096 pixels per dimension, and device pixel ratio at 2. Disposal clears and unregisters the surface; repeated disposal and subsequent updates are harmless.

## Optional actor depth

Set `renderer: "canvas"` and `canvasDepth: "actor"` to use the practical actor depth pass. It depth-tests opaque mesh triangles at each covered pixel, including coincident clothing and muscle surfaces. Material order resolves coincident ties. Silhouette and crease strokes are checked against the front mesh instead of drawing every contour over hidden limbs.

Ordinary vector heads, faces and shoes are rasterized with their masks and opacity, then composited at their existing evaluated depth plane. They keep their vector artwork; they are not converted to 3D surfaces. Picking reads the same visible material buffer, including the vectors. Existing browser gestures therefore continue to use actor/part/joint identities.

Depth is local to an actor scene unit. Other actors, props and detached scene-depth attachments still follow the existing scene ordering. This does not provide physical intersections between different actors or depth-varying curved vector surfaces. Mesh masks, translucent meshes and nonopaque mesh contour colors are rejected; opaque solid, cel and radial-gradient meshes are supported. Translucent and masked ordinary vector parts remain supported. Cast shadows and reflections retain the existing Canvas gates.

The CPU pass uses 2× supersampling and crops to each actor unit. Reused buffers are bounded to 2,097,152 samples per actor and 4,194,304 per frame. Triangle/contour coverage and vector composition each have a 16,000,000-sample work cap. Excess work raises an explicit error rather than silently switching ordering. Large viewports or many large mesh actors may need a smaller viewport or painter mode. Contour stroke width uses the projected transform scale, so strongly nonuniform part transforms are an approximation. Disposal and actor removal release retained depth buffers.

`inspectCanvasCapabilities(scene)` reports static restrictions. `inspectActorDepthCapabilities(drawing)` additionally checks evaluated materials and opacity, so an animated translucent mesh is rejected when it becomes visible. `renderCanvas` selects the pass from the drawing's depth mode. Call `renderCanvas` before `pickDrawing` for actor-depth data; picking an unrendered or stale drawing raises an error.

Run `node --test test/actor-depth.test.js`, `node test/canvas-actor-depth-browser.mjs`, and `node test/canvas-actor-depth-export-browser.mjs`. The export check compiles the saved Atlas scene, verifies its selected renderer, matches the full runtime pose, and clicks the rendered actor through the shared picking adapter. The browser check proves crossing triangles, coincident overlays, contours, partially transparent masked vector art, mounted picking, explicit rejection and bounded work. It renders real Atlas standing, pull-up, walking, recline and bench poses at 0/6/31/39/42/54 seconds into `test-results/canvas-actor-depth.png` beside painter references. The reviewed sheet shows fewer clothing streaks and cleaner body overlaps while preserving the head and shoes. Default Canvas pixel comparisons remain unchanged.

On the same Edge 153 / i7-1265U host, an 800×450 Atlas bench42 drawing warmed for 8 iterations and measured for 16 took 15.6ms median / 20.7ms p95 in actor-depth mode, versus 1.2ms / 2.3ms in painter mode. This excludes geometry evaluation. Cold frames had larger JIT/allocation spikes, including 94ms. Actor depth is a quality choice, not a speed claim or mobile frame-rate guarantee.

## Restricted mesh depth experiment

The default Canvas painter mode intentionally preserves the SVG painter ordering and depth bands. Changing drawing APIs alone does not fix intersections between triangles inside a band.

`renderDepthCanvas(context, drawing)` is a separate bounded CPU depth-buffer experiment. It interpolates vertex depth at every covered pixel and its picking buffer agrees with the visible triangle. A crossing-triangle test proves this difference from whole-face painter ordering. It accepts exactly one mesh actor, opaque solid materials and no ordinary vector paths, masks, outlines, lighting or translucency. Those restrictions are checked before drawing. It is not selectable as a production scene renderer.

The default experiment caps the surface at 1,048,576 pixels and tested triangle coverage at 8,000,000 pixel candidates. It has no antialiasing. This older strict experiment still omits mixed vector/mesh compositing and contours; the actor-depth pass above supports those within its documented limits. Transparent mesh depth and GPU execution remain future work.

## Evidence and reproducible measurements

Run `node --test test/render-evaluation.test.js`, `node test/canvas-browser.mjs`, `node test/canvas-pointer-browser.mjs`, and `node test/render-performance.mjs`. Browser tests start isolated local Vite servers with HMR disabled and launch Edge on Windows. Artifacts go into ignored `test-results/`.

The evaluator test compares full and illustration frames in both reduced-motion modes, then evaluates the same input in a dedicated Node worker. The browser tests compare SVG-raster reference pixels with Canvas for masks/transforms/props/shared objects, hard cel and soft materials, folded Ona/Dummy rigs, and the real Atlas bench pose. It also checks picking, depth-buffer intersections, stable SVG object updates and disposal. Actual mouse gestures cover food carry/release, head resistance, fast hover, fire click and bottle grabs.

On September 17, 2026, Edge 153 headless / Windows x64 / Intel i7-1265U / Node 22.23.2, mean per-channel image differences on a 0–255 scale were 0.061 for masked props, 1.059 for both lighting modes, 0.092 for the spatial rigs, 0.045 for the bench mesh, and 1.319 for the visible point-light source. The fraction of pixels with any channel difference above 70 was at most 0.049%. Review `test-results/canvas-parity.png` beside its JSON report.

The timing workload uses an 800×600 surface, deterministic `full-set` samples at `30 + i/60` seconds, ten warmup frames and 24 measured frames. Every actor uses the same Atlas connected body mesh and vector head/shoes. Garment and muscle overlay meshes are excluded in all three cases because sixteen complete Atlas rigs exceed the existing scene mesh budget. This is a renderer workload, not sixteen independently simulated physical characters.

| Actors | Evaluation median / p95 ms | Canvas draw median / p95 ms | SVG evaluation + DOM median / p95 ms | SVG nodes |
| --- | --- | --- | --- | --- |
| 1 | 6.0 / 8.9 | 1.2 / 1.6 | 6.9 / 8.0 | 263 |
| 4 | 18.8 / 27.1 | 1.3 / 2.6 | 21.8 / 27.0 | 1,040 |
| 16 | 84.6 / 101.6 | 5.3 / 6.2 | 82.7 / 94.1 | 4,148 |

The authored pose is sampled once and shared, costing about 0.2ms median in each case. Canvas evaluation plus drawing must be compared with the combined SVG number; the Canvas drawing column alone is not an end-to-end speedup. Browser painting/compositing and GPU completion are not synchronously measured. Heap samples were roughly 65–69MB for the whole browser task, not retained memory attributable to a renderer. These results identify evaluation as the dominant cost and do not establish mobile frame rates or justify switching existing scenes by default. No physical phone measurement was performed.

Before the actor-depth increment, Vite's minified ES library build measured the SVG entry at 125,180 bytes, 36,855 gzip, and the dispatcher entry at 145,848 bytes, 43,238 gzip. The optional-backend dispatcher therefore adds 6,383 gzip bytes in this isolated comparison. These entries include common validation/evaluation dependencies and are not complete website export sizes. Export compilation can tree-shake a directly selected backend; the general dispatcher imports both.
