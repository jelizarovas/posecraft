# Authored native 3D character assets

Models by Quaternius, from **Universal Base Characters Standard**, downloaded from the creator's official itch.io page on 2026-09-18.

- `athlete.glb`: Superhero Male FullBody. Display name: Athlete A (Superhero Male).
- `regular.glb`: Superhero Female FullBody. Display name: Athlete B (Superhero Female). The filename is a stable demo URL; this is not the pack's paid Regular model.

The free Standard edition contains these two bodies. The models are authored skinned meshes with distinct proportions, 65 bones including fingers, and original PBR materials. The included files contain no animation clips or facial morph targets. The importer preserves those when provided by another GLB.

Original vertex positions, triangles, skin weights and inverse bind matrices are unchanged. Source buffers and textures were embedded into GLB. For web delivery, body color maps were resized to 1024px and encoded as JPEG quality 90, body normal/roughness maps to 512px PNG, and the hair atlases used by the eyebrows to 256px PNG. Eye textures retain their original 256px size. Missing `_png.png` aliases in the source export were resolved to the corresponding supplied `.png` files. Exact source names, hashes and archive provenance are recorded in `provenance.json`.

License: **CC0 1.0 Universal**. The original pack notice is retained with trailing whitespace normalized in `LICENSE-Quaternius.txt`.

- Official pack: https://quaternius.com/packs/universalbasecharacters.html
- Official download: https://quaternius.itch.io/universal-base-characters
- License: https://creativecommons.org/publicdomain/zero/1.0/

These assets are demonstration characters, not a claim of complete wardrobe, facial animation, gripping, or full-body collision support.
