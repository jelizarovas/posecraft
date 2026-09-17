# Demo gallery

Open [Posecraft demos](https://jelizarovas.github.io/posecraft/demos.html), or choose **Demos** in the Studio toolbar. Each demo has a live preview, focused controls, a downloadable project and a link to its editor.

| Demo | What to try | Editable project |
| --- | --- | --- |
| [Ship in a bottle](https://jelizarovas.github.io/posecraft/demos.html#ship-in-a-bottle) | Calm, breeze and gust; rocking hull, articulated canvas, waves and layered glass | Studio scene |
| [One more flight](https://jelizarovas.github.io/posecraft/demos.html#loveseat-stairs) | Two dummies carrying a loveseat up endless stairs; alternating arm rests and partner compensation | Studio scene |
| [One more rep](https://jelizarovas.github.io/posecraft/demos.html#gym-routine) | Eight pull-ups, failed sets after six/seven, walking between stations and bench presses | Studio scene |
| [Campfire night](https://jelizarovas.github.io/posecraft/demos.html#campfire-night) | Four friends around a flickering fire, attention-driven cooking, conversations, shared meteor reactions and occasional food handoffs | Studio scene |
| [Light & shade](https://jelizarovas.github.io/posecraft/demos.html#light-and-shade) | Move the light, adjust highlights and reflections, compare warm/cool/flat treatments, and jump to see contact shadows fade | Studio scene |
| [Turn & pose](https://jelizarovas.github.io/posecraft/demos.html#turn-and-pose) | Turn heads/bodies, send limbs behind the torso, blend Ona's arm shape and lift Dummy's knees in depth | Studio scene |
| [Shake & settle](https://jelizarovas.github.io/posecraft/demos.html#shake-and-settle) | Enable phone motion or press Shake scene; the cast falls, gets up and returns to its marks. Select a character and tap the stage to walk, or use Walk around | Studio scene |
| [WWW after hours](https://jelizarovas.github.io/posecraft/demos.html#www-after-hours) | wwwzard, Ona and Rusty in a three-shot studio scene; timed expressions and camera cuts | Director episode |
| [Neon rehearsal](https://jelizarovas.github.io/posecraft/demos.html#neon-rehearsal) | Four performers, staggered actions, keyed placement and camera motion, then a backstage set | Director episode |
| [Rusty in the park](https://jelizarovas.github.io/posecraft/demos.html#rusty-in-the-park) | Ona and Rusty exchange gestures, with closer reaction shots | Director episode |
| [The drop lab](https://jelizarovas.github.io/posecraft/demos.html#drop-lab) | Drop, toss and catch three dummies; compare loose, head protection and bracing against collision platforms, followed by assisted recovery | Studio scene |
| [Zero gravity](https://jelizarovas.github.io/posecraft/demos.html#zero-gravity) | Drag the container, nudge the cast, curl up or float freely | Studio scene |
| [The expression lineup](https://jelizarovas.github.io/posecraft/demos.html#expression-ensemble) | Direct everyone or one actor; try 14 facial expressions, greeting, celebration, settling and optional sounds | Studio scene |

Neon rehearsal is a silent choreography demonstration. It does not include an audio timeline or music-video encoding. Physics is independent for each character; avatars do not collide with each other. Protective behaviors are bounded pose/torque responses, not learned intelligence or full balance control.

## Opening and sharing

Episode demos have play/pause, a time slider and direct shot buttons. Interactive demos have a cast selector and their own controls. Reset restores the original demo. **Download project** exports the starting project; gallery interactions are temporary, except the Light & shade lighting settings which are included in its download. **Copy demo link** shares the selected demo, not the current playback time or live physics state.

**Edit in Director** and **Edit in Studio** open a separate local copy. Demo drafts use storage keys ending in `.demo.<id>`, so they do not overwrite your regular Studio or Director draft. Reopening that demo's editor restores your edited copy. Export it to a file to keep or share it. The regular editor link in the gallery header opens your ordinary draft.

On phones the demo cards form a horizontal strip. The preview and controls remain on one page without vertical scrolling at the tested 390×844 layout. On desktop all thirteen cards remain visible. Thumbnails are static; only the selected demo runs a worker. Switching demos terminates the old worker. Hidden pages stop advancing and mute interaction sounds. Reduced-motion preference starts previews paused; Play explicitly starts them. No demo requests camera or microphone access.

## Reusable examples

`examples/showcase.js` exports `demoCatalog`, `findDemo(id)` and `createDemo(id)`. The factory returns a fresh `kind: 'scene'` or `kind: 'episode'` document containing the required character packs. Existing schema, episode, SVG, browser and React APIs consume the scene data. The factory does not share mutable actor inputs or artwork between calls.

The scenes reuse the existing owner-provided characters. Their original provenance remains inside the packs. Background sets and choreography are authored here as MIT example data. No assets or dialogue from an existing TV episode are included.

`npm test` validates all thirteen project round trips, samples finite poses within joint limits, verifies factory isolation and proves all three lab dummies contact their platforms. `npm run test:demos` checks actual browser playback, shot/set changes, independent facial inputs, live physics, container dragging, opt-in sound, exports, a single active worker, separate editor storage and desktop/mobile layouts. Existing Studio and Director browser suites cover their entry points after adding the gallery links.

## Campfire night

Maple, Juniper, Ember and Clover stand around the fire at different depths and viewing angles. A seeded event controller tracks each camper's attention and roasting heat. They chat, watch the fire, stargaze and doze; missing the right cooking moment can burn a snack. A meteor's first observer briefly raises a hand, lowers it, and keeps following with their head. The others look after a delay. There is no added finger. Occasionally one camper offers another a treat. The giver presents it and waits for a response. A distant recipient notices, turns and walks over before reaching; the marshmallow transfers only when the projected hands meet. They eat and return to their original place. An unnoticed offer can end in disappointment and a throw into the fire, or another friend can call attention to it before it is too late. Burned snacks trigger a brief startled hop, wide eyes and drawn reaction marks. The evening continues beyond the first minute with new event times; it is not a repeated 24-second scene.

**Conversation**, **Daydream**, **Meteor** and **Share a treat** request events immediately. **More reactions** lets you inspect **Missed offer**, **Friend calls out** and **Burned treat**. **Sound on** adds short synthesized reaction cues; the callout is a visual gesture, without spoken dialogue. **New evening** changes the seed. Reset replays the same seed, and the slider replays its first minute, including requested events. Play/pause and hiding the page pause scene time. Sharing temporarily occupies both participants; another sharing request is ignored until they finish. The request button makes sharing easy to inspect; spontaneous sharing is much less frequent.

The cast uses separate two-segment arms with hand contact, a planted roasting stick, snack removal, biting and replacement clips. Near-side campers show rear-quarter views. Draw order puts the fire between the far and near characters. Each camper has a ground line for contact shadows. Meteor paths and streak angles use the same straight trajectory, with a tapered, fading trail.

Download includes the seed, ensemble descriptor, artwork and editable clips. `SceneController` and the browser/React worker path run the same ensemble, so the downloaded scene retains live behavior when played with this runtime. Studio's explicit clip preview overrides the selected camper for key editing. Director currently samples authored clips and does not run this live director; movie baking remains future work. Opening the editor restores its existing separate draft, so older edited campfire drafts retain their earlier scene data.

This is an example-specific rules controller with visual conversation and authored gestures. It does not generate spoken dialogue, reason with a language model, simulate gripping, or implement general crowd behavior. See [the ensemble API](api.md#campfire-ensemble).

## Phone motion and returning to a mark

Open **Shake & settle** on your phone and tap **Enable phone**, then allow motion access if prompted. Shake or turn the device, then hold still. Acceleration and rotation-rate readings move the scene and toss the cast. Input fades when readings stop. The characters wait for support and a quiet moment, blend into an upright pose, and walk back to their original marks. **Shake scene** provides the same interaction on desktop without sensors.

The browser needs a secure page and device support. Permission is requested only from the enable button. Denied access, missing sensors or no readings leave the desktop control available. Pause, reset, changing demos and hiding the page turn sensors off; enable them again to resume. Readings stay in the browser. See [MDN's motion permission reference](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static).

**Walk around** moves the selected cast between random destinations on the floor. Tap the stage for a specific destination. A shake interrupts the walk; recovery returns to the original mark, not the last clicked destination. The caption identifies each character's phase. These are assisted get-up and walk animations with a straight-route support/obstacle check. They do not implement physical balance, foot planting, steps, climbing, crowd avoidance or dynamic pathfinding. Ona has a small shuffle; wwwzard and Dummy have articulated walk cycles. Characters can overlap each other.

`npm run test:motion` covers shaking, recovery, walking, sensor permission and synthetic readings, lifecycle cleanup and compact layouts. These checks do not replace testing on a physical phone.

The **Turn & pose** study adds rotation clips and manual controls to the same Ona and Dummy depth rigs used by the library. Existing saved scenes keep their authored data. **Edit in Studio** exposes keyable pose channels. Read [the depth-rig guide](spatial.md) for the data format and current visual limits.

Campfire gaze changes use a damped turn sampled between fixed simulation steps. Each eye has its own curved placement on the head. Hair is an opaque projected cap with hidden geometry clipped away; it does not use the optional front/back fade.

## Studio and the shared rigs

The older gallery scenes now use the current Ona and Dummy depth artwork, scene folders and lighting. Ona has an opaque styled hair shell and separate forearms and wrists, using the same rounded limb renderer as the campfire. Dummy retains independent foot turns. These packs are also the defaults in the Studio library. Existing saved drafts keep their authored data; **More → Upgrade selected character rig** upgrades an older flat Ona or Dummy while retaining its clips, and Undo restores the previous rig. **Reload current demo** loads the latest demo data after downloading the previous draft as a backup.

In Studio, choose **Scene**, select a folder or actor, and use **Play scene** or the scene-time slider to review all actors together. Select **Animate character** to edit a rig. The pose channels now include **Position X** and **Position Y**, alongside rotation and the depth channels. Explicit scrubbing samples the requested pose even when playback is paused or the system requests reduced motion.

## Ship, stairs and gym

The ship uses 12-second calm, breeze and gust clips, with separate editable hull, mast, sail, wave and cloud joints. Glass, cork, stand and room are independent scene actors. The transparent appearance is layered vector artwork, not a physical refraction simulation.

The loveseat's 12-second climb contains two pauses. One mover releases an arm while the other three hands keep their handles, and the partner leans into the load. Feet plant on moving treads; the repeating staircase wraps outside the view. **Rest lower arm** and **Rest upper arm** select separate six-second studies. Every actor changes clip together, so the sofa, movers and stairs stay synchronized. The step-to gait clears a single riser, transfers weight onto the leading foot, then brings the trailing foot up. Supporting grips are editable live contacts. The furniture load remains authored choreography, not a shared rigid-body simulation.

Atlas's 180-second workout alternates three 60-second rounds: eight completed pull-ups, a stalled attempt after six, then a stalled attempt after seven. Reps slow with fatigue, with a held effort and an uneven failed attempt. Each round includes preparation, recovery, a planted walk, sitting and reclining onto the bench, three presses, sitting up, standing, and returning to the bar. The outcome buttons isolate one round. Hands stay on the stationary bar and moving barbell through two-bone contacts; effort marks, expressions and sweat follow the performance. The sequence is deterministic and editable, not a physiological fatigue model.

The three new demos export their chosen action variant in project JSON. They use ordinary scene packs and clips, so the runtime and Studio render the same data. Gallery controls restart each coordinated sequence from its beginning. The editor restores any existing draft for that demo; it does not overwrite it with gallery interactions.

`npm run test:new-demos` checks the actual gallery, supporting hand contacts, rest and failure controls, whole-scene Studio scrubbing, position-key editing, portable downloads, and desktop/phone layouts. Unit tests measure grip and foot contacts between authored keys, repetition counts, and loop continuity.

Use **Review**, **Speed**, **Loop action**, and the frame-step button on the gym and staircase to inspect transitions. Studio provides **Scene → actor → Contacts & grips** for saved hand and foot targets. Read [contact authoring](contacts.md) for timing, limits and the runtime API.
