# Posecraft Product and Engineering Requirements

Version 0.1 product brief | September 17, 2026. Guidance clarified September 23, 2026.

This document records product requirements and initial proposals, not an implementation inventory. Use the [roadmap](docs/studio-roadmap.md) and task-specific API guides for reported implementation status; verify the affected code when changing behavior. Later explicit decisions supersede initial defaults.

## 1 Purpose and instructions for Codex

We are building Posecraft, a free alternative to Rive for creating and embedding interactive animated scenes. The product includes npm packages, a visual studio, a React integration, and interfaces that let AI agents author and inspect the same projects as human users.

The defining behavior is that a scene can respond to its surroundings. Moving or stopping a modal should affect the characters and objects inside it. Characters can plant their feet, brace, stumble, protect themselves, fall into ragdoll, and recover. Water and floating objects can respond to the same environment. A ship floating inside a bottle is a required showcase.

Use this document as the product brief when implementation is requested. Preserve the full requirements across milestones. A milestone can ship a defined subset; it must identify remaining requirements explicitly.

For a scoped change, inspect the affected implementation and relevant contracts. For a new subsystem or milestone, map the relevant requirements to existing capabilities, identify gaps and record consequential architecture decisions. Extend suitable existing work. This does not require a repository-wide review or a new plan for every edit.

Do not describe unimplemented behavior as working. Proposed API examples and package names in this document are design sketches, not existing interfaces or verified available npm names.

## 2 Confirmed scope and working assumptions

### Confirmed product requirements

- Free animation authoring and runtime capabilities through npm packages and a studio.
- Reusable avatars, scenes, and props.
- Timelines, animation states, transitions, and physics-based animation.
- React integration driven by application props and the host container's dimensions and motion.
- Inertial reactions such as leaning, lagging, compression, and settling when a moving container stops.
- Foot friction, adjustable plantedness, stumbling, protective reactions, and ragdoll physics.
- Support for cute characters with short legs, bipeds, and quadrupeds such as dogs and horses.
- Some fluid simulation, including a ship-in-a-bottle demo.
- AI agents must be able to use Posecraft to create, edit, and inspect work.

### Initial proposals and later decisions

These are starting decisions, not previously confirmed user constraints. Use them unless existing project decisions or new user instructions supersede them. The detailed requirements below are a proposed engineering contract derived from the confirmed scope. Explicitly optional extensions are not release gates for the baseline feature.

