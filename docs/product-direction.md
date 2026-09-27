# Posecraft product direction

Established September 26, 2026 from the user's direction. This defines goals and acceptance requirements, not implemented capabilities or measured performance. It takes precedence over earlier milestone ordering and mandatory 3D production plans. Later explicit user requests can change scope.

## Purpose

Posecraft is a 2D animation studio for making illustrations that look deliberately designed, move convincingly and remain alive inside real websites. A creator should be able to build, direct and reuse a character or scene, then publish the same work without rebuilding it in application code. The desired reaction is "This was created with Posecraft?"

The first consumers are Little Lands Adventures, ukis.app and jelizarovas.com. Share authoring and playback capabilities across them while allowing each its own art direction. Littlelands owns its quests and game rules. A portfolio should load only the illustration capabilities it uses.

The user selected Wwzard for the first illustration, replacing the proposed Atlas scene, and supplied the [visual reference](references/wwzard-style-reference.png). Keep 2D artwork and motion as the active path. Preserve earlier 3D experiments as existing work; neither native 3D nor a 3D asset-production workflow is required to achieve this goal. Older film/audio milestones remain deferred requirements rather than the current delivery gate.

## What went wrong

The project accumulated useful components, but implementation breadth became easier to demonstrate than a finished authoring outcome. The roadmap expanded into film production, native 3D workouts and a living game before a small website illustration established the desired quality and cost together. Technical checks and screenshot collection sometimes stood in for judging the actual performance. The existing quality reset records that failure explicitly.

The core is not empty. Scene documents, shared editing commands, clips, behavior graphs, actor state, contacts, attachments, export selection and visibility suspension already exist. A rewrite is not justified by this reset. The important gaps are how these parts become a creator's reusable tools, how runtime costs are selected, and how finished scenes are accepted.

Code and documentation inspected for this reset provide specific starting points:

| Evidence | Implication for the next scene |
| --- | --- |
| [Draw / Rig](draw.md) has a limited SVG importer and flat rest-pose rig editing; it lacks direct curve handles and turnaround authoring. | Trace one original character through the workflow and fix the authoring limitations that actually block it. Do not promise a full illustration editor from the presence of shape controls. |
| [Actor graphs](actor-behaviors.md) expose saved decisions, while ensemble code still owns some social and contact choreography. | Prove that the selected scene's decisions, actions and transitions can be edited and reused. Identify any remaining custom source code explicitly. |
| `inspectSceneFeatures` in [scene-export.js](../src/scene-export.js) selects the full player when `scene.game` exists, even with entirely authored animation. | Lightweight semantic interaction has a packaging gap. Separate command capability from physics loading if the acceptance scene needs it. |
| [mountIllustration](../src/illustration.js) suspends hidden/offscreen playback but schedules visible, playing scenes continuously. | Visibility suspension is not the same as sleeping during a settled visible state. Measure idle work and prove correct wakeup before claiming demand-driven playback. |
| [Map rendering](map-character-rendering.md) documents about 1.47 MB of compressed character sheets expanding to about 67.4 MiB of RGBA pixels before extra copies. | Transfer size alone is inadequate. Set decoded memory budgets before multiplying outfits, directions or actors. These are documented asset figures, not a new device measurement. |

This is a targeted assessment, not a repository-wide audit or fresh visual/performance certification.

## Values that affect implementation

### Designed art and motion

Approve the character's silhouette, proportions, palette and expressions in the views the scene needs. Use authored poses, holds, anticipation, follow-through, spacing and contact to communicate intent. Keep transitions as carefully made as the actions they connect. Scale changes must preserve readable artwork and composition at the actual destination sizes.

AI generation, procedural art and imported artwork are tools. Their output must pass the same review. Generic styling, arbitrary wiggles, repeated stock timing and extra effects are not substitutes for a coherent art direction. Label placeholders. Distinct people and species need distinct designs and appropriate movement.

### Wwzard reference and performance

The user-supplied image shows a wizard at a computer, with an oversized bent purple hat, a gold buckle, a plum robe, simple hands, a plant and a window. Its simplified isometric forms, faceted color planes, soft shading and uncluttered composition establish the intended visual language. Depth in the illustration does not require a live 3D scene. Preserve the character's face concealed beneath the brim; do not add facial features as a shortcut to expression. The user rejected the appearance of the existing SVG Wwzard. Changing the file format alone does not resolve that rejection.

Use the user's early Disney reference for pantomime: readable silhouette, clear anticipation, expressive holds, movement in arcs, controlled squash/stretch and overlapping follow-through. This is a motion reference, not a request to copy a particular Disney character. Let body lean, hand gestures, head/hat orientation and the hat tip carry emotion. Avoid rubbery motion everywhere or secondary motion that never settles.

Proposed motion-study beats are focused typing, noticing something, a curious held pose, a short response and a return to work. Curiosity might read through a forward lean and lifted brim; frustration through a held slump and withdrawn hands; delight through an upward pose and open gesture. These are candidates to inspect in motion, not approved poses or implemented behavior. The character should communicate at embed size without captions, facial features or decorative effects explaining the emotion.

The reference was supplied by the user on September 26, 2026 and is preserved unchanged in `docs/references/wwzard-style-reference.png`. Creator and license were not supplied. It is a design reference, not a finished rig or production animation asset.

