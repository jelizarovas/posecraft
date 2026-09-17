# Ona integration audit

Inspected local Ukis source at HEAD `d1d7fcd`. This is a source and runtime-inventory audit, not a visual approval or full security audit. Ukis files were not modified.

## Verified inventory

The renderer exposes 37 scene IDs. All 28 dashboard activity IDs resolve to authored scenes. `focus` is not authored; the current React adapter's default resolves to `inbox`.

Nine scenes use full-scene traces: inbox, bath, connect, read, walk, work, rest, desk, cat. The remaining 28 use composed actor and prop groups.

The reusable traced actor has head, clothing, one mirrored arm source, and two shoe sources. It supports 14 pose presets. A whole arm rotates at its shoulder; upper arm, forearm, and palm are not individually rigged. Rusty has standing artwork and a seated body/head split, without a full leg rig. The cat trace has Jordan marking channels but no verified standalone articulated cat pack.

Hair already has six styles with front/back layers. Actor roles include primary, partner, guest, child-1, child-2, clinician, and interviewer. Preserve role-specific appearance without treating a role as a person's identity.

## Rigging gaps

| Area | Current source | Required work |
| --- | --- | --- |
| Ona arms | Single arm trace mirrored for each side | Separate elbow and palm artwork, establish pivots and joint-cover geometry |
| Ona face | Head trace includes eye/glint paths | Bind eyes independently while preserving the approved head silhouette |
| Walking | Rotated shoe groups and static pose presets | Establish leg/hip articulation and contact timing, then validate silhouette |
| Nine traced scenes | Mostly one body group containing scene paths | Segment character, props, and occluded surfaces before articulation; keep originals as static fallback |
| Rusty | Standing paths; seated head/body groups | Leg, neck, tail, and collar anchors with consistent transforms |
| Cat | `jordan-markings` inside the cat scene | Confirm identity and obtain/separate a full character rig; do not rename to Miau Miau |
| Props | Most props placed at scene coordinates | Add grip anchors and ownership so moving hands carry props |
| Leash | Hand/collar circles and CTM-based connector | Preserve endpoints; scope multiple connections by explicit instance IDs |

Reusing the composed actor is useful for the first rig, but replacing a traced scene with that actor without visual comparison would change its artwork. Avoid claiming automatic trace-to-rig conversion.

## Integration risks

`AvatarScene.jsx` uses a global renderer and emits a decorative SVG string. It exposes only scene, appearance, state, and className. Low-level placement, hair, pets, and per-actor settings are not exposed through that wrapper.

The renderer temporarily stores scene hair and Rusty settings in module variables, restoring them in `finally`. That is synchronous today, not proof of a current cross-instance failure. A new adapter should pass all instance settings explicitly.

CSS implements blinking, arm waving, and body bounce. The traced greeting rotates the body group rather than articulating an arm. These transforms must not compete with a new rig's internal transforms.

The panel motion code clones artwork, strips every ID, and disables descendant animations/transitions without baking their computed animated transforms. A clone therefore does not reliably retain the displayed pose even before introducing masks or gradients. Future clip paths, masks, gradients, or accessible title references would also lose their targets unless references are preserved/remapped. Its root transform reset means placement should remain in an inner group. Keep modal/dock choreography unchanged; integrate through the frozen-frame ownership protocol proposed in contract-proposal.md.

Ona's local LICENSE is MIT, copyright 2026 Arnas. Preserve that notice if source/art is copied. Posecraft's package remains private and UNLICENSED; this audit does not change that license or verify provenance beyond the supplied files.

## Reproduce the inventory

From the Posecraft folder, run:

```sh
node tools/audit-ona.mjs C:/apps/ukis.app
```

The tool evaluates trusted local renderer files in an isolated VM context, lists scene/part coverage, and asserts that each dashboard activity has an authored scene. It does not write to Ukis or include its artwork in Posecraft's package archive. A VM context is not a security sandbox for arbitrary downloaded code.
