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

Part scene depth is saved in the pack and can be edited through document transactions or Studio's Pose inspector. Select a joint in a spatial rig, choose one of its parts in **Scene depth**, then choose **Inherit actor**, **Fixed depth**, or **Follow joint**. Surface decorations display their host and inherit its depth. The Scene inspector edits actor and rectangle-prop depth. Parts with matching scene-depth settings draw together. When their evaluated floor depth matches the owning actor within 0.001 units, they rejoin its local body-part order; otherwise they draw as an independent scene item. This lets held objects sit between the torso and hands, then sort separately when placed down. Their actor layer still applies.

Furniture must occlude complete underlying artwork. Do not trim a moving torso to a stationary tabletop in its rest pose. Put the lower body behind the furniture, keep hands above the keyboard or tabletop, and place an upper shoulder covering separately when it needs to hide a far arm. Wwzard uses this shared contract, with no scene-specific renderer code. A complete opaque furniture silhouette also prevents antialias gaps between adjacent shaded faces from exposing artwork underneath.

## Animated overlap order

Fixed actor and part depth can bind to an existing joint's `z` channel:

```js
part.spatial.sceneDepth = { value: 40, channel: 'leftArm.z' };
clip.tracks['leftArm.z'] = [[0, 0, 'step'], [0.4, -38, 'step'], [3.32, 0], [4, 0]];
```

The evaluated order is the base value plus that exact pose channel, defaulting to zero. This example switches from depth 40 to 2, behind a desk at 5, then returns. Sleeve and hand parts can bind to the same channel so they move together. The offset does not inherit ancestor z values or depend on the character's size or rotation. Existing fixed depths without a channel retain their behavior. Joint-following floor anchors remain a separate mode; rectangle props cannot bind a rig channel.

In the Pose inspector, select a fixed-depth part and choose **Animate with joint**. Select that joint's **Depth / z** pose channel to keyframe the offset. The existing z range is -500 to 500. Smooth interpolation can cross several depth values; stepped keys give an explicit order change at a chosen time. The step mode belongs on the key at the beginning of the held segment. Time order changes while silhouettes are clear of the occluding edge, so a hand does not visibly pop between foreground and background.

The binding is saved scene data, supported by shared evaluated drawing, mounted SVG reordering, Canvas painter rendering and website export. Wwzard's rest clip lifts both hands clear, switches their order, lowers them behind the desk, and reverses that movement before typing again.

## Splitting one contour across scene depths

Use `depthSplit` when one sleeve must pass behind the torso at its shoulder but above furniture at its forearm. It draws two clipped regions of the same complete path, with the same morph and gradient. The cut is specified in attachment-joint coordinates, after the path's own transform and before the joint's placement:

```js
part.spatial.depthSplit = {
  axis: 'x', at: 29,
  low: { value: -10 },
  high: { value: 40, channel: 'leftArm.z' }
};
```

Here, x below 29 stays behind the robe, while x above 29 follows the forearm's animated order. The split moves with the joint. Each region accepts the same fixed, animated fixed, or joint-following anchor as ordinary scene depth. `at` ranges from -1000 to 1000. Regions overlap by 0.3 local units to cover antialias gaps; prefer opaque artwork at the join, since translucent paint can accumulate there.

In Studio's Pose inspector, select the part and choose **Split depth**, then edit its axis, position and both anchors. This is saved and supported by SVG, Canvas, reopening and compiled website export. It currently supports one straight split per ordinary contour, including morphed paths. Generated meshes, soft limbs, hair shells, curved surfaces and turnarounds use their existing geometry systems and cannot combine with this setting. `sceneDepth` and `depthSplit` are mutually exclusive.

A `surfaceOf` detail on a split contour inherits both regions and must use the same attachment joint as its host. This keeps sleeve shading registered to the same cut. Cross-joint attachments on split contours are rejected by schema validation.

## Details attached to a surface

Use `spatial.surfaceOf` for a detail painted on another part, such as an eye on a head or muscle shading on an arm:

```js
mark.spatial = { ...mark.spatial, surfaceOf: 'head-shell' };
```

The host must be another part in the same pack and cannot itself have `surfaceOf`. This rules out self-links, chains, and cycles. A detail can use a different joint, allowing a face or hand detail to keep its existing movement. The attachment controls overlap with its host and inherits its visibility and opacity; it does not reparent the joint or rewrite the detail's geometry. Add `spatial.mask: hostId` explicitly when a painted detail must also be clipped to the host silhouette. Covers such as shoes and hair can extend beyond their host. A detail inherits the host's scene depth and cannot specify its own `sceneDepth`.

Declare `scene-depth` and, when used, `surface-decals` in `requiredFeatures`. Export inspection detects both directly from the document. These fields round-trip through saved projects, transactions, undo/redo, and website export. Older scenes keep their existing ordering until they opt in.

## Bent limbs

The SVG renderer splits each soft limb into upper, forearm and palm depth regions. They share one seamless outline, clipped into overlapping volumes, and use the actual depth of each bone. This allows an upper arm behind a torso with its forearm in front. Surface attachments on a soft limb follow the region matching their joint. Mounted playback updates existing nodes and uses the same ordering as exported SVG.
