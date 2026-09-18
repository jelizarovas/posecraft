# Depth rigs and animation quality

[Turn & pose](https://jelizarovas.github.io/posecraft/demos.html#turn-and-pose) is an experimental Ona/Dummy study. It adds an optical depth layer to the 2D skeletal runtime. The character library and older gallery scenes now use these Ona and Dummy rigs. Existing saved drafts stay unchanged; Studio can upgrade a selected original flat Ona or Dummy through the More menu.

## Try the study

Play **Turnaround**, **Look around**, **Reach & hide**, or **Tuck jump**. The manual controls pause the acting clips and pose the selected cast. **Body turn** rotates the whole rig. **Head turn** adds a turn relative to the body. **Arm depth** changes overlap while keeping the shoulder attached. **Shape / tuck** bends Ona's elbow inside a continuous soft arm and raises Dummy's right knee toward the viewer.

Choose **Edit in Studio**, select a joint and choose a **Pose channel**. Set the playhead, adjust the slider and press **+** to save keys. Yaw, Pitch, Depth, Shape and Opacity use the same saved clips, undo, export and playback as Rotation. Use the sliders for depth channels. Screen rotation can also be dragged on the canvas around the projected joint pivot. Position X and Y are keyable in both flat and depth rigs. Bone guides follow projected positions.

- **Yaw** rotates around the joint's local Y axis. Use Root for a body turn, Head for a face turn, and Dummy's thigh/calf joints for a knee moving toward the camera.
- **Pitch** rotates around local X. Use Head to look up/down. Local axes inherit parent rotations.
- **Depth** changes drawing order for a joint and its descendants. It does not translate the joint anchor or change collisions. Positive values draw nearer the viewer.
- **Shape** is 0..1 and drives an authored compatible-path morph. Only parts with authored morph targets respond to Shape. Ona now uses forearm rotation and wrist rotation, yaw and pitch to shape its continuous arms.

Director samples these channels in clips and accepts them in `ShotActor.pose` keys through the SDK. Its existing joint-rotation inspector has not been expanded into a depth-rig editor; author these clips in Studio.

## Data contract

Set `pack.spatial: true` and add `spatial-rig` to `requiredFeatures`. Each joint gains `yaw` in -180..180 degrees, `pitch` in -90..90 degrees, `z` in -500..500 layer units, and `bend` in 0..1. These default to zero. The `opacity` channel ranges from 0 to 1 and defaults to 1. A part opts into it with `opacityChannel: "jointId.opacity"`; this fades that part without affecting its children. Clip channels are `head.yaw`, `head.pitch`, `rightArm.z`, `rightArm.bend`, and so on. Numeric interpolation is explicit: put intermediate yaw keys between +180 and -180 when choosing a turning direction.

Each vector part may declare `spatial` metadata:

```json
{
  "depth": 24,
  "order": 3,
  "center": [-15, 0],
  "facing": "front",
  "mask": "face-0",
  "surface": {"x": -15, "width": 44, "depth": 29}
}
```

`depth` places a drawing at a local surface depth. `center` chooses the point used to sort it, so a thigh is sorted by its middle rather than only its hip attachment. `order` is a tiny stable tie-breaker for stacked details. `facing` can be `front` or `back`; omit it for a double-sided part. `mask` references a part in the same pack, whose transformed path clips the drawing. Masks use per-render identifiers so gallery thumbnails and previews can coexist.

`surface` projects a facial feature around an elliptical cylinder. It preserves feature placement from the front, moves it around the head during a turn, and tests its local surface normal so the far eye disappears before the near eye. The head silhouette clips the projected feature. A volume can use `thickness: 0.72, axis: "x"` to retain a side silhouette as its plane turns edge-on. This is an approximation, not a polygon mesh.

A part can declare `morph: {channel: "rightArm.bend", target: "...path..."}`. Target and base must use identical commands and numeric topology. Arc commands are excluded from morph targets because interpolating their flags is invalid. Use cubic or quadratic curves. The renderer caches numeric path structure and only interpolates coordinates. Source drawings remain unchanged.

Joint matrices use orthographic projection. Descendant positions inherit turns, so foreshortened limbs stay connected. The renderer sorts existing part nodes when their order changes; it does not rebuild the SVG every frame. The opt-in path leaves ordinary 2D rigs on their existing rendering path. Physical simulation and animation evaluation remain in the scene worker; SVG projection runs with drawing updates on the main thread.

## Current limits and the next quality pass

This is a rig study, not a finished character-art upgrade. It supports smooth turns and back-facing artwork, but the side silhouettes are approximate volumes. The next art pass needs approved front, three-quarter, profile, rear-quarter and back drawings. Hair, hands, shoes and asymmetric costume details need angle-specific correction shapes. Soft arms follow a two-bone joint chain; this is not a general mesh deformer.

Depth sorting applies to whole parts. A single forearm crossing a torso may need to be split into segments or masked; there is no per-pixel depth buffer. Joint and body collisions are still 2D proxy boxes. A turned character's visible silhouette can differ from those proxies. Collisions remain two-dimensional. The new carrying and gym demos have authored hand and foot contacts, but there is no general contact-constraint editor, 3D physics or cloth simulation.

Once the silhouettes are approved, revise the motion: held poses with clear silhouettes, anticipation before a jump, a distinct push-off, knees folding near the apex, compression on landing, then settling. Give the head and hands different timing from the torso. Walks need weight transfer and planted contacts. This matters as much as the rig.

The general techniques have established parallels in [Spine's draw-order and attachment system](https://us.esotericsoftware.com/spine-slots), [Spine's weighted deformation](https://us.esotericsoftware.com/spine-weights), and [Toon Boom's turn-control workflows](https://www.toonboom.com/oli-putland-master-controller/). Posecraft's code here is its own implementation; none of those runtimes or paid tools is required.

`npm test` checks face visibility, non-collapsing profile volume, overlap order, knee projection, morph bounds, JSON validation, clip/episode sampling and finite matrices. `npm run test:spatial` checks the live SVG, responsive demo, and Studio keyframe persistence. These are technical checks; visual review at combined turn/bend angles remains necessary.

## Soft arms and independent joints

The library Ona and campfire arms use one continuous skin over upper-arm, elbow and wrist joints. Select **Holding upper arm**, **Holding forearm**, **Holding wrist**, or the corresponding **Free** joint in Studio. Rotation, Yaw and Pitch can each be keyed. Wrist tilt changes palm width; the skin follows the projected elbow and hand without drawing seams. The internal joint chain still determines hand contacts.

A part can declare `spatial.softLimb: {elbow: "elbow-id", hand: "hand-id", radius: 7}`. The elbow must be a direct child of the part's joint and the hand a child of that elbow. Radius is 1..30 local units. This bounded two-bone skin uses the existing SVG renderer, not mesh physics. Declare `soft-limbs` in required features.

Dummy's left and right foot joints already attach to their respective calves. Their spatial artwork now retains heel/toe volume when turned, with separate outward resting angles. Select a foot to key its Yaw or Pitch without turning the calf. **Hands & feet** in the Turn & pose demo demonstrates ankle and wrist motion.

`spatial.facingFade` optionally fades paired front/back coverings as they approach profile. With range `0.3`, the front covering fades as its facing value goes from 0.3 to 0, while the rear covering appears over that same interval. Both still follow the head transform. This avoids a gap where both hair coverings would be hidden. Opacity channels multiply this facing opacity.

Campfire uses `spatial.hairShell: {width: 43, height: 33, depth: 31, y: -22}` for an opaque cap that follows the head in depth. The renderer clips hidden geometry and draws the boundary, without crossfading. Dimensions are bounded to 1..100 and the vertical offset to -200..200. Declare `hair-shell` when relying on it. This is a small procedural cap, not a general mesh importer.

## Reuse the supplied rigs

Import `addSpatialRig` and `addOnaArmJoints` from `posecraft/character-rigs`. On a clone of an original Ona pack, call `addSpatialRig(pack, "ona", {studies: false})`, then `addOnaArmJoints(pack)`. Dummy needs only `addSpatialRig(pack, "dummy", {studies: false})`. These functions mutate the clone, preserve original actions, and can be called again safely. Omit `studies: false` to include the extra rotation study clips. Custom rigs need their own joint and artwork setup.


### Directional artwork

A part can store `spatial.turnaround.views`, an ordered array of `{angle, d}` paths spanning 0 through 360 degrees. Paths use matching commands and point counts. The first and last view close the turn. The renderer interpolates neighboring contours using the joint's world-facing direction while retaining its roll and pitch. This lets side and rear views have different silhouettes and features without flattening a front drawing. Atlas provides 25 keys at 15-degree spacing. The same saved data renders in Studio, worker playback and website exports.
## Scene and surface overlap

See [scene depth and surface decorations](scene-depth.md) for floor anchors, furniture ordering, independently placed props, and details that stay attached to their body surface. Soft limbs render in separate depth regions so a bent arm can pass behind the torso and return in front.
