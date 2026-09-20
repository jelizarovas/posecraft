# Isometric maps

## Local game preview

Run `npm run dev:map` and open `http://localhost:5246/play.html`. This page contains only the running Littlelands map, filling the viewport with no gallery, controls or stats. Vite reloads it when source files change. The command binds to all network interfaces; use the Network URL printed by Vite with `/play.html` on a phone connected to the same Wi-Fi. No GitHub deployment is needed. Stop the server with Ctrl+C.

Tap to walk, double-tap to run, drag to pan, and pinch or scroll to zoom. Hold a destination or Alt-click to turn in place. The browser's address bar remains browser UI; the page itself has no surrounding layout.

Run `node test/map-play-performance.mjs` while Vite is running to measure this page at portrait DPR2, both normally and with 4× CPU slowdown. It exercises following a running character, panning and zooming. Results go to `test-results/map-play-performance-current.json`; set `MAP_PERF_LABEL` to keep separate before/after reports. These are desktop browser diagnostics, not measurements of a phone GPU. Real phone testing remains necessary.

See [map character rendering](map-character-rendering.md) for the current sprite pipeline, its memory cost, and the distinction between baked sprites and live characters with equipment.

An opt-in GPU backend is available at `play.html?renderer=webgl2` and `map-editor.html?renderer=webgl2`, or through `mountMap(host, map, {renderer: 'webgl2'})`. It reuses the same gameplay and map format. Canvas2D remains the default while performance and phone validation continue. See [GPU migration status](map-gpu-renderer.md) for what has moved to the GPU, resource budgets, tests and remaining work.

The [September 19 performance report](map-performance-2026-09-19.md) records the retained scenery implementation, measured results and remaining mobile limits.

Posecraft maps keep the whole logical grid in memory and draw the current viewport. Panning does not create a map-sized canvas or render offscreen tiles into a hidden image. The canvas backing size follows its host element, with device pixel ratio capped at two.

```js
import {generateMap} from 'posecraft/map';
import {mountMap} from 'posecraft/map-browser';

const map = generateMap({width: 256, height: 256, seed: 42});
const view = mountMap(document.querySelector('#map'), map, {
  execution: 'worker',
  onEvent(event) {
    if (event.type === 'map.object.interacted') {
      // The game decides whether this advances a quest or awards a reward.
    }
  },
  onError: console.error
});

await view.moveTo('hero', 'village-chest');
const saved = view.snapshot();
await view.restore(saved);
view.dispose();
```

Give the host an explicit height. Tap terrain to walk the first actor, or tap a prop to approach it. Double-tap the same area within 340 ms, or Shift-click, to run. Programmatic movement accepts `{gait: "walk" | "run"}`; walking is the default and running uses 1.8 times the actor's walking speed. Drag to pan, scroll or pinch to zoom. Arrow keys pan the focused canvas, plus/minus zoom, and Enter recenters on the first actor. `focusActor(id)` recenters once. `followActor(id)` eases the camera toward a character and keeps following as it moves. Dragging, pinching, keyboard panning, `panTo()` or `stopFollowing()` releases the camera. `cameraTracking()` reports the tracked actor and whether following is active. `onCameraChange` receives mode changes.

Pass `followOnMove: true` to resume following whenever an accepted movement command starts for the first actor, including commands sent directly to the controller. Background NPC commands do not take over the camera or player route markers. This is enabled in the gallery, where a floating Recenter button appears after panning away. Recenter resumes following without restarting the character's task. The library default is false, preserving manually controlled cameras. Zoom buttons keep following; wheel zoom stays centered while following. Enter resumes following the last tracked actor.

## Coordinates and rendering

Zoom ranges from 0.45× to 5× through the slider, wheel, pinch or `zoomTo()`. Gallery fullscreen fills the viewport without padding and shows only the exit toggle at the top right. Recenter and other controls return when fullscreen closes; gestures and movement remain active throughout.

The generated woodland uses seeded groves with sparse edges, open clearings and solid, impassable forest cores. Roads and the starting village remain clear. Generation changes apply to new maps; existing saved maps retain their authored layout.

Static prop shadows flatten the artwork alpha onto the ground in one shared sun direction. A small tinted mask is cached per image, and the resulting shadows are retained in scenery chunks with bounds that include their full reach. Contact shadows anchor feet, trunks, and foundations. Ground paint and crop patches do not cast tall object shadows. This is a directional ground-shadow approximation without shadow maps, blur filters, or per-frame prop lighting calculations.

