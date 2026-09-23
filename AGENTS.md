# Working on Posecraft

Posecraft prioritizes convincing scenes, reusable authoring and low website cost over feature breadth. Visual acceptance and runtime correctness are separate requirements.

## Delivery

- Continue implementation through affected checks, local playback and correction of observed defects within scope. A first implementation is not completion. Report remaining limitations and evidence obtained; routine checks and repairs do not require a handoff.
- For visual changes, review full movements and transitions at game or embed size. Label placeholders. Distinct Littlelands villagers, children and animals need distinct designs and appropriate motion, not recolored or scaled hero pixels.
- Put reusable behavior and spatial fixes in the shared system. Identify any missing Studio, save/reopen or export support.
- Compare performance with equivalent functioning scenes and settings. Record device and renderer; distinguish physical-phone results from emulation and account for decoded asset memory.
- Iterate Littlelands through full-window `play.html` on a host-exposed local server. Verify the phone-accessible address. Deploy when requested. Distinguish local delivery from deployment.

## References by task

Read only what the task needs:

- Rig, motion or visual acceptance: [quality contract](docs/engine-quality-reset.md).
- Littlelands character artwork: [production brief](docs/npc-asset-production.md); sprite/runtime tradeoffs: [rendering guide](docs/map-character-rendering.md).
- Scene authoring or embedding: [Posecraft skill](skills/posecraft/SKILL.md).
- Product scope or milestone planning: [requirements](POSECRAFT_REQUIREMENTS.md) and [roadmap](docs/studio-roadmap.md).

Historical findings explain decisions; they are not a current capability inventory. Keep detailed contracts in the linked guides rather than duplicating them here.
