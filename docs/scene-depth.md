# Scene depth and surface decorations

Use scene depth when a character must pass behind and in front of furniture. In Studio, select an actor or prop in **Scene**, then choose its **Scene depth → Overlap order**. Keep scene order preserves the existing placement; Fixed floor depth gives an item a stable depth; Follow a joint lets an actor's movement determine it. The higher value draws nearer the viewer.

Depth-enabled items sort within their existing background, characters, or foreground layer. Unconfigured items retain their original slots. Ties keep the original order, and folders affect organization and visibility only. Put interacting scenery and characters in the same layer and enable depth on both.

```js
// Furniture at a fixed floor coordinate in the scene.
actor.depth = { value: 360 };
// A moving character uses an authored floor anchor in its rig.
actor.depth = { joint: 'floor-anchor', offset: 0 };
// Rectangle props support fixed depth.
prop.depth = { value: 360 };
```

A fixed `value` is a scene-space Y coordinate between −10000 and 10000. A joint reference must exist in the actor's pack. Its optional `offset`, between −4096 and 4096, adds to the joint's projected pack-space Y before the actor's current placement, rotation, and scale are applied. Use a dedicated ground anchor when a body jumps, bends, or lies down; using a head or bobbing root would make overlap change with its height. This setting does not change position, collision shapes, walking paths, lighting ground height, or scale.

Keep walls and floor paintings in a background actor. Make furniture that needs independent overlap a separate reusable scene actor or prop. A bench may use separate rear and front pieces when a character must sit between them. Sorting an entire room painting cannot create independent overlap for every object inside it.

## Independently placed parts

An ordinary spatial part can set `sceneDepth` using the same fixed or joint-following contract. This lets a prop that belongs to a character rig, such as a bottle or barbell, sort independently while retaining its existing joints, animation channels, and saved artwork:

```js
part.spatial = {
  ...part.spatial,
  sceneDepth: { value: 360 }
};
```

Part scene depth is saved in the pack and can be edited through document transactions. The Scene inspector currently edits actor and rectangle-prop depth; it does not expose a per-part scene-depth form. Parts with matching scene-depth settings draw together. When their evaluated floor depth matches the owning actor within 0.001 units, they rejoin its local body-part order; otherwise they draw as an independent scene item. This lets held objects sit between the torso and hands, then sort separately when placed down. Their actor layer still applies.

## Details attached to a surface

Use `spatial.surfaceOf` for a detail painted on another part, such as an eye on a head or muscle shading on an arm:

```js
mark.spatial = { ...mark.spatial, surfaceOf: 'head-shell' };
```

The host must be another part in the same pack and cannot itself have `surfaceOf`. This rules out self-links, chains, and cycles. A detail can use a different joint, allowing a face or hand detail to keep its existing movement. The attachment controls overlap with its host and inherits its visibility and opacity; it does not reparent the joint or rewrite the detail's geometry. Add `spatial.mask: hostId` explicitly when a painted detail must also be clipped to the host silhouette. Covers such as shoes and hair can extend beyond their host. A detail inherits the host's scene depth and cannot specify its own `sceneDepth`.

Declare `scene-depth` and, when used, `surface-decals` in `requiredFeatures`. Export inspection detects both directly from the document. These fields round-trip through saved projects, transactions, undo/redo, and website export. Older scenes keep their existing ordering until they opt in.

## Bent limbs

The SVG renderer splits each soft limb into upper, forearm and palm depth regions. They share one seamless outline, clipped into overlapping volumes, and use the actual depth of each bone. This allows an upper arm behind a torso with its forearm in front. Surface attachments on a soft limb follow the region matching their joint. Mounted playback updates existing nodes and uses the same ordering as exported SVG.
