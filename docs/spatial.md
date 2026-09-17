# Depth rigs and animation quality

[Turn & pose](https://jelizarovas.github.io/posecraft/demos.html#turn-and-pose) is an experimental Ona/Dummy study. It adds an optical depth layer to the 2D skeletal runtime. It is deliberately a separate demo: existing character packs and saved drafts keep their artwork and behavior.

## Try the study

Play **Turnaround**, **Look around**, **Reach & hide**, or **Tuck jump**. The manual controls pause the acting clips and pose the selected cast. **Body turn** rotates the whole rig. **Head turn** adds a turn relative to the body. **Arm depth** changes overlap while keeping the shoulder attached. **Shape / tuck** blends Ona's rounded arm into a bent teardrop and raises Dummy's right knee toward the viewer.

Choose **Edit in Studio**, select a joint and choose a **Pose channel**. Set the playhead, adjust the slider and press **+** to save keys. Yaw, Pitch, Depth, Shape and Opacity use the same saved clips, undo, export and playback as Rotation. Depth rigs use sliders for posing; canvas clicks select parts but dragging is disabled because the old drag solver assumes a flat plane. Bone guides follow projected positions.

- **Yaw** rotates around the joint's local Y axis. Use Root for a body turn, Head for a face turn, and Dummy's thigh/calf joints for a knee moving toward the camera.
- **Pitch** rotates around local X. Use Head to look up/down. Local axes inherit parent rotations.
- **Depth** changes drawing order for a joint and its descendants. It does not translate the joint anchor or change collisions. Positive values draw nearer the viewer.
- **Shape** is 0..1 and drives an authored compatible-path morph. The supplied targets are on Ona's left/right arm joints. Other joints need their own target drawings before Shape has a visible effect.

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

This is a rig study, not a finished character-art upgrade. It supports smooth turns and back-facing artwork, but the side silhouettes are approximate volumes. The next art pass needs approved front, three-quarter, profile, rear-quarter and back drawings. Hair, hands, shoes and asymmetric costume details need angle-specific correction shapes. The current morph is one authored arm shape, not a general mesh deformer.

Depth sorting applies to whole parts. A single forearm crossing a torso may need to be split into segments or masked; there is no per-pixel depth buffer. Joint and body collisions are still 2D proxy boxes. A turned character's visible silhouette can differ from those proxies. This release does not add 3D physics, lighting, cloth, planted feet or automatic artist-quality in-betweens.

Once the silhouettes are approved, revise the motion: held poses with clear silhouettes, anticipation before a jump, a distinct push-off, knees folding near the apex, compression on landing, then settling. Give the head and hands different timing from the torso. Walks need weight transfer and planted contacts. This matters as much as the rig.

The general techniques have established parallels in [Spine's draw-order and attachment system](https://us.esotericsoftware.com/spine-slots), [Spine's weighted deformation](https://us.esotericsoftware.com/spine-weights), and [Toon Boom's turn-control workflows](https://www.toonboom.com/oli-putland-master-controller/). Posecraft's code here is its own implementation; none of those runtimes or paid tools is required.

`npm test` checks face visibility, non-collapsing profile volume, overlap order, knee projection, morph bounds, JSON validation, clip/episode sampling and finite matrices. `npm run test:spatial` checks the live SVG, responsive demo, and Studio keyframe persistence. These are technical checks; visual review at combined turn/bend angles remains necessary.
