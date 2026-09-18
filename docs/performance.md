# Simulation and routing performance

Studio, `mountScene`, and the React adapter run animation state transitions, physical simulation, protection decisions, and pose evaluation in one dedicated Web Worker per mounted scene. Avatars share that worker. They do not each create a thread. SVG rendering, pointer input, document editing, and audio stay on the main thread. Initial document validation and the first static frame still happen on the main thread.

A dedicated worker is for computation. A service worker is for network interception and offline caching; it is not the simulation scheduler. See [MDN's worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers). No service worker is registered by Posecraft.

## Keeping work bounded

- Only one simulation batch is in flight. At most one latest pending host sample is retained. Pending clip previews and input updates for the same target replace older unsent samples.
- Ordered commands, including interactions, have a 128-command limit. Excess commands report an error instead of silently losing interactions.
- A batch advances at most 1/30 second, using the existing 120 Hz simulation clock. Excess elapsed time is dropped. Under heavy load simulation can slow down; the UI does not wait for it to catch up. `stats.droppedSeconds` makes this visible.
- Props are queried through Planck's spatial index before the more expensive oriented-box prediction. Distant props skip that prediction test.
- SVG updates skip unchanged attributes and unchanged facial inputs. Rendering still costs time, especially for detailed artwork and many visible avatars.
- Hidden/offscreen browser players stop submitting time. Resume rebaselines motion. Disposal terminates the worker and rejects outstanding path requests. Scene replacement terminates the old worker, so old frames cannot overwrite a newer scene.
- A worker loading/runtime failure stops that player and calls `onError`. A browser without Worker support uses the main-thread adapter. Applications may explicitly request `execution: 'main'` for compatibility or comparison. A restrictive Content Security Policy must allow same-origin module workers and their bundled assets.

## Async controller

`SceneController` from `posecraft/scene` remains synchronous for Node, CLI, deterministic tests, and offline rendering. Browser players default to `WorkerSceneController`; their controller is a union of those two types. Worker setters enqueue commands. `frame()`, `step()`, `reset()`, `seek()`, and `previewClip()` return the latest received frame, which may precede the requested change. Do not mutate received frames. Use events, `onFrame`, or await `ready` for initialization. Command validation errors can arrive asynchronously through `onError` and error events. Editor document transactions remain synchronous.

```js
import { WorkerSceneController } from 'posecraft/worker';

const simulation = new WorkerSceneController(scene, { onError: console.error });
await simulation.ready;
simulation.onFrame = frame => renderer.update(frame);
simulation.setBehavior('dummy', { mode: 'protective' });
// Call step(elapsedSeconds) from the host's visible-frame loop.
// Browser/React adapters already own this loop.
```

The worker bundles with `new Worker(new URL('./simulation-worker.js', import.meta.url), {type: 'module'})`. Vite emits a separate hashed worker asset, including on GitHub Pages. Consumers using other bundlers must support this standard module-worker pattern. There is no shared-memory or cross-origin-isolation requirement.

## Cancellable obstacle routing

```js
const cancel = new AbortController();
const route = await simulation.findPath({
  start: { x: 40, y: 80 }, end: { x: 590, y: 300 },
  cellSize: 16, clearance: 12
}, { signal: cancel.signal });
// cancel.abort() rejects a pending request with AbortError.
// route.path is null when no route exists.
simulation.dispose();
```

Routing uses incremental four-neighbor A* against enabled, rotated prop collision boxes, inflated by clearance and a conservative cell allowance. Results contain cell-center positions, expansion count, and cell size. Endpoints must be inside scene bounds. The grid is capped at 16,384 cells, with up to 24 concurrent requests. Jobs expand in small batches and yield through timers after a roughly 2 ms slice so simulation commands can run between slices. A single expansion batch may exceed that target on a slow device. Callers should abort obsolete destinations before submitting replacements.

This is a static-obstacle route planner. It does not drive walking, decide goals, handle other avatars as moving obstacles, provide crowd avoidance, or implement foot placement. Existing protection remains authored poses selected by predicted contacts, not a model call. These capabilities can use the same worker boundary without blocking the UI, but have not been implemented here. Long replay seeks also execute in the worker; they can delay simulation responses while leaving the UI thread free.

## Measuring changes

Run `npm run test:performance`. The browser test checks worker lifecycle, a 16-avatar playground, queue bounds under overload, path completion/cancellation, pause, and a comparison using 24 physical dummies and 32 props. It writes machine-specific results to `test-results/performance.json`. The initial local Edge run measured 95th-percentile UI frame gaps of 36.1 ms on the main thread and 18.1 ms with a worker. This is a short local comparison, not a cross-device frame-rate guarantee.

The React playground offers 1, 4, 8, or 16 avatars and shows worker compute time, message round-trip time, and skipped simulation time. Studio reports worker compute time in its footer. Measure representative artwork and devices before increasing the scene limit of 24 avatars. Physical worlds remain per character; they duplicate static prop fixtures and do not collide with each other.

## Authored contact constraints

Scenes support up to 16 projected two-bone contacts. The scene worker evaluates them after the authored pose; Director uses its existing episode worker. The solver caches joint lookup, skips already-satisfied targets and stops refinement when angles stop changing. It uses a fixed search limit for unreachable targets.

A stress test of 16 unreachable contacts across eight 22-joint actors, with nonzero yaw/pitch and orientation preservation, measured 17.11 ms median and 21.05 ms p95 for contact solving alone. This was Windows x64, Node 22.23.2, Intel i7-1265U, 600 samples after 100 warmups. These are local measurements, not mobile guarantees or full render timings. At that extreme the worker can miss a 60 fps simulation budget; the UI remains separate and the existing queue stays bounded. Plain synchronous API callers should use a worker for similarly heavy scenes.

## Paused animation guides

Pose guides do no sampling during playback. Studio caches them until the selected pose or document changes. The sampler copies the selected clip and joint data instead of the entire artwork library, and path evaluation skips contacts for other clips. Ghost rendering uses only the selected character and its already evaluated pose. Path generation yields between batches of five intervals; edits and playback cancel stale work.

A desktop Node 22 benchmark on an Intel i7-1265U, with two warm-up runs and five measured runs, measured these median totals for a captured pose, two ghost samples, a 31-point joint path and two SVG strings:

| Scene | Initial implementation | Selected-data implementation |
| --- | --- | --- |
| Gym | 1,175 ms | 129 ms |
| Campfire | 183 ms | 27 ms |

These totals exclude browser DOM parsing and painting and do not measure phone performance. The Studio additionally yields between ghost renders and path batches. Run `node test/animation-preview-performance.mjs` to record timings on the current machine; the report goes to `test-results/animation-preview-performance.json`.
