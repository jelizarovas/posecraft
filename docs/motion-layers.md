# Additive motion layers

`motionLayers` adds small continuous movement to an authored pose before contact constraints are solved. Studio → Scene → Motion & website edits the actor, joint, channel, sine/noise waveform, amplitude, frequency, phase and seed. A numeric scene variable can control strength over an increasing range, and the data API can restrict a layer to selected clips.

Declare `motion-layers`. A scene supports up to 64 layers. Frequency is 0.05–12 Hz; amplitude is 0–30 scene units/degrees, or 0–1 for bend. Noise interpolates seeded samples smoothly. Time sampling is deterministic and poses remain within rig constraints. Studio pose previews and physical/recovering actors bypass these additions. Paused/reduced-motion scenes remain still; an explicit seek can inspect a requested sample.

Gym now uses a small torso breathing layer and fatigue-dependent effort noise. Existing asymmetric rep timing, rest/recovery, constrained grips, connected skin and corrective deformation remain in the shared rig/action data. These small layers do not replace anatomy or create a general muscle simulation. Edit mesh corrective shapes in the Surface tools and contacts in Contacts & grips.

The lightweight compiler selects the motion-layer provider when used. `test/motion-layers.test.js` verifies repeatability, clamping and preview exclusion. The real Gym export browser check verifies full/lightweight pose agreement with no Planck dependency.