Grid X and Y are ground-plane coordinates. A tile occupies `[x, x + 1] × [y, y + 1]`; its center is `{x: x + .5, y: y + .5}`. Actors and navigation paths already contain continuous center coordinates. Prop X/Y are footprint origins, and width/height are footprint sizes in cells.

`projectMap` and `unprojectMap` convert grid coordinates to isometric world pixels and back. `view.mapToScreen(point)` and `view.screenToMap(x, y)` additionally apply the camera and zoom. Screen coordinates use canvas-local CSS pixels.

`MapIndex` groups terrain and prop references into chunks. Each render queries chunks intersecting the camera rectangle, plus a margin for tall artwork and near-edge tiles. Actor occlusion uses prop footprints, so someone outside a building's front wall remains in front even beside its door. When scenery hides a character, a tinted silhouette appears only inside the foreground artwork's opaque pixels. Ground shadows do not occlude characters. Scenery uses optional image artwork, with procedural fallbacks for grass, paths, water, sand, trees, rocks, chests and cottages.

Walking uses rounded route corners with continuous obstacle-clearance checks. Body yaw turns at a bounded rate, and reversing direction turns the character before travel. The procedural adventurer projects its limbs and feet in the direction of travel, with front, profile and rear views. Gait phase follows distance travelled rather than a timer.

`view.stats()` exposes visible and total tile/prop counts, candidate counts, visited chunks, backing dimensions and drawn frames. These measure the work performed. They are not estimates derived only from camera area.

## Hills and dips

A map may store `elevations`, a row-major array with `(width + 1) * (height + 1)` vertex heights. One height unit is `tileSize.height` screen pixels. Heights can be negative for dips. `generateMap({elevation: true})` creates seeded rolling terrain while keeping roads, water and building foundations level. The woodland demo uses 36 by 18 pixel tiles, half the old width and height and one-quarter the area.

`groundHeight(map, {x, y})` samples the two triangles of each cell. `projectMap` places terrain, props, routes and characters on that surface, and `unprojectMap` finds the corresponding raised ground point for clicks. An explicit `point.z` overrides ground height for projection. Heights must be between -16 and 16, with adjacent differences no larger than 0.4. This release supports gentle continuous slopes, not cliffs, bridges or stacked walkable surfaces. Navigation still uses the ground XY grid and obstacle footprints.

Elevation is serialized with the map and included in save compatibility checks. Flat documents remain compatible and do not need a height array.

## Route markers and crossings

Moving actors show animated ground arrows along their planned route and a diamond at the destination. The marker remains at the final goal during automatic hops. For an explicitly selected crossing, it marks the far side. Arrival or cancellation clears both. Arrow work is clipped to the viewport and capped at 240 glyphs; reduced-motion mode keeps the markers still.

Props can declare `traversal` alongside their collision shapes:

```js
traversal: {
  kind: 'vault',          // or 'climb'
  activation: 'click',    // 'auto' for low branches and rocks
  height: 0.55,
  endpoints: [{x: 1.5, y: -0.45}, {x: 1.5, y: 1.45}]
}
```

Endpoints are relative to the prop's origin. `moveTo('hero', 'fence-id')` walks to the near endpoint, crosses, and finishes on the opposite side. Ordinary ground destinations route around click-only crossings. Both endpoints and the crossing corridor must be clear of other obstacles. Ridge direction comes from the ground elevation at each endpoint; a flat pair of climb endpoints is rejected. These are obstacle crossings on the existing height field, not stacked platforms or arbitrary cliff geometry.

Low branch presets use automatic vaulting and `style: 'branch'`. The character slows into a handplant, crosses, then resumes the route. Rock jumps retain their airborne leap and momentum recovery. Input during a crossing waits for a safe landing before the new route starts.

The map editor authors these settings and can place a ridge with a raised side. `play.html` includes nearby examples on the generated map; `play.html?draft=1` preserves the user's authored scene. Old bundled branch decorations gain vault collision when loaded, while custom collision choices remain unchanged.

Optional `vault`, `climbUp`, and `climbDown` sprite clips supply crossing artwork. The stock descent reuses the ascent atlas in reverse. Extra crossing sheets load only if the map contains the corresponding props.

## Image artwork

Trees and rocks pass pointer clicks through their artwork to the ground tile underneath. Their footprints still block navigation. Chests and houses capture clicks on their artwork to select the object interaction; programmatic object targets remain available for every prop kind.

Maps can optionally store `art.images`, `art.props` and `art.terrain`. Images declare a URL, display width/height at a 64-pixel tile width, and a normalized ground anchor. Prop bindings choose from named images deterministically, so saved maps keep their tree and rock variations. Terrain bindings cover grass, road, water and sand. Terrain image dimensions set repeat size in the ground plane; anchors are ignored for terrain. The renderer accepts PNG or WebP with alpha, uses that alpha for silhouettes, and includes image overhang in viewport culling.

