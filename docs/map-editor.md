# Map editor

Open `map-editor.html` to author a Littlelands map without changing the normal play page. The editor stores the last valid document in local storage and writes the same document when you download JSON.

The standalone `play.html` now opens Millbrook: eight buildings, a connected square and farm lanes, four kinds of fields, fenced livestock pastures, a creek and pond, a stationary merchant wagon, and three walking residents. `play.html?draft=1` still opens the saved draft. Open `map-editor.html?template=town` to start editing a fresh copy of the town; merely opening the template does not replace the saved draft. Saving or editing it makes it the current draft. The palette includes town buildings, crops, farm equipment, fences, trees, and animals.

NPC routines are defined in `examples/town-map.js` and scheduled by `examples/map-town-life.js`. They share the existing character artwork and pathfinding worker. Their waypoints are host-side behavior and are not yet authored through the editor's inspector.

Paint logical terrain with Grass, Road, Water, and Sand. Grass variants change `groundPaint` only, so they keep grass navigation and cost. Water cannot be painted under the hero.

Use **Plateau** to drag one rectangular terrace between 1 × 1 and 16 × 16 tiles. Choose height 3, 8, or 15 before dragging. Each drag adds one `terraces` entry, even when it covers many tiles, and later overlapping terraces use the greater height. Choose **Erase** and drag across a plateau to remove every terrace touched by the rectangle. The editor limits maps to 64 terraces.

Scatter uses the circular brush radius and density to paint patches of the selected prop. Place adds one prop per click. Select a prop to move its footprint, choose an art image, change collision shapes, or add a traversal. An omitted collision remains a full footprint for old props. Decorations may use `none`, a circle, a rectangle, or a compound of rectangles and circles. A compound can leave a walkable opening through a large sprite such as the wreckage.

Traversal is authored on a selected prop. Automatic vaults begin when a route reaches a blocking prop. Click traversals show their relative entry and exit endpoints in the inspector, so a fence can be crossed from either side and a ridge can define its lower and higher side. The height is measured in terrain-height units. The low fence uses a clicked vault; the rocky ridge uses a clicked climb. Branches use the automatic hand vault preset.

Placing a ridge creates a 0.4-unit rise across its three-cell footprint, with the smaller Y side higher. The editor keeps the existing maximum adjacent terrain slope of 0.4 and rejects ridge placement when it would change an actor's ground or conflict with nearby elevation. Ridge terrain remains ordinary `elevations` data, so it can be edited with other map tools and survives JSON export.

Each pointer stroke is one undo entry. Save writes an ordinary `posecraft-map` JSON file, and Load checks the document before replacing the current map. **Play draft** validates and stores the editor document, then opens `play.html?draft=1`. Opening `play.html` without that query always uses the generated woodland map.

JSON save and load retain `terraces` and `birds`. Shrinking a map drops plateaus that no longer fit and birds whose home falls outside the new dimensions. Other resize behavior is unchanged.

Run `npm run dev:map`, then open `http://localhost:5246/map-editor.html`. The server binds to the network for phone testing. Draft storage belongs to the browser and origin; it does not sync edits between a desktop and phone. JSON contains asset URLs, not embedded images. Keep the referenced assets with an exported map.

The bundled palette adds dry and moss grass, bushes, branches, a low fence, a rocky ridge, gravestones and split wreckage. [Artwork prompts and provenance](../public/assets/map/editor/README.md) record how the generated assets were made. Collision and traversal presets remain editable and are independent of image transparency.
# Crop cover

Select a prop and use **Character cover** to choose normal depth silhouettes, crop cover, or always-underfoot drawing. Crop cover has a percentage control measured upward from the character's foot pivot. Actual crop artwork limits the visible cover. This setting is independent of collision and survives saving and reopening the map.

The farm palette includes pumpkin and vegetable patches, bare tilled soil, tools, a shack, scarecrow, poplar, blocked mine, chicken coop, sheep, chickens, cows, and intact or broken fences in both directions. Farm animals are standing scenery sprites. Open `map-editor.html?template=town` to edit the expanded town without replacing a saved draft merely by opening it.
