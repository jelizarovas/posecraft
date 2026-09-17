# From demos to a production studio

Status: implementation started, September 17, 2026. The first coordinated milestone is tracked below. The broader roadmap remains planned work, not a claim of completed features or delivery estimates. Existing behavior is documented in the linked guides.

## What is already usable

Posecraft has reusable character packs, constrained joints, numeric keyframes, expressions and looks, experimental depth rigs, scene lighting, thirteen demos, assisted physical responses, and browser/React embeds. Director adds scenes, shots, camera and placement keys, reference-frame comparison, seeded motion and webcam takes. Project JSON can be saved and reopened. See [Director](director.md), [rigs](spatial.md), [lighting](lighting.md) and [capture](capture.md).

## A production milestone

Make a 30-second original WWW cartoon with two shots and two characters. Import or draw a prop, have one character pick it up and hand it to the other, speak a short line, walk without sliding, and react. Add recorded dialogue, music and effects. Save the complete project, reopen it on another computer, and export a frame-accurate 1080p movie with synchronized audio. Also export the same character as a small interactive web embed. This exercises the gaps that separate today's demos from a usable studio.

## Priority order

| Priority | Work | Completion check |
| --- | --- | --- |
| 1 | Asset authoring and rig quality: vector/image import, editable paths/pivots, turnaround drawings, alternate hands/mouths, mesh or curve deformation, IK/FK, foot/hand pinning, attachments | Build an original character and animate a believable walk and prop handoff without editing source code |
| 1 | Timeline tools: multi-track selection, moving/copying/scaling keys, curve handles, onion skinning, motion paths, holds, markers, reusable clips and additive layers | Retiming a performance preserves contacts and gives predictable results at every scrubbed frame |
| 1 | Audio and output: dialogue/music/effect tracks, waveforms, scrubbing, lip-sync mouth cues, volume/pan keys, image sequences, transparent output and encoded movie export | Exported frames and audio agree with the timeline regardless of preview frame rate |
| 1 | Project durability: portable asset bundle, recovery snapshots, media relinking, schema migrations, searchable reusable assets and nested scenes | Reopen a project on another machine with all media and rig references intact |
| 2 | Directable behavior: record and bake physics, recovery, walking, gesture takes and procedural motion; editable constraints and contact corrections | An interactive performance becomes repeatable shot keys that can be corrected by hand |
| 2 | Scene and lighting tools: keyable lights, multiple lights, light size/range/falloff, per-material response, shadow casters/receivers, prop occlusion and render layers | Move a lamp behind a prop and reproduce the same lit result when scrubbing or exporting |
| 2 | Production editing: storyboard/animatic, shot transitions, camera paths, safe areas, captions/titles, review notes, shot versions and render queue | Finish and revise the 30-second film entirely within one project |
| 3 | Team and distribution tools: asset versioning, review links, merge/conflict handling, permissions, stable plugin API and packaged runtime builds | Update a shared rig without silently breaking existing shots or application embeds |

## Decisions to make early

- Keep interactive animation and authored film on the same scene format, with different playback policies. Film time must stay tied to the timeline and audio. Bake or cache simulation when exact scrubbing is needed.
- Preserve author intent. Noise, physics, motion capture and generated motion must be editable, repeatable, optional and bakeable. They cannot replace held poses, contact constraints or authored timing.
- Treat quality as artwork plus motion. Better lighting cannot repair a poor profile drawing, a sliding foot or a hand that misses its prop. Establish approved character turnarounds and a small set of polished actions before multiplying presets.
- Keep preview quality separate from export quality. Establish budgets for 1, 4 and 16 visible characters on desktop and phone, and reduce expensive effects predictably under load. Simulation already uses a worker; SVG drawing is currently the campfire bottleneck. Profile before choosing a GPU renderer or cached drawing approach.
- Preserve the compact interface with switchable workspaces for Draw/Rig, Animate, Direct and Sound. A single screen does not require every control to be visible at once. Include keyboard shortcuts, accessible focus, touch targets and numeric entry.
- Track asset provenance, fonts, color profiles, frame rate, resolution and missing dependencies in the project. These determine whether a scene can be reopened, shared and rendered consistently.

## Lighting terminology

Keep four controls distinct: cel coverage describes how far the dark region extends across the character; cel intensity describes its contrast; cast-shadow length describes how far the silhouette reaches across a receiver; light range describes attenuation with distance from a point source. Softness controls the edge, not the reach. An artistic cast-length override should retain foot contact and floor/wall continuity.

## Current limits that affect this plan

