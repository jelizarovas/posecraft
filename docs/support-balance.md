# Support balance and muscle resistance

Posecraft has two different ways to create physical-looking movement. The articulated physics path uses Planck bodies for authored collision proxies, revolute joint limits, and gravity. Protective mode drives those joints toward authored target angles with bounded motors scaled by body mass and the resistance setting. It can brace, protect the head, and recover from falls. This is more than one rigid box around a character.

Authored animation uses joint poses and projected contact solving. This is the path used for precise bar grips and gym action variations. Its hand contacts are positional constraints, not physical forces. Physics and recovery frames skip those contacts, and live action poses apply only in animated mode. Switching a character to ragdoll therefore does not automatically turn an authored hand grip into a physical attachment. A character also needs an explicit collision profile before it can use ragdoll mode. Each physical character currently has its own world with static props and bounds; actors do not exchange collision forces.

## A support target for authored poses

`sampleSuspendedSupport` supplies a bounded root position and body roll for a body suspended from a support. It uses an authored estimate of the body's center of mass to bring that point toward the gravity line beneath the supporting hand. This is an analytic pose helper; it does not run Planck, infer muscle anatomy, or claim to calculate physical torque.

```js
import {sampleSuspendedSupport} from 'posecraft/support-balance';

const support = sampleSuspendedSupport({
  anchor: {x: 137, y: 150},
  restCenter: {x: 180, y: 300},
  centerOffset: {x: 0, y: -30},
  resistance: 0.65,
  load: 1,
  elapsed: 2,
  maxLean: 12,
  maxShift: 64
});
// Move the authored root to support.center and rotate the body by
// support.rotation, then solve the supporting hand's contact again.
```

All points use the same coordinate space. `restCenter` is the unmodified body/root reference position. `centerOffset` is the estimated mass-center offset from that reference before body roll; keep it separate from decorative artwork or a held object's pivot. A left-side anchor derives positive screen-space rotation, bringing the upper body rightward above the shifted hips. The mirrored right-side anchor derives negative rotation.

The helper preserves the root's position along gravity and corrects only perpendicular to it. With ordinary downward gravity, root Y stays unchanged. It never invents an upward lift to hide a reach problem. If the requested horizontal shift exceeds `maxShift`, the result is limited and reports `limited: true`; the caller must choose a reachable pose or another movement.

Resistance has a visible but bounded effect: strong muscles retain up to 20% of the authored lateral posture, while low resistance yields closer to the gravity line. `load` scales the correction from zero to one; zero preserves the original root and zero roll exactly. An optional `rotation` supplies a desired roll instead of deriving it, still bounded by `maxLean` and load. For a one-hand transition, blend load with the grip transfer and keep the original authored endpoint at load zero.

`elapsed` evaluates a closed-form critically damped response; there is no hidden simulation history, so scrubbing and seeking give the same result. Omitting it returns the settled target. `settle` controls response time. Optional `amplitude` adds a bounded, decaying lateral sway; its default is zero. `centerOfMass`, `lateralError`, `alignment`, and `target` expose the calculation for inspection. The center of mass here is the supplied approximation after roll, not a sum of simulated body masses.

For multiple anchors, replace `anchor` with up to eight `supports: [{x, y, weight}]`. Weights choose their average support point; at least one weight must be positive. This represents an authored load transfer, not a solved distribution of joint forces. Optional `gravity` changes the gravity direction. Invalid, nonfinite, or out-of-range inputs are rejected.

Apply this helper before the final grip/foot solver. It does not move individual limbs, enforce reach or joint limits, handle collisions, or replace contact constraints. A future physical grip would need an actual constraint in the shared physical world, with explicit transitions between animation and physics; it should not be approximated by enabling ragdoll while leaving authored contacts active.
