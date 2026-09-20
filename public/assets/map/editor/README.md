# Map editor artwork

Eight original textures and prop sprites generated with the built-in `image_gen` tool on 2026-09-19. Exact prompts and generation source filenames are recorded in [prompts.json](prompts.json). The runtime WebP files preserve the generated dimensions and transparency. The fence and ridge also retain their original PNGs here.

The source PNGs were encoded as WebP quality 88 for local/browser use, or quality 90 for the fence and ridge. No silhouettes, backgrounds, or image geometry were changed during encoding.

`examples/map-editor-catalog.js` declares display sizes, anchors, and independent collision presets. Branches trigger automatic hand-supported vaults. Fences and rocky ridges require a click to cross. Bushes and gravestones have small ground footprints; the split wreck uses two solid sections with an open passage.

The new terrain textures are requested as seamless material samples, but visual seams should still be reviewed at the intended zoom. Generated art is not a source of collision geometry.
