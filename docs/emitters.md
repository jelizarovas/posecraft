# Scene effects and folders

Open **Scene** in Character Studio's left sidebar to select scenery, characters, props, folders and effects. Select a character and choose **Animate character**, or open the **Character** workspace, to edit its body parts and clips. Fire, smoke and embers have their own effect controls; they no longer need a rig full of flame and smoke keyframes.

## Campfire

The current Campfire night demo keeps the stones and logs as static artwork. Three effects supply the flame, rising smoke and embers. The flame drives the scene's point light, so its procedural pulse also changes illumination and cel-shadow coverage. They sit in the Campfire folder, with the landscape and campers in separate folders. The campers' hand contacts, cooking clips, gestures, facial acting and live ensemble remain separate from these effects.

Old Studio demo drafts are kept when you reopen the editor. To update one without losing your character work, use **More options → Convert campfire effects**. This explicitly replaces the old built-in flame, ember and smoke artwork and tracks; it preserves character edits, unrelated fire artwork and any old joints still needed by custom artwork. Undo restores the previous scene. Conversion is idempotent.

**Reload current demo** instead loads the complete latest example and downloads the previous draft as a JSON backup first. It is useful for starting fresh. Neither action runs automatically.

## Editing an effect

Select an effect in the Scene tree. In **Effect**, adjust the following:

| Control | Behavior |
| --- | --- |
| Flutter / second | Flame pulse frequency; zero extinguishes it |
| Births / second | Average smoke or ember emission rate; zero stops emission |
| Randomness | Variation in birth timing, drift, speed and size; flame variation controls flutter |
| Seed | Reproducible variation; another seed gives another pattern |
| Lifetime | How long a smoke puff or ember survives |
| Speed / spread | Rise speed and horizontal scatter of smoke and embers |
| Size / color / opacity | Appearance of the effect |
| Particle limit | Maximum allocated particle slots; the flame uses up to three shapes |
| Drive the scene point light | Bind the one scene light to this emitter |

In **Placement**, choose a folder, visibility, layer, actor attachment and position. An attached effect uses local coordinates in its actor's placement and draws directly after that actor. Its layer follows the actor. An unattached effect uses scene coordinates and its own layer. Attachment follows actor placement; it does not attach to an individual animated joint.

Use the effect preview and scene-time scrubber below the viewport to inspect a time without changing character clip keys. Pause freezes the effects. Still preview stops automatic advancement; the scrubber still selects a time. Smoke and ember emitters start empty and accumulate births as time advances; the flame is visible immediately.

## Folders and light

Folders organize selection and inherited visibility. Hiding a folder hides its descendants, including effects. Hiding an effect's attached actor also hides the effect. A hidden or disabled light-driving emitter turns off its contribution while leaving ambient illumination. Removing a folder reparents its contents rather than deleting them. Folders do not apply a shared transform.

The bound point light follows the emitter's position, transformed by its attached actor. For a flame, the source sits 45% of its size above its base. Existing point X/Y settings are used only while no emitter is bound. The same procedural pulse drives the visible flame and the bound light. This is still one stylized scene light, not a multiple-light or volumetric renderer.

## Runtime and performance

Scene JSON stores `groups`, `emitters`, each item's optional `group`/`hidden`, and `lighting.emitter`. The format remains version 1 and declares `scene-groups` and `procedural-emitters` in `requiredFeatures`.

Emitter samples depend on scene time, settings and seed. Seeking computes births directly instead of simulating every earlier frame. Smoke and ember births use seeded timing jitter; this is bounded procedural variation, not a fluid simulation or true random wall-clock event stream. Replaying the same time produces the same result.

The renderer allocates at most 128 particle slots per emitter and 512 across the scene. A flame uses at most three. When a requested rate and lifetime exceed a particle limit, older particles may be replaced before reaching their full lifetime. Increasing the limit helps only within the shared scene cap. Effects use fixed SVG nodes whose transforms and opacity change; they do not add an unbounded trail of DOM elements.

`posecraft/emitters` exports `sampleEmitter`, `sampleEmitters`, `emitterPulse` and capacity constants. `posecraft/scene-graph` exports folder visibility and scene-entity helpers. Existing SVG/runtime embeds render effects from the same saved scene. There are no particle collisions, joint emitters, editable birth curves, volumetric smoke or general particle scripting in this first version.