### Life with intent

A scene may wait, notice something, make a choice, act and remember the outcome. Authors control which choices are possible and why. For example, a character can notice a visitor, finish putting a cup down before waving, acknowledge repeated attention differently, then return to a quiet activity.

Use clips and loops where they fit. Compose them with state, bounded variation, cooldowns, attention, completion events and explicit interruption rules. Randomness may vary a performance within authored limits; it cannot supply personality on its own. Seed it for reproducible review. Define which action owns each motion or prop so concurrent behaviors cannot fight over them. Continuous physics and runtime AI are not prerequisites for life.

### Reusable authoring

The complete path is create/import artwork, rig, animate, author behavior, compose a scene, preview, save/reopen and export. Studio and programmatic tools use the same persistent data and validated operations. Playback state is separate from editable source data.

Actions declare their inputs, targets, contacts, ownership, completion and cancellation behavior. Reuse them with documented corrections and parameters. Preserve the ability to art-direct exceptions. Prove reuse with a second character or scene; similar demo code is not enough. Hosts provide application state and receive events without implementing Posecraft's choreography again.

### Constraint-led web performance

Take the discipline of older constrained games: choose the representation for the job, reuse assets, precompute invariant work, keep memory explicit and make each frame's work bounded. This does not require retro artwork or a particular renderer.

Treat the author's editable project and the visitor's compiled payload as different products. Export only required modules and assets. Avoid shipping Studio, unused physics or unrelated demos. Use vector, raster, articulated parts or baked frames where each meets the art, scale and cost requirements; do not choose by renderer fashion.

Schedule infrequent decisions independently from smooth motion where practical. Settled content should avoid repeated evaluation and drawing. Account for pending timers, host motion and input when sleeping; waking must preserve semantic state without a catch-up burst. Bound caches, queues and event histories. Reduce optional detail predictably while preserving ownership, interactions and legibility. Reduced motion needs a deliberate usable presentation.

Many visitors amplify download and hosting costs; each visitor's device must also share CPU, GPU and memory with the rest of the page. Test several embeds together. No server simulation or model calls are required for ordinary playback. Browser caching and reusable runtime assets should reduce repeat visits' cost.

## Performance acceptance

Before expanding the acceptance scene, record numerical ceilings and workload definitions in its brief. Select them from the intended website and a measured baseline; until they exist, "extremely performant" remains unverified. Do not invent universal limits or describe targets as results.

| Budget | Required evidence |
| --- | --- |
| Delivery | Compressed runtime and artwork bytes, cold and warm startup, time to useful first frame and interactive readiness; network conditions stated. |
| Responsiveness | Host page with and without the same scene: scrolling/input responsiveness, long tasks, frame intervals and missed-frame rate. Separate main-thread, worker and rendering costs where measurable. |
| Frame work | Numerical time budgets at the chosen refresh rate, including p95 and p99 spikes. The animation gets a portion of the page's frame budget, not all of it. |
| Memory | Decoded images, CPU data, GPU resources where measurable, cache limits, peak loading and steady state. Label estimates and unavailable measurements. |
| Idle and lifecycle | Settled, hidden and offscreen work; timer/input wakeup, resume, repeated mounting and disposal. Check drift or lost events as well as time saved. |
| Scale | One embed and several simultaneous embeds, then the intended cast size. State asset sharing, settings, renderer, browser, device and sustained test duration. |

Use a representative lower-powered physical phone as well as desktop for delivery evidence. Emulation is useful diagnostic evidence and must be labeled. Sustained frame and thermal behavior matter; do not infer battery savings from worker or CPU submission timings. Inspect quality at each performance tier so a frozen or broken scene cannot win a benchmark.

## Next acceptance scene

Finish one small 2D living Wwzard illustration for a real website-sized placement, following the supplied reference rather than the existing SVG character's appearance. Start with the wizard at his computer as the proposed scene. The first checkpoint is the finished design and a short motion study of working, noticing, responding and settling back into work; inspect whether the emotion reads without a visible face. Exact choreography and final composition remain to be developed.

1. Establish a finished character and composition at narrow and wide embed sizes. Review the poses, expressions and transitions needed by this scene before multiplying actions.
2. Author a quiet activity, a context/input-driven response and a return to rest. Include state or memory that changes a later response. Review repeated input, mid-action interruption, completion and recovery over sustained playback so one short loop cannot masquerade as the whole system.
3. Create and revise the scene through Studio. Save/reopen with its artwork, motion and behavior intact. Record any source-code-only steps as gaps.
4. Export it into a representative host page with real surrounding content. Verify responsive layout, input, reduced motion, suspension, resume and disposal. Set and meet the scene's numerical performance budgets.
5. Reuse an authored behavior or action in a second scene or distinct character, with corrections exposed as data. This is evidence of scalability of authoring as well as playback.

Track visual acceptance, authoring/reuse, runtime correctness and website cost independently. Do not mark the milestone complete when one is missing. Physical-phone evidence that cannot be obtained stays explicitly pending. Deploy only when requested.

New engine work must name the failure in this path that it resolves. Do not expand maps, native 3D, film output or a general simulation engine merely because those workstreams already exist. Preserve useful prior work and focus the next implementation on a finished result.
