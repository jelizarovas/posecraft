# Woodland map artwork

The woodland refresh adds `terrain/meadow-v2.webp` and `terrain/road-v2.webp`, generated with the built-in image tool and encoded as WebP at quality 88. Exact prompts are in [terrain-v2-prompts.json](terrain-v2-prompts.json). Grass repeats over eight cells, with clover, tufts and dry patches; road material repeats over six cells, with pebbles, hoof marks and puddles. Cached road-edge wheel ruts follow the authored road direction. Previous texture files remain available for saved maps. The character uses a muted olive tunic, leather equipment, shaded skin and directional clothing shading to fit the woodland palette while retaining its procedural walk rig.

Ten original images generated with the built-in image-generation tool on September 19, 2026: three trees, two rock formations, an inn and four terrain materials. These are original fantasy illustrations, not extracted game assets. Distributed with Posecraft under its MIT license.

The demo uses WebP derivatives totaling about 858 KB. Original PNGs sit beside their WebP files and retain the generated alpha. Trees have a maximum edge of 640 pixels, rocks 384, terrain 512 and the inn 896. WebP quality is 86 with alpha quality 100. The renderer shares decoded images by URL and draws only visible scenery.

Exact generation prompts and source metadata are in [root-prompts.json](root-prompts.json) and [props-prompts.json](props-prompts.json). Placement, variant bindings and terrain repeats are authored in `examples/woodland-map.js`. Sprite anchors identify the ground point, rather than the bottom of the image. The inn uses a two-by-two-cell footprint, with its entrance on the +Y wall.

When moving a downloaded map to another site, copy this directory to that site's `assets/map` directory or update its `art.images.*.src` URLs. Cross-origin images need CORS permission to preserve canvas export and alpha sampling. The JSON stores references, not embedded image bytes.
