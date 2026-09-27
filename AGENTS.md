# Working on Posecraft

Posecraft is a 2D animation studio for creating polished, reusable, living illustrations for websites and games. The intended reaction is: "This was created with Posecraft?" Little Lands Adventures, ukis.app and jelizarovas.com are its first consumers. They exercise the studio; their feature lists do not define its scope.

The current [product direction](docs/product-direction.md), established September 26, 2026, supersedes older plans that make native 3D, Blender production, a general game engine or film export the next required milestone. Keep existing work compatible; expand those branches only when the current user request calls for them. The first character is Wwwzard, following the [user-supplied style reference](docs/references/wwzard-style-reference.png): simplified isometric forms, soft faceted shading and a face concealed by the hat. Convey emotion through silhouette, posture, hands, hat and timing. The user rejected the existing SVG character's appearance; this is an art-direction requirement, not a ban on SVG as a rendering format.

## Values and decisions

- Authored quality comes first. Judge silhouette, composition, expression, timing, weight, contacts and transitions at actual embed size. More detail, effects, random movement or passing tests cannot make weak art finished. AI assistance must meet the same art and motion standard as any other tool.
- Build living systems from well-authored actions. Give behavior meaningful inputs, bounded state, memory, priorities and intentional transitions. Loops are useful ingredients. Stillness is valid; constant activity is not evidence of life.
- The studio is the product. Reusable artwork, motion, behavior and scene parameters must be editable, saveable, reopenable and exportable through shared contracts. A source-coded demo alone does not complete an authoring feature. Prove reuse on a second character or scene before claiming generality.
- Performance is a design constraint from the start. Declare numerical budgets for the target embed and devices before expanding assets or runtime features. Budget transfer, startup, decoded CPU/GPU memory, frame work, host-page responsiveness and multiple embeds. Measure against equivalent functioning scenes. A worker or GPU renderer is not proof of low cost.
- Spend computation only where it changes the result. Prefer shared assets, compiled scene data, cached static work and selective runtime modules. Sleeping, scheduled decisions, bounded work and deliberate quality tiers must preserve interaction semantics. Physics is optional. Do not require runtime model calls or a hosted service for ordinary exported playback.
- Keep the scope small enough to finish. New engine work must unblock a named authoring or website acceptance failure. Correct the shared system; avoid demo-specific patches, speculative rewrites and multiplying unfinished demos. Small complete scenes establish quality before a larger cast or world.

## Current delivery target

Complete one polished 2D living illustration through create/import, rig, animate, author behavior, compose, save/reopen and website export. Review quiet behavior, interaction, interruption, recovery and responsive layouts. Then reuse its authored capabilities in a second scene or character. See the [acceptance brief](docs/product-direction.md#next-acceptance-scene). This is a target, not a claim of current completion.

## Delivery

- Continue implementation through affected checks, local playback and correction of observed defects within scope. A first implementation is not completion. Report remaining limitations and evidence obtained; routine checks and repairs do not require a handoff.
- For visual changes, review full movements and transitions at game or embed size. Label placeholders. Distinct Littlelands villagers, children and animals need distinct designs and appropriate motion, not recolored or scaled hero pixels.
- Put reusable behavior and spatial fixes in the shared system. Identify any missing Studio, save/reopen or export support.
- Report visual quality, authoring/reuse, runtime correctness and website cost separately. Do not claim overall completion while one remains unverified. A documentation change does not establish new runtime capability.
- Compare performance with equivalent functioning scenes and settings. Record device and renderer; distinguish physical-phone results from emulation and account for decoded asset memory.
- Check the host page with one and several embeds, including scrolling, input, hidden/offscreen suspension, resume, reduced motion and disposal. Report unavailable physical-device evidence rather than treating emulation as a pass.
- Iterate Littlelands through full-window `play.html` on a host-exposed local server. Verify the phone-accessible address. Deploy when requested. Distinguish local delivery from deployment.

## References by task

Read only what the task needs:

- Product values, active scope and acceptance: [product direction](docs/product-direction.md).
- Rig, motion or visual acceptance: [quality contract](docs/engine-quality-reset.md).
- Littlelands character artwork: [production brief](docs/npc-asset-production.md); sprite/runtime tradeoffs: [rendering guide](docs/map-character-rendering.md).
- Scene authoring or embedding: [Posecraft skill](skills/posecraft/SKILL.md).
- Product scope or milestone planning: [requirements](POSECRAFT_REQUIREMENTS.md) and [roadmap](docs/studio-roadmap.md).

- Living illustration deformation, occlusion, interaction and delivery lessons: [Wwwzard findings](docs/living-illustration-lessons.md).

Historical findings explain decisions; they are not a current capability inventory. Keep detailed contracts in the linked guides rather than duplicating them here.
