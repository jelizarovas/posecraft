# Shared props and Catch

Shared objects use one scene position and one grip owner. They are saved in `scene.objects`; the same fixed-step solver runs in the Studio, worker and lightweight website export. Studio → Scene → Objects & catching adds a ball, edits its physical settings, saves a starting grip, tests reachable grips/transfers, and creates a passing game. Every saved edit is an ordinary undoable document transaction.

## Object contract

Declare `scene-objects` in `requiredFeatures`. Up to 64 objects support dynamic circles and static circles/rectangles. Circle radius is 4–200 scene pixels; mass is 0–100, with zero meaning static. Objects declare restitution, friction, air damping, category/mask bits, color and scene depth. Static rectangles can rotate. Scene props with enabled collision boxes participate too. `objectPhysics` controls downward gravity, floor height and the actor-fixture bridge.

An optional `owner: {actor, joint, offsetX?, offsetY?, breakDistance?}` is an authored starting grip. Playback displays it at the solved joint even before the first tick. Static objects cannot have owners. Live commands acquire ownership only within the configured reach tolerance:

```js
controller.objectCommand({type:'attach', object:'ball', actor:'ona', joint:'rightWrist'});
controller.objectCommand({type:'transfer', object:'ball', from:'ona', actor:'fern', joint:'leftWrist'});
controller.objectCommand({type:'release', object:'ball', vx:180, vy:-350});
controller.objectCommand({type:'impulse', object:'ball', vx:30, vy:-100});
```

`place` explicitly relocates an object and releases its owner; `enable` changes participation. A transfer names the current owner and checks the receiver's reach. Missing/hidden owners and exceeded break distance release the grip on a fixed tick. Frames expose `objects`; events include `object-attached`, `object-released`, `object-grip-broken` and `object-impact`. Scene and actor graphs can use `{type:'object', command:...}` actions and receive object events. The Studio's graph effect editor exposes all six command types.

Animated actors provide kinematic circular fixtures sampled from rig body bounds. Physical actors receive an opposite, bounded impulse in their existing Planck world. This is a bridge to independent ragdoll worlds, not general avatar-to-avatar collision or a common articulated solver. Held objects are kinematic. Dynamic polygons, angular collision response, stacking guarantees and cloth remain outside this solver.

## Passing games

`scene.objectGames` plus `prop-games` describes up to eight passing games. Each ball belongs to one game and each actor to one game. A game has a seed, throw variation in pixels, flight time, preparation time, and two to eight participants. Each participant declares an IK chain, root, optional head/feet, bend direction, speed, skill, reaction delay and pickup crouch. The object inspector can create and remove a game and edit all participant references.

The runtime prepares, releases, observes after a delay, predicts a damped trajectory at a bounded planning rate, attempts a reachable catch, or waits for a miss to settle before walking and stooping to retrieve it. Successful catches and pickups change the same object's owner. Misses do not teleport it into a hand. Players return toward their marks and maintain spacing. An external owner interrupts the game; release or return to a participant resumes it. Hidden participants pause the game. Actor pose previews bypass its pose overrides.

Interception predicts free flight, not future ricochets. Walkers stop at blocking collision boxes; they do not have a general obstacle-detour planner. A blocked pickup emits `retrieval-blocked` and retries after settling. Reactions/throws/skill are seeded, and snapshots retain the game and shared-body state.

## Verification

`test/scene-objects.test.js` and `test/scene-objects-edge.test.js` check ownership, reach, release velocity, thin rotated obstacles, bounded work and deterministic catch/miss/retrieve cycles. `test/object-tools-browser.mjs` checks creating a game, editing rigs, graph commands, transfers, undo/reload and mobile layout. `test/roadmap-browser.mjs` compares full, illustration and worker output and captures eight reproducible samples. `test/catch-export-browser.mjs` builds and opens an independent website, excludes Planck, and compares its 35-second result with full playback. Cross-runtime comparisons allow only 1e-8 numeric rounding; same-browser replay uses exact values.
