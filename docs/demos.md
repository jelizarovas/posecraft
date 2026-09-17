# Demo gallery

Open [Posecraft demos](https://jelizarovas.github.io/posecraft/demos.html), or choose **Demos** in the Studio toolbar. Each demo has a live preview, focused controls, a downloadable project and a link to its editor.

| Demo | What to try | Editable project |
| --- | --- | --- |
| [WWW after hours](https://jelizarovas.github.io/posecraft/demos.html#www-after-hours) | wwwzard, Ona and Rusty in a three-shot studio scene; timed expressions and camera cuts | Director episode |
| [Neon rehearsal](https://jelizarovas.github.io/posecraft/demos.html#neon-rehearsal) | Four performers, staggered actions, keyed placement and camera motion, then a backstage set | Director episode |
| [Rusty in the park](https://jelizarovas.github.io/posecraft/demos.html#rusty-in-the-park) | Ona and Rusty exchange gestures, with closer reaction shots | Director episode |
| [The drop lab](https://jelizarovas.github.io/posecraft/demos.html#drop-lab) | Drop, toss and catch three dummies; compare loose, head protection and bracing against collision platforms | Studio scene |
| [Zero gravity](https://jelizarovas.github.io/posecraft/demos.html#zero-gravity) | Drag the container, nudge the cast, curl up or float freely | Studio scene |
| [The expression lineup](https://jelizarovas.github.io/posecraft/demos.html#expression-ensemble) | Direct everyone or one actor; try 14 facial expressions, greeting, celebration, settling and optional sounds | Studio scene |

Neon rehearsal is a silent choreography demonstration. It does not include an audio timeline or music-video encoding. Physics is independent for each character; avatars do not collide with each other. Protective behaviors are bounded pose/torque responses, not learned intelligence or full balance control.

## Opening and sharing

Episode demos have play/pause, a time slider and direct shot buttons. Interactive demos have a cast selector and their own controls. Reset restores the original demo. **Download project** exports the starting project; gallery interactions are temporary. **Copy demo link** shares the selected demo, not the current playback time or live physics state.

**Edit in Director** and **Edit in Studio** open a separate local copy. Demo drafts use storage keys ending in `.demo.<id>`, so they do not overwrite your regular Studio or Director draft. Reopening that demo's editor restores your edited copy. Export it to a file to keep or share it. The regular editor link in the gallery header opens your ordinary draft.

On phones the demo cards form a horizontal strip. The preview and controls remain on one page without vertical scrolling at the tested 390×844 layout. On desktop all six cards remain visible. Thumbnails are static; only the selected demo runs a worker. Switching demos terminates the old worker. Hidden pages stop advancing and mute interaction sounds. Reduced-motion preference starts previews paused; Play explicitly starts them. No demo requests camera or microphone access.

## Reusable examples

`examples/showcase.js` exports `demoCatalog`, `findDemo(id)` and `createDemo(id)`. The factory returns a fresh `kind: 'scene'` or `kind: 'episode'` document containing the required character packs. Existing schema, episode, SVG, browser and React APIs consume the scene data. The factory does not share mutable actor inputs or artwork between calls.

The scenes reuse the existing owner-provided characters. Their original provenance remains inside the packs. Background sets and choreography are authored here as MIT example data. No assets or dialogue from an existing TV episode are included.

`npm test` validates all six project round trips, samples finite poses within joint limits, verifies factory isolation and proves all three lab dummies contact their platforms. `npm run test:demos` checks actual browser playback, shot/set changes, independent facial inputs, live physics, container dragging, opt-in sound, exports, a single active worker, separate editor storage and desktop/mobile layouts. Existing Studio and Director browser suites cover their entry points after adding the gallery links.