- Historical starting scope: 2D scenes and articulated 2D characters. The later [native 3D direction](docs/engine-quality-reset.md#architecture-contract) adds world-space rigs and contacts while preserving the separate 2D format. The original starting scope is not a restriction on current native 3D or map work.
- Prefer TypeScript for the public SDK and React integration. Select the simulation and rendering implementations after inspecting existing work and testing a small representative scene.
- Make essential editing, local saving, exporting, and embedded playback work without a required hosted service or paid API.
- Use a versioned, inspectable document format with assets stored alongside it. A compact compiled runtime format can be added later.
- Treat the milestone order below as a proposed delivery sequence. Advanced character behavior and fluid support remain product requirements even when delivered after the initial MVP.
- Keep physics, character control, and fluids optional dependencies for consumers who do not use them.

Confirmed decision: Posecraft uses [MIT](LICENSE), as chosen by the user. Preserve dependency and asset license notices and check compatibility for additions. Public npm namespaces, hosted backends and pricing are separate decisions.

The original MVP scope did not require full Rive feature parity, Rive file compatibility, true 3D, arbitrary creature motion generation, multiplayer collaboration, a marketplace, or learned locomotion models. That historical MVP boundary does not cancel later requested milestones.

## 3 Product outcomes

A designer can assemble and animate a character, define interactive behavior, test it in the studio, and export a portable project.

A React developer can embed that project, change typed inputs, receive events, and connect it to a moving and resizing UI container.

An AI agent can inspect the document, apply structured edits, validate it, run a repeatable scenario, inspect rendered frames and diagnostics, and revise its work.

A scene author can tune the physical personality of a character or prop without manually implementing a physics solver. They can choose a gentle, exaggerated, heavy, springy, or clumsy response while retaining control over appearance and intended animation.

## 4 Architecture and shared contracts

Use clear module boundaries. Separate packages are recommended where they improve dependency size and reuse; they are not a reason to replace a suitable existing project structure.

| Module | Responsibility |
| --- | --- |
| Document and schema | Versioned scene data, validation, migrations, asset references, and public input definitions. |
| Editing commands | Shared document operations, transactions, undo, redo, and revision checks. |
| Core runtime | Scene evaluation, timeline playback, state machines, animation composition, and the simulation clock. |
| Rendering | Draws evaluated scene data and performs picking through a defined backend interface. |
| Physics | Bodies, contacts, materials, joints, constraints, and motion integration. |
| Character control | Rig profiles, foot placement, gait, balance, protective behavior, ragdoll, and recovery. |
| Fluids | Water representation, containment, forces, and interaction with rigid objects. |
| React and browser integration | Component lifecycle, inputs, events, size observation, and host motion adapters. |
| Studio | Visual authoring, preview controls, debugging, save, import, and export. |
| Agent interfaces | Programmatic inspection, editing, validation, simulation, rendering, and diagnostics. |

**ARC-01 Shared engine.** Studio preview, embedded playback, and automated previews must use the same runtime behavior and document semantics. A studio-only approximation cannot satisfy runtime requirements.

**ARC-02 Shared authoring.** Human editing and agent editing must invoke the same validated command layer. Operations must support atomic transactions and undo. Reject stale revisions with a useful conflict response instead of silently overwriting concurrent edits.

**ARC-03 Independent runtime.** Core scene evaluation must work without mounting React or opening the studio. Browser-specific behavior belongs in adapters. Headless simulation must be possible; rendered previews may use a browser renderer when required.

**ARC-04 Runtime state separation.** Separate persistent authoring data from transient playback, contact, and solver state. Saving a project must not accidentally persist DOM references, renderer objects, or incidental simulation state.

**ARC-05 Explicit ownership.** Each animated or simulated channel must have a documented authority and composition rule. Authored animation can provide pose targets to physical joints. It must not independently teleport the same dynamic bodies while the solver is controlling them. Intentional teleports and resets require explicit operations.

**ARC-06 Optional capabilities.** Importing the basic renderer must not load the studio, agent tooling, or unused physics and fluid solvers. Unsupported optional features must produce a clear capability report.

## 5 Documents and reusable assets

**DOC-01 Portable document.** Define a schema version, stable identifiers, scenes and entry points, reusable asset definitions and instances, transforms, visual resources, rigs, timelines, state graphs, physics settings, environment bindings, public inputs, and events. A readable JSON-based format is the proposed initial choice.

**DOC-02 Reuse.** Avatars and props can appear in multiple scenes with independent runtime state and documented per-instance overrides. Updating a definition must have predictable effects on its instances.

**DOC-03 Meaningful structure.** Objects have editable names and semantic roles in addition to stable IDs. Agents and tools can discover what an object does without relying on its screen position.

**DOC-04 Validation and migration.** Validate types, references, graph structure, finite numeric values, and supported feature versions. Report errors with object IDs and field paths. Provide explicit migrations when the format changes. Preserve extension data where safe; fail clearly when an unsupported feature is required for correct playback.

**DOC-05 Units and coordinates.** Define time units, angle units, axis directions, scene scale, and the mapping between CSS pixels and simulation distance. Device pixel ratio changes rendering resolution and must not silently change mass, gravity, or simulated speed.

**DOC-06 Export and assets.** Exported documents include or reference all necessary assets with a documented resolution strategy. Reopening an exported project preserves editable behavior. Report missing assets. The first implementation should support a deliberate subset of vector shapes and images; SVG import must declare supported features and report unsupported content.

**DOC-07 Size behavior.** Separate fitting a scene into a container from resizing its physical world. Authors choose a documented policy for scale, crop, or world reflow. A container resize must not unexpectedly multiply gravity or launch objects.

## 6 Scenes and rendering

**REN-01 Scene composition.** Support nested transforms, groups, draw order, visibility, opacity, shapes or paths, image assets, and reusable scene instances. Provide the masks or clipping needed for the bottle presentation.

**REN-02 Rigged visuals.** Render articulated characters and props from evaluated rig transforms. Begin with attached shapes and sprites if appropriate; mesh deformation is an extension unless the existing implementation already supports it.

**REN-03 Interaction.** Provide hit testing and a consistent mapping from pointer coordinates into scene coordinates. Pointer events can trigger state changes or author-defined interactions.

**REN-04 Presentation and simulation separation.** Visual outlines, deformation, and transparent bottle rendering may differ from collision geometry. Debug views must make the physical geometry visible.

**REN-05 Backend choice.** Select one initial rendering backend based on required visuals and measured behavior. Preserve a clean interface for future backends. Do not implement multiple backends merely to demonstrate abstraction.

## 7 Timelines and interactive behavior

**ANM-01 Timelines.** Support keyframes, easing, duration, playback speed, looping, pause, resume, and scrubbing. Include transforms, opacity, rig pose targets, and appropriate exposed numeric properties.

**ANM-02 State machines.** Support named states, typed inputs, triggers, conditions, timed transitions, transition blending, and explicit interruption rules. Validate unreachable or conflicting conditions where practical and expose the currently active states for debugging.

**ANM-03 Composition.** Allow an idle or wave animation to continue while balance and secondary motion affect the relevant parts of the body. Define channel masks, priorities, blend rules, and constraint ordering. Preserve facial or expressive animation during suitable physical reactions.

**ANM-04 Physics and time.** Use a fixed simulation step with bounded substeps and a documented policy for long frame gaps. Rendering cadence must not directly change the simulated outcome.

**ANM-05 Seeking and replay.** Seeking into physical animation must restore a checkpoint and replay inputs, or resimulate from the initial state. Changing only a timeline timestamp is insufficient. Avoid emitting duplicate application events during preview reconstruction.

**ANM-06 Repeatability.** Record the document version, engine version, seed, initial state, and timestamped external inputs for reproducible scenarios. Verify repeatability within documented tolerances on the same supported runtime. Do not claim bitwise equivalence across all devices or rendering backends.

## 8 React integration and environmental motion

**REA-01 Declarative embedding.** Provide a React component that accepts a scene or scene source, typed public inputs, layout settings, motion settings, and event callbacks. Define loading and error states and imperative controls for play, pause, reset, and input triggers where useful.

**REA-02 Container size.** Observe relevant container dimensions automatically, with explicit dimensions available for controlled environments and testing. Distinguish layout size from transformed visual bounds.

**REA-03 Motion sources.** Prefer timestamped transforms or motion signals from the application animation or dragging system. Provide a documented DOM observation fallback for supported translation cases. Define the coordinate space and units for every motion source.

**REA-04 Available signals.** Expose host transform, linear velocity and acceleration, and supported angular motion. Expose pointer position and reduced-motion preference through the same environment contract. The engine derives missing values only where reliable and identifies the limitations of a fallback adapter.

**REA-05 Physical response.** Acceleration causes relative lag; braking can produce overshoot and settling. Constant velocity alone must not create a persistent inertial force. Vertical stopping can produce compression and rebound. Authors can limit response intensity and choose which objects participate.

**REA-06 Frame consistency.** Choose and document how physical motion is represented: for example, a moving boundary in a world frame, or a local frame with the corresponding inertial forces. Do not apply both representations of the same acceleration. Rotation support must account for the relevant rotating-frame effects or document a constrained operating range.

**REA-07 Stable measurement.** Establish a fresh baseline on mount, scene replacement, and resume. Handle scrolling, layout jumps, visibility changes, and intentional teleports through explicit policies. Smooth noisy derivatives without hiding the physical state. Measuring a reactive child must not feed its own motion back into the host signal.

**REA-08 React lifecycle.** Advance frame updates outside React render state. Avoid a React rerender for every simulation tick. Clean up observers, event handlers, animation loops, and resources on unmount; handle repeated mounting and disposal correctly.

**REA-09 Accessibility.** Respect reduced motion by default with an author-configurable reduced-motion presentation. Support descriptive alternatives and keyboard operation for relevant interactive content. Decorative scenes must not interfere with application focus or input.

**REA-10 Server-rendered applications.** Importing the React package must not require browser globals at module initialization. Initialize browser rendering after mounting and provide a predictable placeholder or fallback for server rendering.

Illustrative API only:

```tsx
<PosecraftEnvironment
  containerRef={modalRef}
  motion={modalMotion}
  reducedMotion="system"
>
  <Posecraft
    scene={assistantScene}
    inputs={{ mood: "curious", loading: isLoading, progress }}
    onEvent={handleSceneEvent}
  />
</PosecraftEnvironment>
```

The final API may differ. Its required outcomes are typed application inputs, automatic size integration, a reliable motion bridge, runtime events, and predictable lifecycle behavior.

## 9 Physical bodies and contact

**PHY-01 Bodies and materials.** Support static, kinematic, and dynamic bodies; collision geometry; mass and inertia; friction; restitution; damping; joint limits; and bounded joint forces or torques.

**PHY-02 Contact state.** Make contact points, normals, support identity, and useful force or impulse information available to character controllers and debugging tools. Contact must be distinguishable from visual overlap.

**PHY-03 Moving supports.** Feet and attached props must be able to reference a moving support surface. Store contact targets in a suitable support-local frame. A planted foot on a moving deck should follow that deck until it slips or deliberately lifts.

**PHY-04 Predictable limits.** Provide bounded response strengths, solver limits, and a recovery policy for extreme inputs. A large drag or tab-resume gap must not create non-finite transforms or permanently corrupt the scene.

**PHY-05 Attachments.** Explicit grips, anchors, and release conditions are separate from ordinary surface friction. A hand holding a mast can have a constrained grip with a force limit and release behavior.

**PHY-06 Shared timing.** Rigid bodies, characters, and fluid interaction must agree on units, coordinate transforms, and simulation timing, even if implemented by separate modules. Avoid counting the same force or support movement twice.

## 10 Character rigs and locomotion

**CHR-01 Rig profiles.** Support semantic body parts and capabilities: torso, head, support limbs, feet or paws, optional hands, and optional tail. Profiles define hierarchy, joint limits, body proportions, collision shapes, mass distribution, and available actions.

**CHR-02 Required character families.** The full product must demonstrate a short-legged cute biped, a more conventional biped, a dog-like quadruped, and a horse-like quadruped. They share infrastructure but can use different controllers, gait parameters, and recovery poses.

**CHR-03 Proportion-aware movement.** Respect limb reach and joint limits. Adapt step length, step frequency, body height, and foot lift to the rig. Support stylized waddling and hopping where appropriate. A shorter rig must not depend on stretching its legs beyond its configured limits to reuse another rig's motion.

**CHR-04 Gaits.** Provide configurable gait timing and footfall patterns. Begin with standing and walking; extend to character-appropriate running, trotting, galloping, or hopping in later character milestones. Describe supported gaits per profile rather than claiming every rig supports every movement.

**CHR-05 Planting and grip.** Track each support limb as airborne, planted, or sliding as applicable. Expose contact friction, stance effort, joint strength, mass distribution, and step thresholds separately. A friendly plantedness control can map to several underlying settings through a documented preset.

**CHR-06 Physical feel.** Body mass must not serve as an undocumented substitute for grip or active balance. Allow explicit tuning for heavy, springy, stiff, relaxed, or clumsy styles. Keep appearance and physical behavior independently configurable.

## 11 Balance stumbling and protective reactions

**BEH-01 Balance feedback.** Use the body's position and velocity relative to its supporting contacts, available footing, and configured strength to determine corrective actions. Include velocity when judging a developing fall; a static center-of-mass check alone is insufficient.

**BEH-02 Graduated response.** Support posture adjustment for small disturbances, a corrective step for larger disturbances, and falling when recovery fails. Use hysteresis or equivalent control so behavior does not flicker at thresholds.

**BEH-03 Protective behavior.** Where the rig has the required limbs and reachable surfaces, support bracing, reaching for support, and protective poses before predicted impact. Define sensing distance, reaction delay, priorities, and release conditions. A predicted collision or support loss must drive the reaction; a random animation does not satisfy this requirement.

**BEH-04 Active ragdoll.** Joint control can follow animation pose targets with bounded strength while contacts and impacts affect the body. Permit strength or control to vary by body region, including a gripping hand with freely swinging legs.

**BEH-05 Passive ragdoll.** Reduce or disable active pose control while preserving collisions, joint limits, and momentum. Enter and exit without snapping to an unrelated pose or resetting momentum unexpectedly.

**BEH-06 Recovery.** Detect sufficiently stable support, select a compatible recovery action, and blend toward standing or another supported posture. If the rig cannot recover from a position, expose that state and choose a defined fallback instead of looping indefinitely.

**BEH-07 Assisted behavior.** Stylized balance assistance and authored recovery poses are permitted and encouraged for the initial implementation. Any artificial support must be explicit and tunable. Do not represent it as a general physically accurate controller.

**BEH-08 Debugging.** Show support contacts, center of mass, velocity, intended foot placements, current reaction, and relevant strength limits. Make the same information available as structured diagnostics for agents.

## 12 Fluids and the ship in a bottle

**FLU-01 Required outcome.** Provide water that responds to bottle motion and physically influences a floating ship. Ship height, pitch, and settling must respond to simulated water interaction. A fixed bobbing animation alone does not meet this requirement.

**FLU-02 Deliberate simulation scope.** The baseline requirement is convincing contained water and ship response over a documented range of bottle movement and modest tilt. A surface-height model is acceptable within those limits. Vigorous shaking, detached splashes, and inversion are proposed advanced extensions that need a suitable free-surface method, such as particles. Preserve an upgrade path, but do not make those extensions a hidden prerequisite for the baseline demo or claim a simple single-height surface supports them.

**FLU-03 Containment.** Define collision boundaries for the bottle interior, including its neck and closed end. Rendering a clipping mask alone does not contain simulated water. Use a closed bottle for the initial showcase; pouring is not required.

**FLU-04 Buoyancy and drag.** Apply forces at distributed hull locations or through an equivalent physical coupling so uneven immersion can produce rotation. Ship mass, hull shape, damping, and fluid parameters should have understandable effects.

**FLU-05 Coupling.** Document whether an implementation stage has one-way water-to-ship forces or two-way interaction. One-way coupling can satisfy the baseline demo if ship motion responds to the simulated water. Two-way interaction is a recommended extension: water moves the ship, and the ship displaces or disturbs water. Do not add an extra buoyancy force if the chosen coupling already accounts for the same effect.

**FLU-06 Conservation and boundaries.** Track liquid quantity and boundary leakage using method-appropriate diagnostics. Set numeric tolerances with the chosen solver and reference scenario. Visual particle rendering must not conceal substantial physical loss.

**FLU-07 Quality settings.** Expose bounded quality settings such as resolution or particle count, solver iterations, and update limits. Record a scenario's quality settings so previews and performance comparisons are reproducible.

**FLU-08 Optional combined showcase.** After the ship-and-water behavior works, add a sailor who stands on the deck, balances, braces, grips a support, and can fall. The sailor is a recommended integration demo; the user-required bottle demo does not depend on completing it first.

**FLU-09 Module boundary.** Ship fluid simulation as an optional capability. Character-only scenes must not acquire fluid startup cost or downloads.

## 13 Studio requirements

**STU-01 Essential workspace.** Provide a scene viewport, scene hierarchy, properties inspector, asset selection, timeline, and a state-machine editing surface. Add rig and physics controls as their runtime features become available.

**STU-02 Editing.** Support selecting, creating, naming, transforming, duplicating, grouping, and deleting supported objects. Changes use the shared command system and support undo and redo.

**STU-03 Animation authoring.** Users can add and edit keyframes, inspect transitions, set input values, and preview behavior without changing source code. A minimal functional editor is sufficient for the MVP.

**STU-04 Environment preview.** Include controls for container size, translation, tilt where supported, acceleration, stopping, and repeatable motion scenarios. Expose the same public inputs used by embedded scenes.

**STU-05 Physical authoring.** Let authors configure supported bodies, contacts, joint limits, character profiles, grip, plantedness, balance, and fluid properties. Provide debug overlays for physical state and a reset action.

**STU-06 Persistence.** Support local save, load, import, and export with round-trip preservation. Provide recoverable handling of invalid documents and missing assets. A hosted account must not be required for the proposed local authoring workflow.

**STU-07 Feature honesty.** Controls must distinguish implemented features from unavailable capabilities. Decorative editor screens and nonfunctional buttons do not satisfy authoring requirements.

## 14 Agent access

**AGT-01 Structured access.** Provide a programmatic API that lets an external coding agent use Posecraft. Start with the shared SDK and a CLI. An MCP adapter is a recommended later transport over the same capabilities, not a separate editing engine.

**AGT-02 Discover and inspect.** Agents can retrieve schema and capability information, list scenes and assets, inspect objects and relationships, and read exposed inputs, timeline tracks, states, physical properties, and current diagnostics.

**AGT-03 Edit.** Agents can create or update supported scene objects, rigs, animation tracks, state transitions, parameters, and physics settings using validated transactions. Return stable IDs and the resulting revision. Support undo or rollback after a failed experiment.

**AGT-04 Evaluate.** Agents can validate a document, run a timestamped scenario, inspect events and diagnostics, and request rendered frames or a short preview sequence. Preview failures must include actionable errors.

**AGT-05 Test scenarios.** Agents can specify inputs over time, container motion, seed, duration, and sampling times. Examples include testing a loading transition while a modal brakes or evaluating foot slip during a ship's roll.

**AGT-06 Consistency.** An agent-created document must reopen as editable work in the studio and run through the public runtime. The same operation performed in the studio and through the API must have equivalent document semantics.

**AGT-07 Runtime autonomy.** Characters and scenes must operate locally from their controllers and authored state. An LLM call is not required for each animation frame or reflex. Agent-assisted authoring must work with external agents without requiring a proprietary paid model service built into Posecraft.

**AGT-08 Input boundaries.** Treat imported documents and agent arguments as data. Do not execute arbitrary JavaScript from a document by default. Validate asset references and supported operations. If scripting is added later, specify its execution model separately.

## 15 Required demonstration scenes

| Demo | Required visible result |
| --- | --- |
| Reactive modal | An avatar responds to horizontal acceleration, braking, vertical stopping, and container resizing. Idle or wave behavior remains usable. |
| Footing and balance | The same disturbance produces different results as grip and plantedness change. The avatar can lean, step, slip, fall, and recover within its supported cases. |
| Character family gallery | Short-legged biped, conventional biped, dog-like rig, and horse-like rig demonstrate their supported gait and contact behavior. |
| Ship in a bottle | Contained water reacts to bottle movement and influences ship translation and pitch within a documented operating range. Inversion and two-way interaction are proposed extensions. |
| Agent authoring | A repeatable agent workflow creates or modifies a scene, validates it, previews it, and opens the result in the studio. |

These demos must exercise the public runtime and authoring contracts. Demo-specific shortcuts that bypass those contracts do not prove the corresponding feature is implemented.

## 16 Performance quality and packaging

**QLT-01 Performance targets.** Treat approximately 60 frames per second for a representative simple interactive scene and a usable 30 frames per second for the more demanding fluid showcase as provisional goals, subject to a named reference device, browser, viewport, and scene configuration. Establish numeric simulation and rendering budgets during the relevant milestone and report measured results.

**QLT-02 Repeatable measurement.** Report frame time distribution, simulation time, draw time, startup time, memory, scene complexity, and quality settings for benchmark scenes. Measure package and transferred asset sizes separately. Avoid claims based only on an empty scene.

**QLT-03 Idle and hidden behavior.** Pause or reduce unnecessary work when scenes are hidden or inactive according to a documented policy. Resume without applying an accumulated wall-clock interval as one physical impulse.

**QLT-04 Resource lifecycle.** Multiple independent scene instances must work without shared mutable playback state or resource leaks. Reset, reload, mount, and unmount must dispose or reuse resources correctly.

**QLT-05 Distribution.** Provide documented npm entry points, TypeScript declarations, versioning, runnable examples, and a reproducible local build. Include public API usage, supported capabilities, browser limitations, and migration notes as applicable.

**QLT-06 Proven implementation choices.** Evaluate existing rendering and physics libraries against the actual requirements before writing replacement solvers. Record the chosen version, license implications, browser integration, package cost, and major limitations. Candidates in the references are research starting points, not predetermined dependencies.

**QLT-07 Release readiness.** Package naming, licensing, dependency attribution, and publication credentials must be resolved before a public release. Implementation and local package validation can proceed before publication is authorized.

## 17 Acceptance criteria

Attach each criterion to the milestone that delivers the relevant feature. A partial milestone must not mark the entire product complete. An optional extension is tested when implemented and does not block acceptance of the baseline capability.

| ID | Verification scenario | Passing behavior |
| --- | --- | --- |
| AC-01 | Save and reopen a scene with assets, timelines, inputs, and physical settings. | Stable references and authored behavior survive the round trip; missing capabilities are reported. |
| AC-02 | Perform an equivalent object edit through studio and agent commands, then undo it. | The edits have equivalent semantics and undo restores the prior authored state. |
| AC-03 | Play an idle or wave state while the host accelerates and brakes. | The state remains active while permitted body channels react physically; no competing transform writes. |
| AC-04 | Accelerate, maintain constant velocity, then stop the host. | Lag occurs during acceleration, no constant-velocity force remains, and braking produces a bounded settling response. |
| AC-05 | Resize, hide, resume, scroll, and remount the reactive scene. | Defined policies prevent spurious extreme impulses, duplicated loops, and stale observers. |
| AC-06 | Apply the same disturbance at different friction and stance settings. | Contact diagnostics explain the resulting plant, slide, or step behavior; tuning is not merely visual. |
| AC-07 | Stand a character on a moving support and then lift or slip a foot. | The foot tracks the appropriate support-local contact until contact is released or slides. |
| AC-08 | Apply a disturbance beyond posture correction but within the configured recovery range. | The character makes a valid corrective step within limb and joint limits. |
| AC-09 | Trigger a predicted fall with an available reachable support. | A suitable protective or gripping response starts before impact according to configured sensing and delay. |
| AC-10 | Transition from active control to ragdoll and attempt supported recovery. | Contacts and joint limits remain valid; transitions preserve continuity; failed recovery has a defined outcome. |
| AC-11 | Run configured gaits on the required character profiles. | Feet and paws follow profile-specific patterns without unexplained skating or out-of-range limb extension. |
| AC-12 | Move and tilt the bottle within its declared operating range; include inversion if that extension is implemented. | Liquid remains within the closed boundary within the recorded tolerance, redistributes, and influences ship motion. Unsupported motion is constrained or identified clearly. |
| AC-13 | If two-way coupling is implemented, disturb water with the ship and observe the reverse interaction. | Both ship and water respond without duplicate forces. A baseline one-way implementation is identified accurately. |
| AC-14 | Replay the same recorded input sequence and seek to an intermediate time. | Physical state and sampled frames agree within documented tolerances; replay does not duplicate application events. |
| AC-15 | An external agent creates or edits a project and requests a preview. | Validation, diagnostics, and rendered output are available, and the result remains editable in the studio. |
| AC-16 | Import only the basic runtime and renderer in a sample application. | Studio, agent tooling, and unused simulation modules are absent from the consumer's required runtime bundle. |
| AC-17 | Enable reduced motion and operate relevant controls by keyboard. | The configured reduced-motion presentation is used and application interaction remains accessible. |
| AC-18 | Benchmark representative demos on the named reference environment. | Actual measurements are reported against the agreed milestone budgets, with limitations documented. |

Use automated checks for schema integrity, state transitions, replay, commands, and numerical invariants. Use rendered inspection for motion quality, continuity, foot sliding, and visual artifacts. Tests must verify meaningful behavior; a mocked solver or a passing typecheck alone cannot prove physical animation works.

## 18 Proposed implementation milestones

### Milestone 0 Repository assessment and architecture

Inspect existing work. Map requirements to implemented capabilities. Choose the initial coordinate convention, document shape, renderer, simulation strategy, and package boundaries. Run a small technical experiment for container motion and pose control if necessary. Establish a traceable backlog and document assumptions.

Exit condition: a justified implementation plan and a small working technical foundation, with the largest unresolved risks identified. This milestone should lead directly into implementation when implementation has been requested.

### Milestone 1 Initial MVP

Deliver a portable document, shared editing commands, a working renderer, a basic rigged biped, simple timelines and two interactive states, React inputs and events, automatic sizing, and translation-driven inertial reactions. Include a minimal studio that can edit and export the supported scene, plus an agent SDK or CLI path that can inspect, edit, validate, and preview it.

Exit condition: the reactive modal demo works through the same runtime in the studio and a separate React consumer. The authored document round-trips and an agent can modify it. This is the MVP, not completion of all Posecraft requirements.

### Milestone 2 Physical character behavior

Add contact-aware foot planting, friction, adjustable stance effort, balance feedback, corrective steps, protective reactions, partial control, active and passive ragdoll, and defined recovery behavior for the initial biped.

Exit condition: the footing and balance demo passes its relevant acceptance criteria over a documented disturbance range.

### Milestone 3 Character families

Add proportion-aware short-legged movement, dog-like and horse-like rig profiles, suitable gait presets, and profile-specific reactions and recovery. Expand the studio controls needed to author and tune those behaviors.

Exit condition: the character gallery uses common infrastructure and demonstrates the documented capabilities of each family.

### Milestone 4 Fluids and bottle showcase

Deliver the fluid module as an optional runtime import, bottle containment, ship buoyancy and drag, and a convincing baseline response to container movement. Fluid support itself is required for the product. Evaluate the cost and value of particle-based splashes and inversion, two-way coupling, and the optional sailor integration after the baseline works. Record those extensions separately in the backlog.

Exit condition: the baseline bottle demo passes containment, motion response, replay, and performance checks within documented limits. Any implemented advanced extensions pass their corresponding checks.

### Milestone 5 Product readiness

Complete authoring workflows, documentation, examples, package ergonomics, benchmark reporting, lifecycle and accessibility checks, schema migration policy, and any needed agent transport such as MCP. Resolve release-specific naming and licensing decisions.

Exit condition: a new user can install, author, export, embed, and agent-edit supported content by following the documentation. Public publication follows the actual user authorization and project release process.

The milestones are delivery boundaries. Do not silently remove later functionality or bundle unfinished controls into an apparently complete product.

## 19 Implementation handoff expectations

For each milestone, provide the working changes, the requirements completed, the checks performed and their results, a runnable demonstration, and the remaining limitations. Record deviations from the brief with the reason and resulting behavior.

Maintain a concise requirements-to-implementation mapping. Prefer a small complete feature path over disconnected editor screens, runtime stubs, or fabricated physical effects. Keep the long-term document and runtime contracts compatible with the confirmed product scope.

Before selecting a dependency or relying on its current API, verify the relevant official documentation. Before changing architecture, inspect what already exists. Do not publish packages or create a hosted service merely because this document mentions npm and a studio.

## 20 Research references

These references informed the design discussion. They provide background and candidate techniques; they do not establish that a library already supplies Posecraft's complete behavior controller.

- [Box2D simulation documentation](https://box2d.org/documentation/md_simulation.html) covers rigid bodies, contact friction, joints, and force-limited motors.
- [SIMBICON research paper](https://www.cs.ubc.ca/~van/papers/2007-siggraph-simbicon.pdf) demonstrates pose control with balance feedback for simulated bipeds. It is a research reference, not a promise of general locomotion across every rig.
- [Ten Minute Physics tutorials](https://matthias-research.github.io/pages/tenMinutePhysics/index.html), particularly tutorials 18 and 20, provide fluid simulation examples and height-field water interaction with solid objects.
- [LiquidFun](https://google.github.io/liquidfun/) provides examples of particle fluids, rigid-object interaction, and sloshing in a moving container. Evaluate present maintenance and integration suitability before selecting it.
- [MDN ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) documents size observation.
- [MDN getBoundingClientRect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) documents viewport-relative bounds, which can support a limited translation-observation fallback.
- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) documents browser frame scheduling; simulation still needs its own explicit time policy.
