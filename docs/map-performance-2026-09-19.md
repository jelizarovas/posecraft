# Local map rendering performance pass

Implemented locally with Sol handling scenery retention, terrain scheduling, spatial-query reuse and renderer integration. Parent review added transition-mask caching, pixel-equivalence tests, independent measurements and regression checks. No deployment was made.

## Changes

Static props and their shadows are cached in bounded projected-world chunks. Camera movement composites those chunks instead of repainting every prop. Object state changes invalidate the affected chunks. A global occlusion index and stable prop depth order are built once per mount; actors still use the same foreground masking rules.

Terrain chunks draw directly to the display canvas. Preparation runs in short queued tasks and requests a repaint when it makes progress. Waiting for terrain no longer keeps an unchanged scene repainting every frame. Required preparation uses timers rather than waiting indefinitely for idle callbacks. This is cooperative work on the main thread, not a Web Worker.

Transition masks use a 32-entry cache keyed by resolution and the nine neighboring terrain membership bits. Texture coordinates do not affect these masks. Tests compare all 512 patterns at both 48 and 96 pixels against the previous formula with exact pixel equality.

Terrain plans are clipped to the current viewport band so the larger spatial-query cache does not reduce visible texture resolution. Scenery budgets include shadows extending across chunk boundaries. Cold chunks use a clipped fallback so an occluding building does not disappear while its cache is being prepared.

## Measured results

One paired local Chromium run used the same full-screen map, 390 × 844 CSS pixels, DPR2, initial zoom 2.5 and four-second follow, pan and zoom sequences. The pre-change renderer and terrain modules were preserved in `.tmp/map-perf-*` and served by the test's snapshot routing. Both runs used the same paint instrumentation, without per-frame calls to the diagnostic spatial query.

| Measurement | Before | After |
|---|---:|---:|
| Normal CPU, follow callback p95 | 13.3 ms | 2.8 ms |
| Normal CPU, pan callback p95 | 12.7 ms | 2.1 ms |
| Normal CPU, zoom callback p95 | 11.7 ms | 2.7 ms |
| 4× CPU slowdown, follow frame interval p95 | 83.5 ms | 33.5 ms |
| 4× CPU slowdown, pan frame interval p95 | 99.9 ms | 33.4 ms |
| 4× CPU slowdown, zoom frame interval p95 | 83.4 ms | 50.1 ms |
| 4× CPU slowdown, initial terrain/image settling | 16.73 s | 12.48 s |

The JSON reports are `test-results/map-play-performance-before-retained-v2.json` and `test-results/map-play-performance-after-retained-v2.json`. Run `node test/map-play-performance.mjs` with the local Vite server running to measure the current version. `MAP_PERF_SNAPSHOT=1` requires the preserved `.tmp` pre-change files and is only for this local comparison.

These measurements do not include GPU completion timing and do not emulate a phone GPU, memory bandwidth or thermal limits. The normal-speed cases remained around 60 callbacks per second. The throttled results improved, but zooming and initial preparation still need work; this is not a 60 fps guarantee on mobile.

## Boundaries

- The map renderer remains Canvas2D. A batched WebGL renderer and live rigged map characters are not part of this pass.
- Cached prop geometry and art metadata are immutable for a mounted map. Remount after editing them; supported object state changes update the cache.
- Newly revealed terrain uses a coarse textured preview while detail is prepared. The zoom LOD follow-up keeps completed chunks visible and swaps whole surfaces, rather than displaying individual tile preparation.
- Test the local page on the intended phones before setting a mobile performance support claim.

## Zoom LOD follow-up

Terrain refinement now happens in hidden staging canvases. A chunk replaces its visible image only after every tile is ready. Zooming out resamples completed terrain and scenery. Cold terrain and scenery receive retained coarse previews, and tier hysteresis avoids rebuilding at small zoom changes. Loading an actor sprite sheet no longer invalidates terrain or scenery.

Run `node test/map-zoom-lod-browser.mjs` with `POSECRAFT_LOD_PHASE=after` to exercise two zoom cycles from 2.5 to 0.65 and back in the actual play page. The test uses desktop Edge with a 390 by 844 viewport and DPR 2. Reports and screenshots are written under `test-results/map-zoom-lod-after`. `POSECRAFT_CPU_RATE=4` enables optional CPU throttling. Neither setting measures a physical phone.

Focused regressions in `test/map-terrain-chunks-browser.mjs` and `test/map-scenery-chunks-browser.mjs` cover complete cold previews, raised terrain, resampling without tile/prop redraws, repeated zoom changes, changed object states, pixel budgets and disposal. Terrain preparation remains cooperative work on the main thread. Newly visited terrain still costs work, and its coarse preview omits fine transition detail until the completed chunk is ready.

The final unthrottled comparison recorded frame-interval p95 of 183.4 ms before and 33.4 ms after, paint p95 of 221.3 ms before and 19.2 ms after, and 13 versus 4 sampled frames above 50 ms. The remaining worst frame was 166.7 ms. Heap growth during the run was 8.9 MB before and 5.6 MB after. All 47 images loaded and no page errors occurred. Transition and settled screenshots showed continuous terrain. This improves zooming but does not establish a hitch-free or physical-mobile performance guarantee. Reports are `test-results/map-zoom-lod-before.json` and `test-results/map-zoom-lod-after.json`.
