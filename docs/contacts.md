# Contacts and grips

In Studio, choose **Scene**, select an actor, then **Contacts & grips**. Add a contact, choose a hand or foot, and set **Hold onto** to a scene point, another actor's joint, a shared object or a prop. The two parent joints bend to reach it. A scene point can plant a foot; a shared object can provide the moving grip for a handoff.

**Use current hand / foot position** captures the visible endpoint. Target X/Y use scene coordinates; offsets on a joint target use that joint's local coordinates. Choose the knee/elbow side, then adjust strength. The solver respects joint rotation limits and preserves the hand or foot's authored screen orientation where its limits allow.

Use **During animation** to restrict a contact to one clip. Start and end use that actor's clip time, including while editing a clip. **Repeat every** applies the same window inside each repeated interval, such as a 60-second set inside a 180-second workout. Zero leaves the window on ordinary clip time. Disabled contacts remain in the project.

**Fade in** and **Fade out** ramp contact strength linearly at the window edges. Both default to zero. Their sum must fit inside the active window, and the ramps repeat with it. A half-strength contact blends the joint rotations halfway toward the solution; its endpoint need not lie halfway along a straight line to the target. Author the surrounding pose to make the approach look natural.

Purple crosses mark targets. An orange line shows the gap when the limb cannot reach. The inspector reports the distance. Move the target, adjust the actor's torso pose, or change a joint limit; the solver never stretches bones or silently moves the actor's body. Removing a target actor also removes its dependent contacts, and Undo restores them.

Contacts are saved in project JSON and evaluated by the scene worker, plain runtime, React adapter, and Director. Studio's whole-scene preview lets you inspect both actors together. Editing one character's clip previews that actor at the selected clip time; use whole-scene scrubbing to evaluate the target's matching motion.

## API

Import `applyContacts` and `solveContact` from `posecraft/contacts`. A scene stores at most 64 contacts and lists `contacts` in `requiredFeatures`.

```js
scene.contacts = [{
  id: 'left-grip', name: 'Left hand on handle', enabled: true,
  actor: 'carrier',
  chain: { upper: 'leftUpper', lower: 'leftLower', end: 'leftHand' },
  target: { type: 'joint', actor: 'furniture', joint: 'handle', offsetX: 0, offsetY: 0 },
  bend: 1, weight: 1, start: 0, end: 4, keepOrientation: true
}];
```

A fixed target is `{type: 'point', x: 300, y: 400}`. A live shared-object target is `{type: 'object', object: 'gift', offsetX: 0, offsetY: -5}`. A prop target is `{type: 'prop', prop: 'handle', offsetX: 8, offsetY: 0}`. Object and prop offsets use scene units and rotate with their target. Attached props resolve their live attachment before the contact solve. A disabled prop collision box does not disable its visual contact target.

Optional `clip` names an existing source clip. Optional `period` repeats the window. Optional `fadeIn` and `fadeOut` use seconds. Declare `contact-targets` alongside `contacts` in `requiredFeatures` when using object/prop targets or fade fields.

Frames include `contacts` diagnostics with `active`, `reason`, `target`, `actual`, `error`, `limited` and effective `weight`. Coordinates and errors use scene units. Missing, disabled or hidden targets return `target-unavailable` with `target: null`, `error: null` and zero weight. Holding an object disables a contact from that actor to the same object with `self-owned-object`; the same rule covers artwork attached to that object. A prop attached to the source actor's own joint returns `self-attached-prop`. This prevents a hand from chasing a target that its own movement controls.

`solveContact(pack, pose, chain, target, options)` accepts a target in actor coordinates and returns a new pose. `applyContacts(scene, frame)` evaluates all constraints without mutating the input frame. Both upper and lower bones retain their authored yaw, pitch, translation and length. Targets on other actors are sampled from the unconstrained frame, so mutual contacts do not create an order-dependent feedback loop.

## Motion review

The gym and staircase gallery demos have a **Review** action selector, quarter/half speed, **Loop action**, and a one-frame step button. Selecting an action pauses at its start. Enable the loop and press Play to review a transition repeatedly. These controls do not change the exported animation speed.

Gym sets now have separate preparation, variable rep timing, fatigue, release, recovery, walking, sitting, reclining, bench presses, standing and return phases. Each round is 60 seconds; the alternating workout is 180 seconds. Scene clips, worker scrubbing and timeline edits support that duration while retaining bounded key counts.

## Limits

These are projected two-bone constraints, not a shared physical load simulation. Contacts are skipped while their source actor is under ragdoll or recovery control. Contacts do not acquire object ownership; use an explicit shared-object attach or transfer command after the hands meet. Fade windows soften the pose change but do not plan an approach, recognize a grasp, balance a torso or move fingers. Folders still organize visibility and layers; they do not transform their contents as a group.

Use different limbs for simultaneous contacts. Overlapping constraints on the same chain are applied in document order. Turning a limb edge-on can make a target unreachable even when it lies inside the unturned limb's reach.

`npm run test:contacts` checks Studio authoring, persistence, target cleanup and compact layouts. The unit suite checks transforms, joint limits, timing, projected reach, and portable scene validation.
