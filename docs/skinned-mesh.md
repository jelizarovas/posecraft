# Skinned surfaces

A part can use `spatial.mesh` to keep a connected surface attached to several joints. Shared vertices move once, so adjacent triangles stay joined as shoulders, elbows, hips, or knees bend. The scene must declare `skinned-mesh` in `requiredFeatures`, and the character pack must have `spatial: true`.

Each vertex stores one to four joint influences. An influence supplies a point in that joint's local coordinates and a positive weight. The renderer transforms those points by the evaluated joints and takes their weighted average. Weights must sum to one. Local `z` describes actual surface shape; joint `z` channels used for drawing order affect sorting separately.

```json
{
  "id": "skin",
  "joint": "root",
  "d": "M0 0L20 0L20 20Z",
  "fill": "#c98159",
  "stroke": "#663f32",
  "strokeWidth": 1.5,
  "spatial": {
    "mesh": {
      "vertices": [
        {"weights": [{"joint": "root", "x": 0, "y": 0, "weight": 1}]},
        {"weights": [
          {"joint": "root", "x": 20, "y": 0, "weight": 0.5},
          {"joint": "elbow", "x": 0, "y": 0, "weight": 0.5}
        ]},
        {"weights": [{"joint": "elbow", "x": 0, "y": 20, "weight": 1}]}
      ],
      "triangles": [[0, 1, 2]],
      "correctives": [{
        "joint": "elbow", "channel": "rotation", "min": 0, "max": 90,
        "offsets": [{"vertex": 2, "y": 3, "z": 2}]
      }]
    }
  }
}
```

The example assumes an existing `elbow` joint. `d` remains the part's ordinary path data; mesh geometry supplies its rendered surface. Fill, appearance color, opacity, and stroke belong to the part. Each mesh has one material and shares one lighting ramp across its faces. Faces and outline edges sort by their evaluated depth, allowing folded surfaces and other body parts to cover them. Use separate parts for different materials. Meshes above 128 triangles batch their fills and outlines into 64 depth bands, keeping SVG node counts bounded while retaining every deformed triangle. This is painter-style 2.5D sorting, not a per-pixel depth buffer; intersections within one band can need finer authoring.

Triangles use zero-based vertex indices. Every triangle needs three distinct indices, and a triangle cannot be repeated with either winding. Faces are two-sided. Shared internal edges normally have no stroke; boundaries and silhouettes have the part's stroke. Set optional `creaseAngle` to a degree threshold from 0 to 180 to draw folded internal edges whose physical dihedral angle exceeds that threshold. Omit it to leave internal edges unstroked.

A corrective offsets vertices as a joint's `rotation`, `yaw`, `pitch`, or `bend` rises through a specified range. The amount is `smoothstep(clamp((value-min)/(max-min)))`: zero below `min`, one above `max`. Its offsets are vectors in the driving joint's coordinates, transformed by that joint's orientation. Correctives add together. An empty offsets list is valid while authoring a driver. These corrections refine a chosen bend; they do not simulate muscle or cloth.

Mesh cannot share a part with soft limbs, hair shells, turnaround paths, path morphs, or curved-surface projection. Other parts and existing rigs retain their normal rendering behavior. Surface decorations, masks, and scene depth are separate authoring controls.

## Edit in Studio

Select the character in Character Studio, open **Surface**, and choose a surface. Pick a vertex from the list or select its dot on the wireframe. In **Bind weights**, add or reassign its joint influences, adjust their weights, or edit local X/Y/Z coordinates and apply the change. Reassigning a joint preserves the rest shape; changing a weight proportionally normalizes the other influences.

In **Corrections**, choose a driving joint and channel, set the start and full-strength values, then edit the selected vertex's X/Y/Z offsets. Preview a pose or scrub the animation to see the displayed correction strength. Clear a vertex's correction or delete the driver to remove it. These controls edit an existing surface; creating triangles and changing mesh topology are not included yet.

## Limits and portability

| Data | Limit |
| --- | --- |
| Vertices per mesh | 3–512 |
| Triangles per mesh | 1–1,024 |
| Influences per vertex | 1–4 distinct joints, positive weights summing to 1 within 0.000001 |
| Influence coordinates | −10,000 to 10,000; omitted `z` is zero |
| Corrective drivers | Up to 32 per mesh |
| Corrective offsets | Up to 512 per driver and 2,048 per mesh; distinct vertices per driver |
| Corrective coordinate offsets | −4,096 to 4,096 |
| Instantiated scene geometry | Up to 8,192 vertices and 16,384 triangles, counting repeated actors |

Driver ranges must increase and remain within the selected channel's limits. Imports reject unknown joints, malformed topology, unsupported fields, and nonfinite values. The existing 5 MB and 500,000-node scene limits still apply.

Saved projects retain the mesh, weights, and correctives as JSON. Website exports report `skinned-mesh` in their feature manifest. Animated meshes use the illustration runtime unless another actor explicitly requires physics; a mesh does not require Planck.
