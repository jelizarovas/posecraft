# Moving contacts and attached artwork

This increment adds shared prop targets to the existing contact solver and makes attached prop artwork editable in Studio. It continues the [September architecture implementation](implementation-2026-09-17.md).

## Shared runtime

Contacts can follow a scene prop or a live shared object, including a rotated offset. `fadeIn` and `fadeOut` ramp their strength within the active clip window. The solver keeps joint limits and reports effective strength, reach error and why an unavailable contact is inactive. A character cannot chase an object that it already owns, including through artwork attached to that object.

Props can attach to actor joints or shared objects. SVG and Canvas use the same `evaluatedProps` helper; mounted SVG updates existing prop nodes. Joint offsets follow character scale and projected joint direction. Artwork dimensions remain scene units. Attached decoration cannot also be a static collider. Hidden or disabled targets hide the attached artwork instead of resetting it to an unrelated position.

Full and lightweight scene players expose current object positions before solving object-target contacts, then update held objects from the final grips. This does not create another physical body or owner. The existing fixed-step ownership rules still decide whether a transfer succeeds.

Director evaluates saved object ownership against shot placement and pose, before and after contacts. Its authored frames do not run object physics, Catch, live transfer commands or decision graphs. Portable project bundles retain the new references. Importing an interactive scene into Director is not a recording of that scene's live events.

## Studio and agent tools

The Scene prop inspector has an **Attach artwork** section with target, joint, offsets and rotation inheritance. Applying an attachment disables its static collider in the same transaction. Detaching, or removing its shared object, captures the visible placement and leaves collision off. If its target is unavailable, the saved base placement is retained. Undo, redo and reopening preserve bindings.

**Contacts & grips** lists points, joints, props and shared objects. Bound targets expose offsets; point targets can capture the current hand or foot. Contact fades must fit together within the active window. Invalid edits leave saved data unchanged.

The semantic contact builder adds the new required capability automatically. Scene inspection now returns independent copies of objects and props, including ownership, collider and attachment details. Agents can discover valid target IDs before proposing a contact.

## A little handoff

The new [demo](https://jelizarovas.github.io/posecraft/demos.html#a-little-handoff) uses two Ona instances, editable give/receive clips, one shared gift and five attached rectangles for its artwork. Clover offers the gift, Moss receives it at four seconds, and returns it at eight seconds. The ten-second loop uses ordinary graph actions and contact windows. Transfers require the receiving grip to be within 0.5 scene units; moving Moss beyond reach blocks the transfer. The exchange counter advances only after a confirmed return.

The gallery provides four paused acting beats and a restart control. **Edit in Studio** opens the same data. A reviewed six-frame sheet covers the offer, both contacts, the change of owner and the return. This is an authored exchange, not a general social action planner.

## Verification and limits

All 438 unit tests pass. Focused coverage includes rotated/scaled attachments, authoritative object positions, hidden targets, unavailable-target diagnostics, self-reference guards, fades, joint limits, object command replay, ownership continuity, blocked transfers, shot placement and portable projects. Browser checks pass for stable SVG prop nodes, worker and compiled player parity, actual Studio undo/reload, detach placement, contact editing and mobile layout. Type checking, the production build and package contents also pass.

The compiled handoff runs without Planck. Physical motion baking explicitly rejects attached-artwork scenes until their timing and dependencies can be captured together. Decorations remain rectangular scene props; attachments do not add arbitrary imported artwork, articulated prop collisions, automatic full-body balance or inter-actor depth testing. Existing layer and scene-depth controls decide where the decoration draws.

Guides: [attachments](attachments.md), [contacts](contacts.md), [Director](director.md). Reproduce the main checks with `node --test test/contacts-targets.test.js test/scene-attachments.test.js test/handoff.test.js test/episode-object-contacts.test.js`, `npm run test:handoff`, `npm run test:attachments`, and `npm run test:roadmap-release`.
