# Renderers and evaluated drawing

Scenes may save `renderer: "svg"` or `renderer: "canvas"`. Omission means SVG. `mountRenderer(element, scene, frame, options)` selects the saved backend. It returns `update(frame)` and `dispose()`. It does not create an animation loop or own a simulation. Character editing overlays continue to use SVG.

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

## Mesh depth experiment

The general Canvas backend intentionally preserves the SVG painter ordering and depth bands. Changing drawing APIs alone does not fix intersections between triangles inside a band.

`renderDepthCanvas(context, drawing)` is a separate bounded CPU depth-buffer experiment. It interpolates vertex depth at every covered pixel and its picking buffer agrees with the visible triangle. A crossing-triangle test proves this difference from whole-face painter ordering. It accepts exactly one mesh actor, opaque solid materials and no ordinary vector paths, masks, outlines, lighting or translucency. Those restrictions are checked before drawing. It is not selectable as a production scene renderer.

The default experiment caps the surface at 1,048,576 pixels and tested triangle coverage at 8,000,000 pixel candidates. It has no antialiasing. Mixed vector/mesh compositing, transparent depth, contours and GPU execution remain future work.

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

Vite's minified ES library build measured the SVG entry at 125,180 bytes, 36,855 gzip, and the dispatcher entry at 145,848 bytes, 43,238 gzip. The optional-backend dispatcher therefore adds 6,383 gzip bytes in this isolated comparison. These entries include common validation/evaluation dependencies and are not complete website export sizes. Export compilation can tree-shake a directly selected backend; the general dispatcher imports both.
