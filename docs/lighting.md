# Lighting and receivers

[Light & shade](https://jelizarovas.github.io/posecraft/demos.html#light-and-shade) demonstrates surface gradients, highlights, animated floor and wall shadows, contact shadows and a fading floor reflection. Warm, Moonlight and Flat compare the treatments. Jump separates the feet from their contact shadow; Turn shows the changing silhouette.

In Studio, open **Light**. **Character shading** switches between **Soft gradient** and **Sharp / cel**. Sharp uses two flat tones separated by a crisp curved shadow edge. The edge follows the light direction and the moving part. It leaves floor and wall shadow softness independent. The demo starts sharp; older scenes keep their soft gradients. The settings apply to the whole scene and survive undo, save, export and reload. Set **Floor line** at the feet and **Wall edge** at the backdrop's floor boundary. These are visual receiver planes, independent of collision props. Light settings in the gallery are included in Download project. Opening its editor starts a separate saved demo draft, as with the other demos.

## Scene data

Lighting is optional and disabled in existing scenes. Set `scene.lighting` through `DocumentStore.transact` or the CLI's existing `set` command. Add `scene-lighting` to `requiredFeatures` when the scene depends on it. `renderSVG`, `mountSVG`, browser/React embeds and scenes embedded in episodes read the same data. Recreate a mounted renderer after changing scene lighting; frame updates animate its existing bindings.

```json
{
  "enabled": true,
  "shading": "cel",
  "angle": -135,
  "elevation": 45,
  "intensity": 0.8,
  "ambient": 0.6,
  "color": "#fff1d6",
  "shadowColor": "#292438",
  "softness": 3,
  "floorY": 365,
  "wallY": 300,
  "floorShadow": 0.24,
  "wallShadow": 0.14,
  "reflection": 0.22,
  "gloss": 0.35
}
```

| Field | Meaning and range |
| --- | --- |
| `shading` | `gradient` for soft shading or `cel` for a sharp two-tone edge. Defaults to `gradient`. |
| `angle` | Direction toward the key light, -180..180 degrees in screen coordinates. -135 lights from upper left. |
| `elevation` | 10..85 degrees; a lower light makes a longer floor shadow. |
| `intensity`, `ambient` | Key strength 0..2; ambient fill 0..1. |
| `color`, `shadowColor` | Six-digit hex colors. |
| `softness` | SVG blur deviation 0..16. Zero produces crisp shadows. |
| `floorY`, `wallY` | Ground/reflection line and wall receiver edge, 0..4096 scene units. Defaults are 82% and 66% of scene height. |
| `floorShadow`, `wallShadow` | Independent opacity, 0..1. Zero omits that cast effect. |
| `reflection` | Floor mirror opacity 0..0.8. Zero omits the reflected drawing. |
| `gloss` | Stylized highlight strength 0..1. |

Omitted properties use the example defaults, except `shading` defaults to `gradient`, `gloss` defaults to 0.25, `reflection` to 0.18, the receiver positions scale with scene height, and `enabled` defaults to false. Solid RGB fills receive radial color ramps. Very dark details, outlines, `none` and alpha hex fills remain unchanged. Gradients compensate for the full projected part transform, including yaw/pitch, profile mirroring, actor rotation and authored mirror/scale transforms. The light stays fixed in scene space through a turn. They suggest rounded volume; they are not normals derived from a mesh. Appearance colors remain the source colors.

## Rendering cost and limits

Shadows and mirrors use local SVG `<use>` references to each actor's live artwork. They follow changed paths, visibility, joint poses, actor placement and the episode camera without duplicating path nodes. Contact ellipses use collision proxy extents, fade and widen with height, and do not require DOM bounds reads. Characters without physics proxies do not show a contact shadow. Every renderer uses unique definition IDs so embeds do not share masks or gradients accidentally.

Lighting does add browser paint work. SVG drawing and filters stay on the rendering thread; the simulation worker does not make that work free. For a crowded scene, first set reflection and wall shadow to zero, then reduce softness to zero. Disable lighting for the original flat rendering path. Definitions and effect nodes are created at mount; frames update cached bindings. There is one blur filter definition per lit scene. The gallery only animates the selected demo.

A local headless Edge check at an 800×450 stage measured about 18 ms at the 95th-percentile frame interval for two characters with either flat or full lighting. With 16 depth rigs, the same check measured about 54 ms with crisp floor shadows and 72 ms with soft shadows plus reflections, versus 18 ms unlit. These are one-machine measurements, not a phone performance guarantee. Full lighting is currently suited to small staged casts; keep large crowds unlit or reduce effects.

These are stylized planar effects. They do not cast shadows from props, receive shadows on arbitrary obstacles, produce self-shadowing, calculate environment reflections or provide multiple lights/global illumination. A shared floor plane is best suited to a staged cast at similar depth. Contact extents are approximate on the visual depth rigs. Lights are scene settings, not timeline channels. Authored materials, additional receiver planes and physical 3D shading remain future work.

The filter follows SVG's [blur primitive](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur) and [filter region rules](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/filter). `npm run test:lighting` rasterizes the actual SVG to verify visible wall shadows, floor shadows and reflections, then checks jumps, controls, exported values, saved Studio settings, undo and desktop/mobile layout. Unit tests cover bounds, the unlit path, transforms, tinting, contact fade, camera placement and isolated references.
