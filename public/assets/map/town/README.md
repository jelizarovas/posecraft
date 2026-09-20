# Millbrook town artwork

The textured chest has closed and opened states in `chest.webp` and `chest-open.webp`, generated with the built-in image tool. Exact prompts are in [chest-prompts.json](chest-prompts.json). The generated two-cell sheet was split and downsampled to 384 × 512 per state, preserving alpha. Both states share a display canvas and anchor; the map supplies the ground shadow.

Original assets generated with the built-in image_gen tool on September 19, 2026. The exact prompts are in [prompts.json](prompts.json).

Runtime files: [cottage](cottage.webp), [workshop](workshop.webp), [barn](barn.webp), [merchant wagon](wagon.webp), and [wheat plot](wheat.webp). They are WebP quality 90 conversions of the generated 1536 × 1024 RGBA images, with their original dimensions and transparency preserved.

Original generation filenames:

- Cottage: `exec-734d4a56-802a-46ab-a5d5-985fa42b042e.png`
- Workshop: `exec-698f55d1-6d26-45fb-b007-78458813f543.png`
- Barn: `exec-f82c3c2f-efc5-4bc9-87f7-8626326523d4.png`
- Wagon: `exec-985d9bdc-c66b-4fbc-a900-37a4ddd94f36.png`
- Wheat: `exec-d3a48a13-8704-48e7-a76a-7681fb6c2c22.png`

The town generator and editor catalog define world footprints separately from the artwork. NPCs share the existing adventurer atlases; the map does not load extra character sheets for each resident. The wagon is a stationary prop with a collision footprint, not a drivable vehicle.
