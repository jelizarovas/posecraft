# Incremental GPU map renderer

The existing map document, controller, navigation, behaviors, interactions, saves and editor remain in use. `mountMap` accepts `renderer: 'webgl2'` or `'auto'` to try the new backend. The default is still `'canvas2d'`. Both GPU options fall back to Canvas2D if WebGL2 is unavailable, the context is lost, or the renderer cannot meet its resource bounds.

Local comparison links:

- `play.html?renderer=webgl2`
- `play.html?renderer=canvas2d`
- `play.html?renderer=webgl2&view=cliffs`
- `map-editor.html?renderer=webgl2`, whose Play draft button preserves the renderer choice.

## Implemented

Terrain materials are compiled independently from their world geometry. Shared flat material images retain the existing road transitions, ground paint and wheel tracks. Terrain vertices carry the existing elevation and terrace positions. Immutable buffers contain 8 by 8 terrain regions, separated by terrace height. Material and geometry cache keys do not contain camera zoom.

WebGL2 texture arrays group compatible images and isolate their mip chains. Texture minification happens on the GPU. Mipmaps are generated once per changed array after that frame's uploads, rather than between individual draw calls. Compiled geometry remains in GPU buffers across camera moves. Returning to a warm view does not rebuild materials or upload textures or geometry unless memory pressure has evicted them.

Scenery retains the existing ordering, shadows and clipping through fixed-resolution compiled Canvas2D chunks, uploaded once to GPU arrays. This deliberately preserves fence, crop and building rendering while the backend changes. The scenery compiler still runs at runtime and remains camera-visible-region dependent. It is not an offline export compiler.

Route markers and river ripples use GPU geometry. Characters, their current occlusion masks, waterfalls and birds remain on a transparent Canvas2D overlay. This avoids changing character acting and gameplay in the renderer migration. It also means their CPU costs remain.

Texture allocation is capped at 64 MiB, including allocated array slots and mip levels. Rectangular texture pages avoid square allocation waste, and unused slots or pages are reused under memory pressure. Static geometry has an 8 MiB eviction threshold, plus the current frame's working set. Dynamic vertex storage is fixed at 4.5 MiB. These budgets exclude CPU image caches, decoded character sheets, browser backbuffers and driver overhead. `view.stats().gpu` reports texture allocation, geometry allocation, uploads, geometry builds, batches and evictions.

Context loss removes the GPU layer and recreates the Canvas2D render caches. The existing gameplay controller, camera, input canvas and saved state remain intact. Resource cleanup disposes textures, buffers, programs, timers and canvases.

## Verification and rollout

`node test/map-gpu-browser.mjs` checks real town rendering, warm zoom without material/texture/geometry rebuilds, both zoom extremes, cliff rendering, resource bounds, context loss, gameplay-state preservation, untextured maps, unavailable WebGL fallback, image orientation, alpha blending, GL errors and disposal.

`node test/map-renderer-comparison.mjs` compares both backends in the same portrait viewport at DPR 2. Set `MAP_CPU_RATE=4` for CPU throttling. Reports are written to `test-results/map-renderer-comparison-*.json`. The test measures desktop frame intervals and CPU submission time, not a physical phone GPU or sustained thermal behavior.

The current comparison did not establish a decisive frame-rate improvement. One normal-speed run measured zoom frame p95 around 33 ms for both renderers and warm frame p95 around 17 ms for both. CPU paint time was slightly higher for the GPU backend. GPU rendering therefore remains opt-in. The migration establishes reusable GPU resources; it does not yet establish the requested mobile performance target.

## Remaining migration

- Export compiled terrain materials, geometry and scenery so first visits do not construct them on the main thread. Add chunk-local invalidation to the editor before adopting that compiled format.
- Replace baked scenery chunks with shared sprite instances where clipping permits, retaining authored depth relationships.
- Replace repeated character masks with shared GPU depth/occlusion data. Keep a visual regression suite for crops, trees, fences, roofs and cliff tops.
- Integrate live equipped characters into that same depth system. The current map still uses sprite characters.
- Budget worker pathfinding and NPC decisions independently of render frequency. The existing simulation has not been replaced by this pass.
- Measure on the target phones, including long sessions, rapid navigation and equipment changes, before making the backend the default.
