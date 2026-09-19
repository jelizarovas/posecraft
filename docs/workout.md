# One More Rep and reusable native actions

The [live workout](https://jelizarovas.github.io/posecraft/demos.html#gym-routine) now uses the native character rig. [Open the same project in Studio](https://jelizarovas.github.io/posecraft/native-studio.html?demo=gym-routine). The [recorded illustrated version](https://jelizarovas.github.io/posecraft/demos.html?legacy=1#gym-routine) remains a comparison and clip-authoring fixture.

## What owns what

`workout3d` JSON stores the selected character, equipment placement, camera, workout order, repetition range, seed and recovery thresholds. The director chooses a set, rest or water break. Separate mechanisms handle walking, pull-ups, the bench sequence, reaching for a bottle and replacing it. Renderers display the solved pose and object transforms.

The director advances when a mechanism finishes. This is an indefinite live illustration, with no 60-second movie wrapping underneath it. A requested action waits for the current mechanism's safe boundary. Bench cancellation reracks and releases before leaving; it does not drop the loaded pose. Exercise failure and an impossible contact are separate outcomes. An impossible mechanism stops with an authoring diagnostic.

The same director runs in the native worker, Studio, the gallery and the exported website. Fatigue and dehydration change exercise outcomes and recovery decisions. The saved seed makes the choices repeatable. Runtime control commands are journalled for replay inside that session; saving a project saves its initial configuration, not an in-progress body pose.

## Game commands

The native adapter uses the same named-action pattern as the illustrated game API. It has an explicit capability manifest; it does not claim to support the illustrated `lookAt`, dialogue or arbitrary prop commands.

```js
import {createWorkoutGame} from 'posecraft/workout-game';

// view is the native view exposed by the mounted exported player.
const game = createWorkoutGame(view, {onCommand: () => player.play()});
const atlas = game.actor('atlas');

try {
  await atlas.do('bench', {target: 'bench'});
  await atlas.do('drink', {target: 'bottle'});
} catch (error) {
  // A failed attempt or an invalid target is a real action outcome.
  showOutcome(error.message);
}

const sequence = atlas.sequence([{do: 'pullup'}, {do: 'rest'}]);
await sequence.finished;
game.dispose();
```

Commands are `pullup`, `bench`, `rest` and `drink`. Completion promises settle from director events. An `AbortSignal` requests cancellation; its promise rejects after safe cancellation is acknowledged. Dispose the game facade before its view. Pause/offscreen suspension also pauses completion, since simulation time owns the movement.

The lower-level `createWorkout3D` export accepts a rig, its declared limb roles and grip frames, and a project. It exposes `sample(time)`, `request`, `cancel`, `setVariable`, `reset`, `snapshot` and `describe`. It has no rendering dependency or animation timer. Native actions accept world-space equipment transforms and use actual rig segment lengths. They do not stretch a limb to meet an unreachable target.

The native view uses `renderAsync` for worker playback. Controls and resizing do not reconstruct past motion on the main thread. Explicit synchronous `sample` or `render` calls are authoring operations and may replay session history; await pending command acknowledgements before calling them.

## Studio and export

Studio can change the workout order, recovery thresholds, seed, repetition range, character, equipment transforms and camera. Undo, JSON save/reopen and Website export retain these values. Website export embeds the selected character and native player; it does not require the demo source or the legacy physics engine.

The mechanism modules are `locomotion-action-3d`, `pullup-action-3d`, `bench-action-3d` and `drink-action-3d`. They can be sampled independently to review an action. Named targets currently address one bench, one pull-up station and one bottle. This is a reusable workout contract, not a general-purpose room planner or unrestricted full-body physics controller. Low bottles that require crouching, tilted equipment and unsupported rig proportions need an appropriate authored mechanism or an explicit error.

Further acting should extend these shared mechanisms and their visual checks. Towels, celebrations and a complete mouth/jaw rig remain future work.


## Acting and room interaction

The native workout now chooses left- or right-hand pull-up entries, short one-arm rests and one-hand releases. Repetitions have a sticking point, alternating shoulder effort and a slower final push. Bench presses tilt the actual bar with the lagging hand; both palm targets follow it. Failed presses tremble briefly before recovery.

Studio's Pull-up grip and Bench entry controls can fix a variation or vary each set. Those choices are stored in `workout.pullupStyle` and `workout.benchEntry` and use the same solver in the gallery, worker and HTML export. The side-reach entry reaches toward the rack while reclining, then braces for the clearance shift before taking the loaded bar. Seated scoots use fewer leg pushes, with planted feet supporting the lifted pelvis and hands resting on the thighs. Sit/stand transitions are shorter.

Walking includes hip/chest counter-rotation, lateral weight shift, arm swing and head glances. Resting includes breathing and looking around. `frame.face` supplies deterministic blink, strain, tiredness and relief controls. The imported adapter uses existing named facial morphs where present and calibrated eye/brow deformations for the bundled characters. Their assets do not yet include mouth/jaw morphs; `breath`/`jawOpen` controls can drive an imported model that has them.

The shared native view adds the gym's wood floor, overhead beam and two hanging lights above the equipment. Drag a shade with a mouse or finger; its cable stays taut, it swings after release, and its spotlight follows. Dragging empty space still orbits the camera. Lamp motion is transient interaction state and resets with the scene; the authored equipment positions determine the anchors. The standalone bench study retains its neutral environment.


## Hanging dynamics

Pull-ups now use a fixed-step suspended-body simulation around the loaded grip. Gravity acts on the offset between the grip and the pelvis, muscle resistance and damping oppose that torque, and angular velocity continues through grip transfers. Passive arm and leg links respond to torso acceleration with their own pendulum periods. Active palm contacts are solved against the bar after the body simulation. No limb stretches are introduced.

`PullupFrame3D.physics` reports angles, angular velocities, gravity/muscle/damping contributions and the support pivot. The simulation runs at 120 Hz with cached states, so render frame rate and backwards seeking do not change the result. It runs in the existing motion worker and is included in native exports.

This models suspension and passive limb motion. Repetition height remains muscle choreography; it is not a complete collision ragdoll or a force-driven lifting simulation. Grounded approach and landing still use the authored action transitions.