The [performance guide](performance.md) documents capped simulation catch-up and dropped elapsed time under load. That policy is useful for bounded interactive work but must not control movie or music timing. Physics worlds are per character; routing does not provide crowd avoidance or drive general locomotion. Depth rigs are visual approximations. Point shadows are planar and there is no prop shadowing, self-shadowing or multiple-light system. Director lacks audio tracks and encoded movie export. Portable Director project files now bundle referenced raster images; plain episode JSON excludes them. Webcam capture currently maps a limited set of joints and discrete expressions, not full-body or finger performance.

## Implementation milestone 1: author, retime and reopen

Three agents own separate workstreams. Integration, cross-workspace checks and publication are coordinated by the parent task. Existing campfire fixes remain the baseline.

| Workstream | Owner | First deliverable | Acceptance check | Status |
| --- | --- | --- | --- | --- |
| Timeline editing | timeline | Multi-track key selection; atomic move, copy, scale, delete and easing | Edit multiple tracks, undo, reload and sample the resulting timing without silent key collisions | Implemented and verified |
| Draw and rig | draw_rig | Basic vector authoring, supported SVG import, joint/pivot editing and Studio transfer | Create an original rig, save validated scene data and open it in Character Studio | Implemented and verified |
| Portable projects | portable_projects | Director project bundle containing referenced raster images | Reopen in a clean browser context with media intact; errors preserve the current project | Implemented and verified |

Integration gate passed: `test/studio-workflow-browser.mjs` creates original artwork and a joint in Draw, opens the isolated Studio draft, retimes authored keys, imports the result into Director, and reopens the portable project in a fresh phone-sized browser context. Artwork, timing and reference pixels survive the transfer. Individual workspace browser checks cover undo/reload, import rejection and compact layouts. The existing Studio/React, Director/video-capture and campfire-stability browser suites also passed on the production build.

User guides: [Draw / Rig](draw.md), [timeline editing](timeline.md), [portable projects](project-files.md). Each module is exported as an SDK subpath and included in the package type check.

This milestone establishes three priority-1 foundations. It does not complete the 30-second production-film milestone. Next dependencies are audio tracks and frame-accurate output, contact/attachment authoring, and deeper timeline tools such as curve handles and onion skinning. Physics baking, multiple lights, transitions and team workflows remain in their existing priority order.

## Scene organization and procedural effects

Implemented after milestone 1: separate Scene and Character workspaces; nested folders with inherited visibility; scene layers; seeded flame, smoke and ember emitters; an emitter-bound point light; independent effect preview and scrubbing. The campfire's stones and logs are static, while smoke, embers and flame use settings instead of generated clip tracks. Existing authored campfire drafts have an explicit, undoable conversion. Character clips remain separately editable. See [effects and folders](emitters.md).

This is the first procedural-effects authoring slice. Folders do not transform contents together. Emitters have no particle collision, general event scripts or joint attachment; the scene still supports one key light. These limits remain separate from the production-film milestone above.

## Shared rig and coordinated-scene follow-through

The Studio library and older demos now use the refreshed Ona/Dummy depth packs, including Ona's opaque hair and separately editable forearms/wrists. Whole-scene preview and position-key controls support coordinated multi-actor studies. The ship-in-a-bottle, loveseat staircase and gym examples use serialized editable scene data with measured contacts and repetition counts. Their motion is authored into clips. A shared Contacts & grips inspector now adds saved two-bone constraints to scene points and actor joints, with clip windows, repeating intervals, bend direction, strength and reach diagnostics. The worker and Director evaluate the same constraints. Automatic full-body balance, attachment parenting and rebaking remain roadmap work.

The gym and staircase now include action review, slow playback, looping and frame stepping. Stair gait tests cover shoe/riser clearance and weight transfer; gym checks cover planted stance, varied repetition timing, hand contacts and bench transitions. These checks supplement visual review rather than defining animation quality by themselves.

## Live scene authoring and website export

Studio now separates live illustrations from sequenced scenes. Its behavior inspector edits saved states, typed variables, random delays, conditional weighted branches, global event handlers and pointer bindings. Campfire demonstrates fire/cooking dependencies, cold recovery and resistant drags. The website compiler selects a physics-free illustration runtime or the physical runtime, and can build a self-hosted folder with only the selected dependency graph. See [live scenes](live-scenes.md).

The behavior editor is a form-based state machine, not a node canvas or a general algorithm editor. Campfire cooking, social behavior and movement still use reusable built-in ensemble mechanics. Complete dependency pruning of every rendering feature, physical simulation baking and arbitrary user-authored locomotion algorithms remain future work.
