# Live scenes

A live scene keeps responding to events while its clips provide individual movements. Its rules are saved in the project JSON alongside the cast, scenery, emitters and lighting. The campfire demo is an example: turning off the fire changes cooking and the campers' behavior, rather than merely hiding a flame.

## Editing in Studio

Open **Scene → Behaviors**. The inspector has five pages:

- **States:** choose the starting state, edit the random seed, and add actions that run when a state begins.
- **Branches:** connect states through a named event or a delay. Set the earliest and latest delay, a condition on a variable, and a choice weight.
- **Events:** edit initial variables and handlers that can run in any state. Use **Try an event** to test a named event with an optional actor.
- **Pointer:** bind a character, body part, gesture and response. Set resistance, the release event, and the speed threshold for fast hover.
- **Export:** download website HTML for the current project. The export panel describes its runtime requirements.

Changes use Studio's normal undo, redo and saved draft flow. Downloaded project JSON contains `behaviorGraph`, `interactions`, and the `presentation` choice. **Live illustration** enables the graph; **Sequenced scene** disables graph execution for directed playback. Opening a saved scene starts its rules from the configured initial state. The current transient reaction, cursor position and running timer are not saved as a new animation clip.

An event handler runs without changing the current state. This lets a camper shoo a pointer while the cold-fire recovery timer continues. Branch delays are sampled once when their state begins. The seed makes those choices repeatable; a branch's weight chooses among eligible alternatives.

## The campfire dependency

The default project has these states:

| State | What happens | What follows |
| --- | --- | --- |
| `warm` | Cooking heat and enabled fire effects operate. | `extinguish-fire` enters `cold`. |
| `cold` | Cooking heat stops. Flame, smoke, embers and the linked point light turn off. Campers fold their arms, shiver and look at their companions. | After a seeded delay of 8–14 seconds, enter `recover`. |
| `recover` | An available camper walks toward the logs, reaches to relight them, then returns to their seat. | The actual ignition sends `fire-lit`, returning the graph to `warm`. |

The `fireEnabled` variable reflects the state through its entry actions. Changing that variable alone does not extinguish the fire; send `extinguish-fire` or edit the relevant actions and conditions. To change the waiting time, edit the `cold → recover` branch. The restoration event occurs when ignition happens, so its timing does not depend on an unrelated timeout in the graph.

Clicking the fire's artwork sends `extinguish-fire`. The `ignite-fire` handler calls the immediate fire-on response, whose `fire-lit` completion returns the graph to `warm`. Both controls are saved as authored event rules.

Fire state overrides the effects at runtime without rewriting their authored settings. An effect disabled in the project stays disabled after an ordinary restoration. A flame with no enabled source, zero rate or zero opacity cannot provide cooking heat: automatic and manual relighting remain cold and report `fire-restart-blocked` without sending `fire-lit`. A graph action that explicitly enables the emitter can restore an authored-disabled source, provided its rate and opacity are positive. Graph emitter overrides control heat and rendering together. Cooking heat does not increase while the fire is out, including the demo's burn command. Prepared food and existing social interactions can finish; the rest of the scene continues. If the chosen camper leaves their campfire action, their reservation is released and another eligible camper can recover the fire.

## Default pointer bindings

Each of the four campers has five bindings:

| Target | Gesture and response | Released event |
| --- | --- | --- |
| Food | Drag and carry with the cursor | `food-throw` |
| Head | Drag with resistance 0.8 | `face-shoo` |
| Holding hand | Drag with resistance 0.65 | `face-shoo` |
| Free hand | Drag with resistance 0.65 | `face-shoo` |
| Whole character | Hover faster than 450 scene units per second | `face-shoo` |

Carrying converts the screen target through actor rotation, scale and the joint's parent transform. Resistant drags are bounded and settle after release. Cancelling a drag restores it without dispatching the release event. An event-only drag can target the whole actor without a joint and does not change the pose. Fast-hover speed is measured by the browser adapter; the runtime also limits repeated reactions with a short cooldown.

A released marshmallow follows one ballistic path from the release point. Its camper reacts angrily and replaces it afterward. Food and toast visibility move together, preventing a second snack from remaining at the old position. A shoo event makes the selected camper wave near their face. These event handlers do not reset the fire's state or recovery deadline.

## Runtime hooks

For a scene with the default graph, `controller.dispatch('extinguish-fire')` activates the dependency, and `controller.dispatch('ignite-fire')` restores the fire immediately. `controller.dispatch('food-throw', {actor, x, y})` and `controller.dispatch('face-shoo', {actor, x, y})` target a camper using scene coordinates. The browser adapter submits pointer start, move, end, cancel and hover commands through the configured bindings.

