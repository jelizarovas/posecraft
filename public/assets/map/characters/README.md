# Adventurer character

Source model and animations: Quaternius, Ultimate Modular Men Pack.
License: CC0 1.0 Universal, public domain dedication.

- Creator's pack: https://quaternius.com/packs/ultimatemodularcharacters.html
- License: https://creativecommons.org/publicdomain/zero/1.0/
- glTF sample distribution: https://github.com/godotengine/godot/files/9843669/Adventurer.zip

The map loads WebP atlases baked from `adventurer.gltf`. Idle, walk and run use the model's Idle_Neutral, Walk and Run clips. Jump samples the crouch and tuck from Roll. The roll uses the full recovery. Ridge climbing combines Kick_Left with Interact on the arms. Ridge descent plays that atlas in reverse.

## Rail and ledge actions

The offline baker poses the Quaternius skeleton with the joint targets in `tools/adventurer-traversal-poses.mjs`. It uses the locomotion camera, lighting and scale. The Root stays fixed. Knee compression and pelvis rotation belong to the pose. The map supplies travel and lift.

| Clip | Frames | Timing | Support |
| --- | ---: | --- | --- |
| `vault` | 14 | One crossing, sampled by traversal progress | The runner plants the left wrist at hip height, banks over it, sweeps both bent legs sideways and steps out on the left boot. Pin the wrist during progress 0.20 to 0.62 with the existing contact ramp. |
| `hang` | 6 | 1.2 s loop | The wrists hold the lip above the head while the hips sway and the boots brush the face at different heights. |
| `climbLedge` | 12 | 1.0 s one-shot | Frame 0 matches hang frame 0. The elbows pull down, the left boot hooks over the lip in frame 7, and the climber presses through it to stand. Transfer support from the hands to the ledge at frame 8 (zero-based). |

Each atlas has one 96 by 132 px cell per pose. Frames advance across columns. The 16 rows follow map heading in 22.5-degree increments. Display each cell at 60 by 82.5 with ground anchor `(0.5, 0.7997777105572947)`.

`examples/adventurer-crossing-anchors.js` exports `vaultSupportAnchors[direction][frame]` for the left wrist. `examples/adventurer-ledge-anchors.js` exports `ledgeHandAnchors[clip][direction][frame]` for the midpoint between the two wrists. Both use cell pixels measured from the top-left. To place the ledge at a fixed screen point, multiply the cell anchor by 0.625 and subtract it from that point. The hang grip is 22 to 29 cell pixels below the top, depending on heading. During the pull-up the wrists move down the cell as the shoulders rise over the edge. Release the hand pin for the final stand.

The manifest records clip dimensions, timing and per-frame anchors. With a local Vite server running and `POSECRAFT_URL` set to its origin, this command rebuilds the three sheets.

```sh
node tools/bake-map-character.mjs vault hang climbLedge
```

The baker writes transparent PNG masters and quality-92 WebP copies using Python and Pillow. The three [contact sheets](../../../../docs/review/adventurer-traversal/) show every heading at game size and one heading enlarged three times.