### Village actors

The local town uses actor definitions for livestock, six adult villagers and
two children. Animals are removed from the static prop list. Each actor can
declare `appearance` and `npc` metadata, which are validated and preserved in
map JSON. `npc.home` is its routine area; species and role select the village
behavior. Villager appearances share directional movement sheets with bounded
cached clothing/skin variants, hats and size differences. Livestock currently
use the existing artwork with lightweight movement and feeding articulation;
they are not fully directional skeletal animal models.

`examples/map-village-life.js` runs these routines through `MapController`.
It owns one due queue, caps concurrent routines, pauses scheduling while the
document is hidden, and aborts its commands on disposal. Feeding stations and
granaries are approached as solid objects. Escapes use open/broken gates and
reserve a herder for recovery. Actions are exposed by `townLife.state()` in the
local play page; the player retains camera and route ownership.

Hosts can use `view.setActorPresentation(id, {action, carrying, target})` to
display a work or interaction state without replacing controller movement.
Only visible active NPC presentations keep the drawing loop awake. Live
routine timers and random-generator progress are not yet included in map
snapshots; actor definitions and positions are saved, and routines restart
when the page is reopened.

The [woodland example](../examples/woodland-map.js) supplies three trees, two rocks, an inn and four terrain textures. Original PNGs, WebP derivatives and generation prompts are in [the asset directory](../public/assets/map/README.md). Copy `public/assets/map` into the host's `assets/map` directory when using a downloaded woodland map elsewhere, or replace its image URLs. A map JSON file contains references, not embedded pixels.

`await view.ready` waits for artwork loading. `view.controller.ready` waits for the navigation worker. Missing images report `onError` and retain procedural fallback artwork; other assets still load. Decoded images are shared by URL between mounted views and released when the last view is disposed. Unthemed maps do not request artwork.

Road, grass, sand and water materials blend through neighboring cells. Texture coordinates remain fixed to world positions while the camera pans. Terrain is projected onto the same triangles used by picking.

The renderer caches static terrain and props separately from actors. Zooming out downsamples finished chunks instead of repainting each tile or prop. Newly revealed chunks receive a complete coarse textured preview; higher-detail terrain is prepared in hidden canvases and swapped in only when complete. Resolution tiers have hysteresis to avoid rebuilding at every small zoom change. Terrain and scenery caches have separate pixel budgets, including their retained previews. Asset loads invalidate only the layers using that image, so loading a character animation does not clear the ground. Cache counters, LOD reuse and pixel budgets are exposed through `view.stats().terrainCache` and `sceneryCache`. Canvas resolution is capped at DPR 2 and four million backing pixels. Idle maps stop rendering after pending terrain work settles.

## Movement and lifecycle

Single-click retargets preserve an active run. A substantial change of direction during a continuous-map run carries the current velocity into a short braking slide. Faster movement takes farther to stop. Each braking segment checks the actor footprint against props, water and map boundaries; pathfinding starts from the actual stopping point. Repeated retargets preserve the remaining momentum. Frames expose `skidding` for custom character renderers. Arrival, cancellation and restore clear the transient motion.

Small rocks marked `traversal: {kind: 'vault', height: ...}` trigger a walking hop or an earlier running jump. Takeoff and landing require clear ground, and the airborne arc clears the authored rock height. If a jump cannot fit, the controller replans around solid rocks. A running direction change requested in midair queues the new target, finishes the original flight, rolls forward with collision-checked momentum, recovers, then resumes the requested journey. Frames expose `jumping`, `jumpProgress`, `rolling`, and `rollProgress`; optional `jump` and `roll` sprite clips use these non-looping progress values. The stock character includes both, and older stock drafts gain them when opened locally.

Pathfinding runs in a worker by default. Main-thread execution is available for consumers without workers and searches in bounded batches. At most 16 movement commands can run at once, with four path searches allocating working buffers at a time; queued searches start as those finish or are cancelled. Obstacles use tile footprints. Houses are approached at the center of their +Y wall, matching the rendered door; a blocked door fails. Other object destinations select accessible edge cells. Cancellation, replacement, failure and arrival have explicit events. The map controller owns movement; game rules belong to the host application.

Camera culling removes offscreen artwork from rendering. It does not freeze an offscreen actor's logical journey. Pausing the view, hiding the browser tab or moving the whole host offscreen stops simulation stepping. Commands resume when the view resumes. An idle visible map does not keep an animation loop running. A pending path search wakes the view when it returns.

