# Map character rendering

For replacement NPC and animal artwork, follow the [asset production brief](npc-asset-production.md) and [per-character shot list](npc-asset-shot-list.csv). They specify distinct source designs, action frames, tool contacts and mobile packaging. They are production instructions, not completed assets or implemented loader features.

## What the current demo uses

Littlelands currently draws a baked sprite character. The source is a rigged Quaternius glTF with 24 animation clips. The map loads idle, walk, run, jump and roll WebP atlases, each with 16 directions. Walk and run each contain 12 frames per direction; idle contains one, jump eight and roll sixteen. The hop uses crouch/tuck poses sampled from the authored Roll clip; the roll includes its recovery. World movement and jump height belong to the runtime, not the images.

The five WebP files total 1,472,290 bytes on disk. Their combined dimensions contain 70,647,808 bytes of RGBA pixels, about 67.4 MiB, before renderer-specific copies or mipmaps. Identical characters can share these images. Separate costume atlases add separate decoded images.

This is a rendering choice for this demo, not the source animation format. The glTF skeleton and authored clips remain available in `public/assets/map/characters/adventurer.gltf`.

## Equipment and new actions

With the current complete-body sprite sheets, a new animation needs another baked clip and equipment that changes the silhouette needs new imagery. Baking complete outfits multiplies the storage required by the outfit count, directions and animation frames. The current map schema selects idle, walk and run, plus optional jump and roll clips; it does not yet expose arbitrary actions, equipment or a live glTF character.

Sprite layers can avoid baking every outfit combination: separately authored helmets, armor and weapons can follow the same direction and frame indices. Those layers still need matching animation, alignment and front/back ordering. They do not automatically follow a 3D skeleton. Palette changes are simpler but cannot change geometry.

For an equippable player character, the intended implementation is a live skinned model:

- Clothing and armor use the compatible character skeleton and weights. Hide covered body geometry to prevent clipping.
- Weapons and rigid accessories attach to named skeleton sockets.
- Walking, casting and dancing use animation clips and blending. A new motion requires an authored or retargeted clip, not new rendered frames for every costume.
- Spell particles, projectiles and ground effects are separate scene objects. They can themselves use sprite sheets or GPU particles.
- Use bounded mesh complexity, shared materials and textures, and distance-based animation updates. Live skinning has a cost and must be benchmarked with the intended character count.

Static scenery and fixed-background NPCs may remain sprites. Both character representations must use the same world coordinates, action state, movement, contacts and scene occlusion. A separate 3D overlay with independent depth would repeat the clipping problems that motivated the spatial engine work.

## Implementation boundary

The current map performance pass preserves the sprite character while reducing camera-dependent scenery work. It does not implement equipment swapping, spell/dance authoring, or live map skinning. Those require a shared GPU scene/depth integration; the existing native 3D character importer provides reusable asset handling, but is not already wired into the map.
