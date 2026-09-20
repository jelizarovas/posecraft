# Farm scenery

Sixteen original transparent raster props generated with the built-in imagegen tool for Posecraft. Exact prompts and original output paths are recorded in [prompts.json](./prompts.json) and [broken-descending-prompt.json](./broken-descending-prompt.json). Delivered WebP files preserve alpha and aspect ratio and are limited to 768 pixels on the longest side to reduce decoded memory on phones.

- Crops: pumpkin, vegetables, bare furrowed soil.
- Farm equipment: tool shack, scattered tools, scarecrow, chicken coop.
- Scenery: tall poplar, boarded mine, intact and broken fences in both directions.
- Livestock: sheep, chicken, cow. These are standing scenery sprites, not animated animal rigs.

`examples/farm-assets.js` declares display dimensions and independent collision footprints. The x/y fence names describe the source image orientation; the catalog maps those images onto the appropriate world axis. Crop occlusion is separate from collision. Wheat covers the lower half of a character; lower crops cover less; soil and loose tools remain below the character.

Artwork is part of the MIT-licensed Posecraft repository.

`corn.webp` adds mature corn for dense fields, generated with built-in imagegen.
The exact prompt and source path are in [corn-prompt.json](./corn-prompt.json).
It retains alpha and aspect ratio at a 512-pixel maximum side. Field brushes
use 10% lower-body cover for vegetables, 12% for pumpkins, 50% for wheat and
two-thirds for corn. Generated pumpkin, vegetable and corn plots each fill a
10 by 6 tile field, with paths between plots.

Wheat fills an adjacent 11 by 13 tile field. Corn boundary fences can share
planted edge cells and leave a two-tile entrance. Rails sort against plant
roots along their local axis, so an empty border is not required. Tall crops (cover fraction at
least 30%) retain the character locator silhouette; lower crops do not tint
the feet. Cover combines sprite alpha with a world-anchored irregular stalk
edge, rather than a horizontal clipping rectangle.

## Feeding props and fence timber

`hay-rack.webp`, `water-trough.webp`, `water-bucket.webp`, and `chicken-feeder.webp` are additional transparent feeding props. `fence-timber.webp` is an opaque seamless material for connected fence posts and rails. These five images were generated with built-in imagegen; the exact prompts and source paths are in [animal-care-prompts.json](./animal-care-prompts.json). Props are reduced to a maximum side of 768 pixels, the shared timber texture to 512 pixels.

Placement, display dimensions, and collision metadata for the feeding props live in `examples/animal-care-assets.js`.