Frames expose `behavior` for the current graph state and `ensemble.fire` for the fire's actual state, phase, helper actor and heat availability. Its `available` and `blocked` flags identify unavailable sources and refused restarts. Emitter overrides are evaluated by the renderer and the linked light. Seeded simulation and event replay use fixed steps rather than wall-clock timers.

## Current limits

This is a data-driven state and event system, not a general scripting language. State actions support variables, actor inputs, emitters, events and the available ensemble responses. Graphs are bounded to 32 states, 128 branches, 32 variables and 16 actions per state or handler; pointer bindings are bounded to 48.

The campfire's cooking, sharing, relighting path and reaction poses still use its built-in ensemble mechanics. The graph makes their triggers, ordering and waiting times editable; it does not yet expose every movement algorithm as a visual node. Relighting uses a reach toward the logs, without a separate lighter asset. Pointer resistance is kinematic, not muscle simulation, and dragging does not record animation keyframes. Effects resume their seeded animation when enabled; they do not simulate lingering smoke after extinguishing.

Older saved drafts retain their authored data. They do not silently acquire this graph or its pointer bindings. Open the current demo and save a copy, or add the behavior and bindings explicitly in Studio, to use the live setup while preserving an older draft.


## Exporting a website illustration

Studio's **Export website** downloads HTML with the scene embedded. It chooses the lightweight illustration runtime when every actor uses authored motion, including scenes with contact constraints, emitter lighting, live rules, campfire behavior and pointer resistance. Floating, ragdoll or protective actors select the full physics player. A rig's unused physics profile does not force physics into an illustration.

The downloaded HTML references Posecraft's deployed runtime directory. Keep that directory and its imported chunks available. For a website with its own local runtime files, compile the saved scene JSON from this repository:

```sh
npm run compile:scene -- scene.json website-illustration
```

The destination must be empty. Compilation writes `index.html`, `manifest.json`, and `runtime/`; it never overwrites an existing website. Deploy the whole resulting directory to a static HTTP(S) host, including GitHub Pages. A direct `file://` open is not supported by browser module loading. The scene JSON is embedded, so the deployed folder does not need the source JSON beside it.

The compiler selects optional runtime providers from the scene data. A plain clip omits the campfire director; a live campfire includes it, its graph and pointer handlers. The SVG renderer and scene validators remain shared. Physics-free exports contain no Planck, physical character solver, recovery controller or `SceneController` module. Physical scenes retain the worker-capable full player. Tests inspect the emitted module graph and the modules actually requested by the browser, rather than relying on filenames or estimated savings. Typical tested JavaScript totals are about 90 KB for a clip with pointer resistance, 120 KB for the live campfire, and 675 KB for a physical scene including its worker. These are uncompressed JavaScript bytes; embedded scene artwork is additional, and sizes change with the feature set.

For an application that manages the exported HTML itself:

```js
import {inspectSceneFeatures, createSceneExport} from 'posecraft/scene-export';

const requirements = inspectSceneFeatures(scene);
const {html, manifest} = createSceneExport(scene, {
  runtimeBase: 'https://example.com/posecraft/runtime/',
  label: 'Campfire friends',
  autoplay: true,
});
```

`runtimeBase` must be an absolute HTTP(S) directory URL without credentials, a query or a fragment. The generated HTML escapes its label and embedded JSON. Its manifest identifies the selected runtime and the runtime manifest URL. Compiled-folder manifests also list every emitted file, byte count and module dependency. `npm run build` generates the shared runtime entries under `dist/runtime/` along with the Studio site.

Once loaded, `window.posecraft` exposes the illustration player: `play()`, `pause()`, `reset()`, `seek(seconds)`, `setInput(actor, input, value)`, and `dispose()`. Live illustrations also expose `dispatch(event, payload)`, `setVariable(name, value)`, `pointer(command)`, and the underlying `controller`. Seeking replays recorded user inputs, graph events and pointer actions, with the same 180-second replay limit as the scene player. Runtime event recording is bounded to 20,000 commands; graph-generated actions are not recorded twice. The lightweight player cannot switch an actor into physical simulation after export—export that scene with a physical actor when physical motion is required.

Illustrations pause rendering while hidden or offscreen and honor reduced motion. Click responses still update a paused image. The lightweight player runs bounded animation and scene rules on the main thread; it does not load a physics worker merely for kinematic pointer resistance. Audio and movie export are separate features and are not included in this website compiler.

Physical HTML that imports its runtime from another origin uses the full main-thread player because browsers prohibit that remote worker URL. Compile a self-contained website folder to keep the physical simulation in its worker.
