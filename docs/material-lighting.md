# Authored material lighting

`scene.materialLighting` shades existing fills and authored gradient stops. SVG and Canvas use the same evaluated colors. It adds no paths, SVG filters, layout reads, physics or hosted dependencies. A weight of zero returns the original materials exactly.

```js
materialLighting: {
  weight: {actor: 'environment', channel: 'night.bend'},
  ambient: 0.32,
  tint: '#6074a8',
  actors: ['character', 'desk', 'keyboard', 'screen'],
  lights: [
    {type: 'directional', angle: -45, color: '#b9d5ff', intensity: 1.05},
    {
      type: 'point', actor: 'screen', x: 326, y: 255, range: 135,
      color: '#94ddff', intensity: 1.8, flicker: 0.08,
      actors: ['character', 'desk', 'keyboard'],
      gains: [
        {actor: 'character', channel: 'display.bend'},
        {actor: 'screen', channel: 'hinge.bend', invert: true}
      ]
    }
  ]
}
```

Names above are authored references, not runtime conventions. A source may omit `actor` to use scene coordinates. Point sources follow actor placement; their range is in scene units. A directional angle of −45° points toward the upper right. Directional highlights follow the authored gradient endpoints and their transformed positions. This is stylized material shading, without cast-shadow or silhouette-rim geometry.

Weight and gains read normalized pose channels, clamped to 0–1. Up to two gains multiply; inversion provides an exact closed-lid shutter regardless of the activity driving screen brightness. Existing motion layers and behavior graphs can drive these channels from theme, typing or scrolling inputs. Flicker uses deterministic scene time, sampled at 30 Hz; paused and reduced-motion playback keep its sample fixed. It never changes the animation state.

The config supports at most two lights and two gains per light. Global and per-light actor whitelists are independent of the older `actor.unlit` flag. A per-light whitelist can prevent a screen from illuminating its own back cover. Parsed artwork and the latest sampled state use bounded caches.

Studio → Lighting → Authored material lighting creates and edits weight channels, ambient tint, receiver actors, source types/positions, colors, intensity, flicker and inverted gain bindings. These edits use normal transactions and survive JSON export and reopening. Compiled exports detect `material-lighting` and preserve the saved settings. No optional provider is required beyond any providers driving the referenced pose channels.

Verification: `test/material-lighting.test.js` checks daylight identity, directional response, multiplicative shuttering, deterministic flicker and SVG/Canvas parity. `test/material-lighting-browser.mjs` reviews the actual Contact artwork at 300 px, checks live restoration and unchanged path count, exercises Studio save/reopen, and measures two simultaneous renderer updates. Its desktop browser cost excludes raster/compositor work and is not physical-phone evidence.

## Reflected color and emissive artwork

Direct light multiplies the authored material color before adding its contribution. A purple robe therefore reflects purple/blue light instead of turning uniformly white. Ambient remains a separate low-intensity contribution. The revised Wwwzard preset uses a darker ambient level, blue-violet moonlight and a smaller cyan screen-light reach.

A light can declare `emission: {actor: "keyboard", parts: ["key-0-0", "key-0-1"]}`. Only those existing paths receive the emissive contribution, which uses the same color, intensity, flicker and multiplied gain/shutter channels. The list accepts 1–128 distinct part IDs. Emission applies within the existing scene and light receiver filters; it does not cast additional light, blur edges, or duplicate geometry. Other materials still receive reflected light. Setting day weight to zero restores the original colors exactly. Studio’s Emissive artwork selector and part-ID field save this configuration through normal scene transactions.

A light can also select `highlights: {actor, parts}` using the same bounded part-ID contract. Those existing highlight strips receive a directional specular-color contribution using the source’s sampled falloff, gains and flicker. This is an authored highlight, not generated silhouette geometry. Studio exposes it separately from emission. The moon uses the existing hat-brim highlight strip; the keyboard uses emission.
