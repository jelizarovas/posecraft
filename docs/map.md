# Isometric maps

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

Pass `followOnMove: true` to resume following whenever an accepted movement command starts, including commands sent directly to the controller. This is enabled in the gallery, where a floating Recenter button appears after panning away. Recenter resumes following without restarting the character's task. The library default is false, preserving manually controlled cameras. Zoom buttons keep following; wheel zoom stays centered while following. Enter resumes following the last tracked actor.

## Coordinates and rendering

Grid X and Y are ground-plane coordinates. A tile occupies `[x, x + 1] × [y, y + 1]`; its center is `{x: x + .5, y: y + .5}`. Actors and navigation paths already contain continuous center coordinates. Prop X/Y are footprint origins, and width/height are footprint sizes in cells.

`projectMap` and `unprojectMap` convert grid coordinates to isometric world pixels and back. `view.mapToScreen(point)` and `view.screenToMap(x, y)` additionally apply the camera and zoom. Screen coordinates use canvas-local CSS pixels.

`MapIndex` groups terrain and prop references into chunks. Each render queries chunks intersecting the camera rectangle, plus a margin for tall artwork and near-edge tiles. Actor occlusion uses prop footprints, so someone outside a building's front wall remains in front even beside its door. When scenery hides a character, a tinted silhouette appears only inside the foreground artwork's opaque pixels. Ground shadows do not occlude characters. Scenery uses optional image artwork, with procedural fallbacks for grass, paths, water, sand, trees, rocks, chests and cottages.

Walking uses rounded route corners with continuous obstacle-clearance checks. Body yaw turns at a bounded rate, and reversing direction turns the character before travel. The procedural adventurer projects its limbs and feet in the direction of travel, with front, profile and rear views. Gait phase follows distance travelled rather than a timer.

`view.stats()` exposes visible and total tile/prop counts, candidate counts, visited chunks, backing dimensions and drawn frames. These measure the work performed. They are not estimates derived only from camera area.

## Hills and dips

A map may store `elevations`, a row-major array with `(width + 1) * (height + 1)` vertex heights. One height unit is `tileSize.height` screen pixels. Heights can be negative for dips. `generateMap({elevation: true})` creates seeded rolling terrain while keeping roads, water and building foundations level. The woodland demo uses 36 by 18 pixel tiles, half the old width and height and one-quarter the area.

`groundHeight(map, {x, y})` samples the two triangles of each cell. `projectMap` places terrain, props, routes and characters on that surface, and `unprojectMap` finds the corresponding raised ground point for clicks. An explicit `point.z` overrides ground height for projection. Heights must be between -16 and 16, with adjacent differences no larger than 0.4. This release supports gentle continuous slopes, not cliffs, bridges or stacked walkable surfaces. Navigation still uses the ground XY grid and obstacle footprints.

Elevation is serialized with the map and included in save compatibility checks. Flat documents remain compatible and do not need a height array.

## Image artwork

Trees and rocks pass pointer clicks through their artwork to the ground tile underneath. Their footprints still block navigation. Chests and houses capture clicks on their artwork to select the object interaction; programmatic object targets remain available for every prop kind.

Maps can optionally store `art.images`, `art.props` and `art.terrain`. Images declare a URL, display width/height at a 64-pixel tile width, and a normalized ground anchor. Prop bindings choose from named images deterministically, so saved maps keep their tree and rock variations. Terrain bindings cover grass, road, water and sand. Terrain image dimensions set repeat size in the ground plane; anchors are ignored for terrain. The renderer accepts PNG or WebP with alpha, uses that alpha for silhouettes, and includes image overhang in viewport culling.

The [woodland example](../examples/woodland-map.js) supplies three trees, two rocks, an inn and four terrain textures. Original PNGs, WebP derivatives and generation prompts are in [the asset directory](../public/assets/map/README.md). Copy `public/assets/map` into the host's `assets/map` directory when using a downloaded woodland map elsewhere, or replace its image URLs. A map JSON file contains references, not embedded pixels.

`await view.ready` waits for artwork loading. `view.controller.ready` waits for the navigation worker. Missing images report `onError` and retain procedural fallback artwork; other assets still load. Decoded images are shared by URL between mounted views and released when the last view is disposed. Unthemed maps do not request artwork.

Road, grass, sand and water materials blend through neighboring cells. Texture coordinates remain fixed to world positions while the camera pans. Terrain is projected onto the same triangles used by picking.

The renderer caches static terrain and props separately from actors. Character movement reuses those layers; terrain preparation is progressive, and only nearby terrain chunks are cached. Cache counters and pixel budgets are exposed through `view.stats().terrainCache`. Canvas resolution is capped at DPR 2 and four million backing pixels. Idle maps stop rendering after pending terrain work settles.

## Movement and lifecycle

Pathfinding runs in a worker by default. Main-thread execution is available for consumers without workers and searches in bounded batches. At most 16 movement commands can run at once, with four path searches allocating working buffers at a time; queued searches start as those finish or are cancelled. Obstacles use tile footprints. Houses are approached at the center of their +Y wall, matching the rendered door; a blocked door fails. Other object destinations select accessible edge cells. Cancellation, replacement, failure and arrival have explicit events. The map controller owns movement; game rules belong to the host application.

Camera culling removes offscreen artwork from rendering. It does not freeze an offscreen actor's logical journey. Pausing the view, hiding the browser tab or moving the whole host offscreen stops simulation stepping. Commands resume when the view resumes. An idle visible map does not keep an animation loop running. A pending path search wakes the view when it returns.

View snapshots include camera position, zoom, optional tracking state and the controller's semantic state. Older snapshots without tracking state restore to a free camera. They do not serialize unfinished promises or path searches. Restore cancels active commands. Use the same map document to restore its snapshot; editing a map requires a new index and controller.

Dispose the view when leaving a page. This cancels commands and removes the canvas, listeners, observers, worker and scheduled rendering. Prefer handling `AbortError` separately from genuine route or loading failures.

## Scope of this release

This is a separate isometric map runtime, not the native 3D workout renderer or the illustrated scene document format. Maps have their own validated JSON format. The gallery supports generating, saving and reopening a map; the existing character Studio does not yet author map tiles or props.

Terrain and props are held in memory. Rendering is virtualized, but this is not network chunk streaming. Ground depth sorting supports the supplied solid props; bridges, interiors, stacked height levels and arbitrary overhanging custom assets need explicit layer or occlusion rules. The adventurer uses directional procedural walking, not an imported production character rig. General character asset binding and game-specific map editing remain separate work.

## Rendering measurements

On September 19, 2026, local headless Chromium measured the previous textured renderer at median frame intervals of 66.7 ms for a 390 by 844 viewport at DPR 2 and 116.6 ms for desktop panning at DPR 1. The chunked renderer, with the smaller elevated terrain enabled, measured 16.7 ms in both layouts. Panning CPU callback p95 was 9.1 ms for portrait and 12.1 ms for desktop. Idle maps produced no frames after preparation completed.

These are desktop measurements with mobile-sized emulation, not physical phone benchmarks. New terrain prepares progressively rather than blocking on a whole-map raster. Run `node test/map-render-performance.mjs` against a local development server to record frame cadence, CPU submission time and cache sizes without hardware-dependent pass/fail thresholds.
