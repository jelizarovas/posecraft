# Posecraft

Posecraft is an MIT-licensed 2D animation library and browser studio. Build a reusable character scene, edit its keyframes and states, export JSON, and embed it in a web app. No account, paid editor, or AI service is required.

**[Open Studio](https://jelizarovas.github.io/posecraft/) · [React demo](https://jelizarovas.github.io/posecraft/react-demo.html) · [wwwzard demo](https://jelizarovas.github.io/posecraft/wwwzard.html)**

## Run locally

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. `npm run build` creates the static GitHub Pages site in `dist`. The Pages workflow publishes `main` after the unit checks and build pass.

## What works in 0.1

- [Ship in a bottle](https://jelizarovas.github.io/posecraft/demos.html#ship-in-a-bottle), [One more flight](https://jelizarovas.github.io/posecraft/demos.html#loveseat-stairs), and [One more rep](https://jelizarovas.github.io/posecraft/demos.html#gym-routine): editable sailing, coordinated furniture carrying, and alternating pull-up/bench routines. Choose variations, scrub the whole scene, and open the same actors and clips in Studio.

- [Campfire night](https://jelizarovas.github.io/posecraft/demos.html#campfire-night): four Ona looks, responsive sharing and eating, flickering point light, clouds and meteors. Download the editable scene.
- [Light & shade](https://jelizarovas.github.io/posecraft/demos.html#light-and-shade): scene lighting, character gradients/highlights, floor and wall shadows, contact shadows and planar reflections. Edit in Studio�s Light panel. [Lighting guide and limits](docs/lighting.md).

- [Turn & pose](https://jelizarovas.github.io/posecraft/demos.html#turn-and-pose), an Ona/Dummy depth-rig study with curved facial projection, front/back visibility, depth ordering, continuous soft arms, independent elbows/wrists and keyable yaw/pitch. [Rig guide and limits](docs/spatial.md).

- [Thirteen live demos](https://jelizarovas.github.io/posecraft/demos.html), including [Shake & settle](https://jelizarovas.github.io/posecraft/demos.html#shake-and-settle) with opt-in phone motion, assisted get-up, return to marks and click-to-walk. [Demo guide](docs/demos.md).

- [Director](https://jelizarovas.github.io/posecraft/director.html) for reusable scenes, timed shots, camera/actor keys, seeded motion with baking, and local video-frame references. Read the [Director guide](docs/director.md).
- One-screen Studio with Material icons, selectable body parts, draggable rotation handles, joint-limit arcs and editable limits, keyframes, transition blending, undo/redo, local recovery, and JSON open/save/export.
- Ona (13 actions), wwwzard (10 actions), Rusty (8 seated actions), and an original jointed Dummy (6 actions), each with 14 expressions. Ona includes six hair options. Appearance and input settings are independent per character.
- [Contacts & grips](docs/contacts.md) for planted feet and moving handles, with clip windows, bend direction, strength, reach guides, undo and export. Gym and staircase demos include slow playback, action loops and frame stepping.
- Shared portable scene compiler, SVG renderer, and fixed-step inertial response to a moving container.
- Floating and falling ragdolls, contact-driven protective poses, adjustable muscle strength, automatic facial responses, and opt-in synthesized sound effects. Read the [reaction guide](docs/reactions.md).
- Worker simulation with bounded queues and cancellable static-obstacle routing. The playground supports 1/4/8/16 avatars with timing diagnostics. Read [performance and routing](docs/performance.md).
- React and plain browser adapters with input/events, automatic sizing, reduced motion, offscreen/hidden suspension, and disposal.
- Agent SDK, CLI, [repo skill](skills/posecraft/SKILL.md), [API docs](docs/api.md), and TypeScript declarations for the new scene APIs.
- Preserved wwwzard example with its original artwork, action layers, keyboard targets, and robe simulation.

Use **Add Dummy** in the character library. Use **+** beside the Props selector to add a platform, then drag it into place. Its **Collision box** tab controls size, offset, friction, bounce, and whether it collides. Test falls through **Feel**. The React playground has a Platforms toggle.

The Studio includes authored limb rotation, contact constraints, live event graphs, [action variations and stats](docs/actions.md), and a [ship-in-a-bottle slosh model](docs/fluids.md). General fluid dynamics, full physical balance and quadruped locomotion remain later milestones. See the [scope and requirements mapping](docs/mvp-status.md) and [full product brief](POSECRAFT_REQUIREMENTS.md). The portable wwwzard pack uses sampled actions, solid fills, and rigid sleeves; the original demo retains procedural cloth and typing. Ukis has not been migrated.

## Studio controls

Select a body part on the canvas or in the left list. Drag its purple handle or change Rotation, move the playhead, and press **+** to save keyframes for the parts you posed. The Pose tab exposes minimum/maximum angles and pivot coordinates. Tightening limits clamps existing rotation keys in the same undoable edit.

Use **Look** for hair and colors, **Motion** for spring settings, and **Feel** for physical modes, protective poses, face responses, sound, and interaction tests. Use the hand tool or drag empty card space to test container reactions. The motion selector shows whether device preferences have disabled motion; choose **Motion on** for an explicit preview. The timeline can remain paused while the spring reacts. On narrow screens, the top scene and inspector buttons reveal each panel.

Drafts use `posecraft.studio.v2`. The previous draft is preserved and can be opened from the **…** menu; a backup of the current project downloads first.

## Embed a scene

Install from a pinned Git commit or from a local archive made with `npm pack`. The package is not published to the npm registry; `private: true` prevents accidental registry publication. For example, after cloning this repository next to your app, use `npm install ../posecraft`. React is an optional peer dependency. The original skeletal entry has no runtime dependencies; the portable scene runtime uses Planck for physical modes.

```jsx
import { Posecraft } from 'posecraft/react';
import scene from './my-scene.posecraft.json';

<div style={{ width: 400, height: 250 }}>
  <Posecraft scene={scene} inputs={{ ona: { action: 'wave', emotion: 'happy' } }}
    label="Ona waves hello" onEvent={console.log} />
</div>
```

For a moving modal, supply its ref as `hostRef`. The [API](docs/api.md) describes explicit motion signals, supported translation range, and runtime ownership.

## Agent authoring

```sh
node tools/cli.mjs capabilities
node tools/cli.mjs inspect examples/characters/ona.json
node tools/cli.mjs validate examples/characters/ona.json
node tools/cli.mjs preview examples/characters/ona.json preview.svg 0.5
```

The command API used by Studio is also available as `posecraft/commands`. The CLI supports revision-checked edits and repeatable input/acceleration scenarios. Read [skills/posecraft/SKILL.md](skills/posecraft/SKILL.md) for the agent workflow.

## Run a skeleton

```js
import { AnimationController } from 'posecraft';

const runtime = new AnimationController({
	joints: [{
		id: 'root', parent: null, x: 0, y: 0,
		length: 10, rotation: 0, min: -180, max: 180
	}]
});

const frame = runtime.step(1 / 60);
console.log(frame.world.root.endX); // 10
```

## Runtime API

The package exports `AnimationController`, `clamp`, `lerp`, `wrapAngle`, `mixAngle`, `interpolate`, `sampleClip`, `forwardKinematics`, `constrainPose`, and `solveTwoBoneIK`.

Definitions contain parent-first `joints`, optional `defaults`, typed `inputs`, `clips`, `chains`, `layers`, `events`, and `eventInputs`. Angles use degrees. Time uses seconds. Coordinates use your renderer's units.

Layers contain `name`, `mode`, `weight`, `initial`, `mask`, `neutral`, and `states`. A state samples a clip, a callback, or a one-dimensional blend. Transitions respond to events or input predicates. Layers mix numeric channels, including channels your renderer uses for visibility and depth.

An IK chain contains `id`, `upper`, `lower`, and `bend`, either -1 or 1. Its optional `target({ pose, inputs, time })` callback returns `{ x, y, weight }`. Without a callback, the runtime reads `ik.<id>.x`, `ik.<id>.y`, and `ik.<id>.weight` from the pose.

`step(seconds)` returns `pose`, `world`, `targets`, `time`, and `layers`. The runtime does not schedule frames. `setInput`, `send`, `setLayerWeight`, and `setInterpolation` control playback. `subscribe` registers an event listener and returns an unsubscribe function.

`setJointLimit` changes constraints. `setKeyframe`, `removeKeyframe`, `seek`, `previewJoint`, `exportTake`, and `importTake` manage joint-rotation takes. Takes apply after IK. Imported takes have version 1 and durations between 0.1 and 60 seconds.

## Local development

Run `npm test` for the core, scene, and wwwzard regression suite. With the dev server at port 5178, run `npm run test:browser` for the Studio and React browser checks. Windows uses installed Edge; on Linux install Playwright Chromium first. Set `POSECRAFT_URL` to test another base URL, including a Pages project subpath. Run `npm run check:package` to inspect package contents without publishing.

The Career OS portfolio consumes this folder as a sibling file dependency. Keep the `resume` and `posecraft` folders under the same parent when working on both. The package itself has no dependency on that arrangement.

## License and attribution

MIT, copyright 2026 Arnas. Ona's original MIT notice is retained in `examples/ONA-LICENSE`. wwwzard source was reused from the owner's portfolio. The bundled Studio uses React, Vite, Playwright and TypeScript under their package licenses. Planck uses MIT and its notice ships with the site. Roboto uses the SIL Open Font License. Material Symbols uses Apache 2.0. Both fonts are self-hosted with their license notices. Rusty's source artwork is retained from the same owner-provided character library as Ona. User-imported artwork retains its own license.

Director now includes **Perform** for local webcam acting: calibration, face/hand tracking, recorded takes, review and pose/expression baking. Read [webcam capture](docs/capture.md). The optional vision SDK and WASM use Apache 2.0, with pinned official model sources in [the asset record](public/vision/README.md). Posecraft remains MIT.

## Try the demos

The [demo gallery](https://jelizarovas.github.io/posecraft/demos.html) includes WWW after hours, Neon rehearsal, Rusty in the park, a three-dummy drop lab, Zero gravity, and a four-character expression lineup. Every demo opens as a separate editable project and can be downloaded as JSON. See [the demo guide](docs/demos.md) for controls, limitations and reusable example factories.
