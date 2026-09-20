# Millbrook

Open `http://localhost:5246/play.html` for the town. The `draft=1` query continues to load the existing local draft.

The map has a central square and inn, four cottage buildings, a blacksmith workshop, two barns, a parked merchant wagon, and woodland on the outskirts. Buildings, trees, tools, scarecrows, and livestock use a shared human scale based on the 56-pixel visible player. Their ground footprints follow the enlarged artwork, and each front door still meets its road approach. The west farm has wheat, vegetable, pumpkin, and fallow plots with tool shacks and scarecrows. Fenced pastures hold sheep and two cows, while chickens gather near their coop. Tall poplars, broken fence gates, scattered tools, and a blocked mine fill the outer meadows.

A creek and pond run along the east meadow. Two dry crossings connect the banks without cutting across resident routes. Building, wagon, fence, and farm prop collision footprints are independent of their transparent artwork.

Three residents walk between road waypoints and pause to look around. They share the player's sprite sheets rather than loading another copy for each NPC. Their movement uses the same worker pathfinding and controller as the player. A single scheduler timer handles the pauses. Player route arrows and camera following ignore background NPC commands.

The stock terrain, hand-vault fence, branch, and ridge crossings remain available. `map-editor.html?template=town` opens a new copy for terrain painting and prop placement. The usual editor URL preserves the saved draft.

Generated artwork and exact prompts: [town assets](../public/assets/map/town/README.md), [farm assets](../public/assets/map/farm/README.md). The wagon and farm animals are static scenery. Residents currently share one character appearance; their names and routes distinguish their roles in the scene data.
