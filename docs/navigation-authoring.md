# Walking routes in Catch

Open **Studio → Scene → Objects & catching**, choose the ball, and enable **Walk around obstacles**. The saved Catch behavior gains a `navigation` section; disabling it restores the original horizontal movement.

The walking area uses scene coordinates for each character's position marker, not the head or feet. Edit Area X, Area Y, Area width and Area height together, then choose **Save walking area**. Allow space for the character's artwork beyond its position marker. **Clearance** gives obstacles a margin; **Grid size** sets route resolution; **Work per step** bounds path search work. Changes use normal scene transactions and support Undo, Redo, save and reopen.

```json
{
  "navigation": {
    "bounds": { "x": 40, "y": 220, "width": 720, "height": 160 },
    "cellSize": 16,
    "clearance": 18,
    "maxNodes": 64
  }
}
```

This section belongs to an entry in `scene.objectGames`. Scenes containing it declare the `navigation` required feature. The area must fit within scene bounds. Grid size is 8–80 pixels, clearance is 0–80 pixels, and work is 8–256 expanded nodes per fixed step. The grid cannot exceed 16,384 cells. Both area dimensions must exceed twice the clearance plus the diagonal of one grid cell, so at least one safe cell can fit.

Visible, enabled prop colliders and static shared-object shapes block the character markers. Edit prop collision boxes using the existing prop inspector. Their scene positions are also their route obstacle positions; a tall decorative image should use a floor footprint when that is the intended barrier. Hidden scenery and disabled colliders do not block a route.

Catch uses the same route planner for interception, retrieval and returning home. A route does not guarantee that a fast ball remains catchable while the character walks around an obstacle. If a destination is unreachable, the character waits or retries instead of crossing the collider. Route jobs and seeded game state are included in replay checkpoints.

`frame.objectGames[].navigation` exposes actor IDs, route status, expanded-node counts and paths for diagnostics. Paths contain character-origin coordinates. This is bounded ground-plane navigation for the Catch controller; it is not a general skeleton-specific locomotion generator.