View snapshots include camera position, zoom, optional tracking state and the controller's semantic state. Older snapshots without tracking state restore to a free camera. They do not serialize unfinished promises or path searches. Restore cancels active commands. Use the same map document to restore its snapshot; editing a map requires a new index and controller.

Dispose the view when leaving a page. This cancels commands and removes the canvas, listeners, observers, worker and scheduled rendering. Prefer handling `AbortError` separately from genuine route or loading failures.

## Scope of this release

This is a separate isometric map runtime, not the native 3D workout renderer or the illustrated scene document format. Maps have their own validated JSON format. The local [map editor](map-editor.md) authors terrain, sparse ground textures, decorative scatter, props, and independent collision shapes. It saves ordinary map JSON and opens the authored map in the full-screen play page. The character Studio remains separate.

Terrain and props are held in memory. Rendering is virtualized, but this is not network chunk streaming. Ground depth sorting supports the supplied solid props; bridges, interiors, stacked height levels and arbitrary overhanging custom assets need explicit layer or occlusion rules. The map adventurer uses baked directional sprite clips. General live character equipment binding remains separate work; see [character rendering](map-character-rendering.md).

## Rendering measurements

On September 19, 2026, local headless Chromium measured the previous textured renderer at median frame intervals of 66.7 ms for a 390 by 844 viewport at DPR 2 and 116.6 ms for desktop panning at DPR 1. The chunked renderer, with the smaller elevated terrain enabled, measured 16.7 ms in both layouts. Panning CPU callback p95 was 9.1 ms for portrait and 12.1 ms for desktop. Idle maps produced no frames after preparation completed.

These are desktop measurements with mobile-sized emulation, not physical phone benchmarks. New terrain prepares progressively rather than blocking on a whole-map raster. Run `node test/map-render-performance.mjs` against a local development server to record frame cadence, CPU submission time and cache sizes without hardware-dependent pass/fail thresholds.

The painted-terrain and forest refresh was measured separately in the same layouts: 290 portrait pan frames and 279 desktop pan frames over five seconds, with 16.7 ms median intervals and zero idle frames. Initial terrain preparation took about 1.9 seconds for portrait and 5.7 seconds for the wider desktop view. New-chunk preparation still causes occasional slower frames; portrait/desktop pan CPU callback p95 was 21.4/23.3 ms. Terrain chunks now paint directly into retained surfaces, avoiding a second projected-tile canvas for each unique hill slope. Close zoom uses higher-resolution materials within the existing 12-megapixel chunk-cache ceiling.

The crossing update was measured in the full-screen play page at 390 × 844, DPR 2. Following, panning and zooming each rendered 238–240 frames over four seconds, with 16.7 ms median intervals. At 4× CPU throttling, following rendered 156 frames, panning 192 and zooming 117. Zooming still stalls during terrain preparation on slower CPUs; this is not a claim of 60 FPS on physical phones. All 20 requested images loaded without errors. The two additional action atlases share descent frames and add about 21 MiB decoded; maps without those crossing types do not load them. See `test-results/map-play-performance-crossings.json` from the local run.
### Cliffs, moving water and birds

Maps can declare `terraces`, integer cell rectangles with `id`, `x`, `y`, `width`, `height` and `heightOffset` from 1 to 16. Overlapping rectangles use the highest offset. Heights are measured in tile-height pixels; the demo uses 3, 8 and 15 for roughly one, three and five character heights. Smooth `elevations` remain separate. Mounted map data is immutable; replace the document to edit terrace geometry.

Raised ground, vertical faces, picking, culling and movement share the same terrain heights. Ordinary navigation cannot cross a sheer edge. An authored click climb can connect two clear endpoints, while water and unrelated obstacles still block it. Terrain tops and faces mask lower scenery and characters.

Water tiles above exposed edges produce animated waterfalls automatically. Visible river tiles draw moving surface ripples. These effects are visual animation, not a fluid simulation. Reduced motion freezes them; offscreen effects are culled. Static rock faces use the existing bounded scenery cache.

`birds` are independent aerial NPCs with `id`, `species` (`crow` or `eagle`), `home: {x,y,z}`, `radius`, and optional `seed` and `roost`. Their seeded flight, perch and foraging cycles avoid ground pathfinding. Birds clear raised ground; quiet flight envelopes use a delayed wake instead of continuous drawing.

The map editor's Plateau tool places rectangular shelves at the three demo heights and erases them. Save/export retains terraces and birds. Open `play.html?view=cliffs` to inspect the local valley. Original cliff and nest artwork was generated with the built-in image tool; prompts are in `public/assets/map/terrain/cliff-prompts.json`.
