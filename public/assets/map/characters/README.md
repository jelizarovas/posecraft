# Adventurer character

Source model and animations: Quaternius, Ultimate Modular Men Pack.
License: CC0 1.0 Universal, public domain dedication.

- Creator's pack: https://quaternius.com/packs/ultimatemodularcharacters.html
- License: https://creativecommons.org/publicdomain/zero/1.0/
- glTF sample distribution: https://github.com/godotengine/godot/files/9843669/Adventurer.zip

`adventurer.gltf` is the source model. `tools/bake-map-character.mjs` renders Idle_Neutral, Walk, Run and Roll into 16-direction PNG atlases. Jump is a short crouch and tuck sequence sampled from the authored Roll poses. Roll keeps the full authored recovery to standing. The baker removes horizontal armature motion because the map controller owns displacement. WebP derivatives use Pillow quality 92. `animation.json` records the camera, framing and clips.

Vault combines the authored Roll crouch and tuck with Interact's left-arm reach. The baker records the projected left-wrist position for every frame and direction. The Canvas2D renderer pins each changing wrist anchor to the traversal's support contact, so the torso and legs move around one planted hand while crossing a branch or fence. Ridge climbing keeps Kick_Left at full weight while applying Interact only to the arms for a clear raised knee and reaching hands; descent reuses the same 96×132 atlas in reverse.

The map loads only the WebP atlases. The source model and Three.js are used during baking, not by the map at runtime.
