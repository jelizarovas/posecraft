# Bottle liquid scenes

The ship-in-a-bottle example is a live scene. Dragging or rotating its bottle changes the liquid surface and the ship's motion; wind changes the sails. Its authored `calm`, `breeze`, and `gust` clips remain available for editing and explicit clip preview. Previewing the vessel or contents temporarily suspends the live overlay so the original joints and keys can be inspected.

## Saved setup

`scene.fluid` stores the bottle model: `vessel` and `contents` actor IDs, the bottle-local `pivot`, a simple closed interior `boundary`, `fill`, `damping`, `wind`, and the ship's root `joint`, `scale`, and `mass`. The scene declares `bottle-fluid` in `requiredFeatures`. The example samples the same curved outline used by its glass clip, including the narrow neck. Fill is a fraction of this two-dimensional interior area.

The ship art remains at its authored size in the pack. During live playback the SVG renderer scales only descendants of the ship joint about its evaluated pivot. It does not scale the bottle mask or the water boundary. The glass and contents actors share the bottle's evaluated placement; the stand and chart room stay in place.

## Rendering and replay

The fluid controller emits evaluated `frame.fluid` data. Its `paths` replace the existing water parts in bottle-local coordinates, `hidden` suppresses painted scenery, and `ship` identifies the scaled subtree. `mountSVG` updates existing nodes rather than rebuilding the scene. Removing the overlay restores authored paths, visibility, ship size, and actor placement. `renderSVG` uses the same overlay for a still export.

The original sun, clouds and island belong to the authored miniature-sea preview. Live liquid hides them, along with fixed foam, so they cannot rotate as a painted water surface. Slosh can add small subsurface glints. The glass mask still clips the liquid and ship at every angle.

## Approximation and limits

This is a bounded two-dimensional animation model, not a computational fluid dynamics solver. A clipped gravity-facing half-plane conserves the configured interior area. Damped surface tilt represents slosh; ship buoyancy, drag and sampled hull/mast contacts keep the model responsive. The model does not calculate breaking waves, splashes, foam, liquid viscosity, three-dimensional volume, refraction, or stresses in the glass.

The cork is sealed: water cannot spill out. The sampled polygon approximates the curved glass, and ship contact uses a small set of points rather than continuous collision against every decorative line. Narrow-neck contact or extreme rotation can constrain the ship away from its preferred floating position. Translucent fills suggest water and glass without physically accurate reflections.

The fluid configuration is saved with the scene; the evaluated paths and poses are playback output rather than new animation keys. A website export needs a runtime that declares the `bottle-fluid` capability.

## Controls and Studio

Grab the bottle with one finger or a mouse. Its weight rotates it around the grip. A second touch controls the angle; lifting one finger releases that orientation constraint without a jump. Shift-drag provides a second grip with a mouse. Releasing the bottle lets it settle back onto its stand. The arrow keys nudge a focused bottle. The gallery's More room control zooms out before handling, giving a hanging bottle more space without changing its physics. Wind can be reversed with the slider, and No wind makes the sails slack.

In Studio, open **Scene → Behaviors & interactions → Water** to edit fill, damping, wind, ship mass and ship size. These values use the ordinary save, undo and redo controls. The Scene workspace enables bottle handling; the Character workspace keeps body-part authoring available. Website exports include the fluid settings and gesture adapter. The compiler includes the lightweight fluid module without Planck when no actor requires rigid-body physics.

**Enable phone** explicitly requests motion access. Device acceleration drives inertia, gyroscope rate drives angular movement, and gravity readings preserve steady tilt. Portrait and landscape readings are converted into scene coordinates. Stale acceleration decays; disabling motion or hiding the page removes the sensor listener. If access is denied or readings never arrive, dragging and Swirl water remain available. Sensor handling is tested with synthetic readings; hardware/browser behavior still depends on the phone. See the [DeviceMotion permission API](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static) and [acceleration including gravity](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/accelerationIncludingGravity).

For embedding, the player exposes `fluidInput(command)`, `enableMotion()` and `disableMotion()`. Call `enableMotion()` directly from a user click. The bottle adapter emits a `posecraft-motion` event from its host with `detail.enabled` and `detail.message`, so embedding sites can update their own controls after denial or a sensor timeout. Exports provide a button for this permission step.
