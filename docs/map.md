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

Give the host an explicit height. Click terrain to move the first actor, or click a prop to approach it. Drag to pan, scroll or pinch to zoom. Arrow keys pan the focused canvas, plus/minus zoom, and Enter recenters on the first actor. `focusActor(id)` also recenters once. It does not follow a moving actor.

## Coordinates and rendering

Grid X and Y are ground-plane coordinates. A tile occupies `[x, x + 1] × [y, y + 1]`; its center is `{x: x + .5, y: y + .5}`. Actors and navigation paths already contain continuous center coordinates. Prop X/Y are footprint origins, and width/height are footprint sizes in cells.

`projectMap` and `unprojectMap` convert grid coordinates to isometric world pixels and back. `view.mapToScreen(point)` and `view.screenToMap(x, y)` additionally apply the camera and zoom. Screen coordinates use canvas-local CSS pixels.

`MapIndex` groups terrain and prop references into chunks. Each render queries chunks intersecting the camera rectangle, plus a margin for tall artwork and near-edge tiles. Actor occlusion uses prop footprints, so someone outside a building's front wall remains in front even beside its door. When scenery hides a character, a tinted silhouette appears only inside the foreground artwork's opaque pixels. Ground shadows do not occlude characters. Static scenery is code-drawn vector artwork: grass, paths, water, sand, trees, rocks, chests and cottages.

Walking uses rounded route corners with continuous obstacle-clearance checks. Body yaw turns at a bounded rate, and reversing direction turns the character before travel. The procedural adventurer projects its limbs and feet in the direction of travel, with front, profile and rear views. Gait phase follows distance travelled rather than a timer.

`view.stats()` exposes visible and total tile/prop counts, candidate counts, visited chunks, backing dimensions and drawn frames. These measure the work performed. They are not estimates derived only from camera area.

## Movement and lifecycle

Pathfinding runs in a worker by default. Main-thread execution is available for consumers without workers and searches in bounded batches. At most 16 movement commands can run at once, with four path searches allocating working buffers at a time; queued searches start as those finish or are cancelled. Obstacles use tile footprints. Houses are approached at the center of their +Y wall, matching the rendered door; a blocked door fails. Other object destinations select accessible edge cells. Cancellation, replacement, failure and arrival have explicit events. The map controller owns movement; game rules belong to the host application.

Camera culling removes offscreen artwork from rendering. It does not freeze an offscreen actor's logical journey. Pausing the view, hiding the browser tab or moving the whole host offscreen stops simulation stepping. Commands resume when the view resumes. An idle visible map does not keep an animation loop running. A pending path search wakes the view when it returns.

View snapshots include camera and the controller's semantic state. They do not serialize unfinished promises or path searches. Restore cancels active commands. Use the same map document to restore its snapshot; editing a map requires a new index and controller.

Dispose the view when leaving a page. This cancels commands and removes the canvas, listeners, observers, worker and scheduled rendering. Prefer handling `AbortError` separately from genuine route or loading failures.

## Scope of this release

This is a separate isometric map runtime, not the native 3D workout renderer or the illustrated scene document format. Maps have their own validated JSON format. The gallery supports generating, saving and reopening a map; the existing character Studio does not yet author map tiles or props.

Terrain and props are held in memory. Rendering is virtualized, but this is not network chunk streaming. Ground depth sorting supports the supplied solid props; bridges, interiors, multiple height levels and arbitrary overhanging custom assets need explicit layer or occlusion rules. The adventurer uses directional procedural walking, not an imported production character rig. General character asset binding and game-specific map editing remain separate work.
