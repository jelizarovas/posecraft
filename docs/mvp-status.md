# Milestone 1 scope and decisions

The full product brief remains in `POSECRAFT_REQUIREMENTS.md`. This milestone implements the initial editor-to-runtime path. It does not complete the physical-character or fluid milestones.

## Assessment and decisions

The starting repository had a dependency-free JavaScript skeletal engine with layers, callback-based states, constrained two-bone IK, and rotation takes. Six tests passed. The portfolio consumed it through a character adapter. The new scene compiler preserves that API and adds a declarative, validated subset.

Keep one package with separate subpath exports. Use JavaScript plus TypeScript declarations to avoid replacing the working engine tonight. Use native SVG because both supplied characters already have vector artwork and the first scene is small. Reuse the existing controller for pose evaluation. Add a simple bounded spring for Milestone 1's inertial response. The first physical slice now uses Planck 1.4.2 for articulated ragdolls, rectangular-container contacts, and bounded protective motors. Fluid solvers remain a later decision.

Use GitHub Pages for the static Studio with relative build paths. There is no backend, account, or required hosted API. Keep the agent SDK, CLI, skill, schema types, and examples in the same public repository. The user selected MIT. Npm publication and a registry package name are not required to use the Git repository or a local package archive.

## Requirements mapping

| Area | Working slice | Remaining scope |
| --- | --- | --- |
| ARC, DOC | Shared runtime, commands, versioned data, finite/reference validation, independent actors, JSON round trip | Reusable scene instances, external assets, migrations for future versions |
| REN | Live SVG paths on hierarchical joints, separate draw order, source Ona geometry | Clips/masks/images, mesh deformation |
| ANM | Numeric keyframes/easing, scrubbing, looping, typed input states, blend durations, fixed steps, recorded replay | Trigger/timed state editor, general graph editor, scene-level choreography |
| REA | React adapter, inputs/events, sizing, translation/acceleration response, hidden/offscreen suspension, disposal, reduced motion, SSR import | Angular motion, Ukis ownership handoff, robust contact model |
| STU | Compact one-screen layout, Material icons, canvas part picking/rotation handles, editable joint limits/pivots, per-instance hair/colors, library, pose/key editing, transition blend editor, undo/redo, open/save/export/local recovery | Grouping, arbitrary rig creation, drawing tools, full state-graph editing |
| AGT | Inspect, capabilities, validate, transactional edits, scenario simulation, SVG preview, repo skill | MCP transport, preview sequences, richer physics diagnostics |
| Characters | Ona with 13 actions and six hair options; portable wwwzard with 10 actions; seated Rusty with eight actions; original Dummy with six actions and 15 joints; 14 expressions each; original wwwzard demo preserved | Ona elbow/palm separation, quadruped locomotion, procedural cloth in portable packs, scene fallbacks |
| PHY / CHR / BEH | Spring mode; articulated passive/active ragdolls; container contacts; predicted-impact protection; bounded recovery assistance; facial responses; synthesized interaction sounds | Full planting/balance feedback, corrective steps, grips, moving supports, self/inter-character collisions, general recovery, gait families |
| FLU | No fluid module included | Milestone 4: contained water and physically coupled ship, declared operating range |

The detailed character contract in `contract-proposal.md` remains a future design proposal. The implemented API is documented in `api.md`. No consumer changes were made in Ukis or the portfolio. Their original files and modal behavior remain intact.

## Acceptance evidence

Runtime tests verify imports, atomic edits and rollback, stale revisions, round trips, two independent actors, transition plus inertia, constant-velocity behavior, settling, fixed-step equivalence, replay with no duplicate events, and reduced motion. Browser tests measure a visible reaction from actual mouse drags and settling, still preview, canvas body selection and rotation, keyframe/limit edits with undo, per-instance appearance, all four library characters, export/import/reload, compact desktop/mobile layouts, and the separate React consumer. Physics tests cover joint/anchor stability, predicted protection before contact, impact/recovery, momentum across mode changes, replay, and still poses. The response browser suite verifies a real audio waveform, mute, facial states, contact overlays, and saved-project upgrades. Run `npm test`, `npm run test:browser`, `npm run test:responses`, and `npm run build`.

Performance is not certified against the full QLT-01/02 targets yet. SVG frame updates reuse DOM nodes, but Studio's preview loop is still active while visible and paused to support dragging. The runtime adapter suspends its loop for reduced motion, offscreen content, and hidden documents. Mobile layout and desktop browser testing do not replace physical iPhone testing.

Static rectangular props now have editable collision boxes, offsets, rotation, friction, and bounce. Rotated-prop prediction/contact tests and `node test/props-browser.mjs` cover the dummy, drag placement, collision edits, undo, JSON round trips, compact layouts, and React platforms. Dynamic props remain deferred.

Browser and Studio simulation now runs in a dedicated worker with one in-flight batch, bounded commands, capped catch-up, and lifecycle cleanup. Static-obstacle routing uses cancellable incremental A*; locomotion and moving-avatar avoidance remain deferred. See `performance.md` and `npm run test:performance` for measured limits.

Director adds reusable scenes, hard-cut shot sequencing, camera and actor placement tracks, per-shot poses, seeded procedural layers and rotation baking, plus local reference images/video-frame capture. Episode sampling is deterministic and runs in a dedicated worker. Automated footage-to-assets reconstruction, algorithm fitting, dialogue/audio tracks, batch extraction, physics baking, and encoded episode export remain future work. See `director.md`.

Director's **Perform** panel records local webcam acting into constrained head/arm/wrist rotations and stepped facial expression keys. Takes can be reviewed, saved, reopened and applied with undo. Vision inference and take baking run in separate workers from the UI. No microphone, video retention, full-body capture, finger animation, continuous face mesh deformation or automatic lip sync is included. See [webcam capture](capture.md).

The [demo gallery](demos.md) now provides three multi-shot episodes and three interactive scenes with two to four characters. It includes a WWW studio scene, stage/backstage choreography, park acting, comparative dummy physics, floating rigs and independent expressions. Gallery copies use separate editor storage. Thumbnails are static and only one demo worker runs at a time. Music synchronization, movie encoding and inter-character collisions remain outside these demos.
