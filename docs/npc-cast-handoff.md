# NPC cast handoff, September 23, 2026

Branch: `codex/npc-cast-handoff`. This is a recoverable work-in-progress snapshot, not a release or visual acceptance. Main retains the documentation commit `4fa11c9`; pushing this branch does not trigger the main-only Pages deployment.

## Resume on another computer

Fetch origin and switch to `codex/npc-cast-handoff`, then run `npm ci` and `npm run dev:map`. The script serves `play.html` at port 5246 on all host interfaces. Use the new computer's LAN address from a phone on the same network, with its firewall allowing the dev server. The previous computer's LAN address is not portable.

Git includes the prototype runtime, generated atlas files, reference images, briefs and baking source. It excludes node_modules, dist, temporary files and test-results. Browser localStorage/sessionStorage maps, drafts and settings are not in Git: export any wanted map JSON on the original computer and import it on the new one. Reinstall dependencies rather than copying node_modules. The browser tool uses installed Edge on Windows; other platforms need Playwright Chromium installed.

## Included work

- `src/map-cast.js`: catalog/action mapping for Mara, Bram, Pip, a ewe, a cow and a hen; multiple livestock IDs share species artwork.
- `src/map-npc-renderer.js`: atlas loading, drawing and bounds, with fallback to previous NPC artwork.
- `examples/map-play.js` and `examples/village-cast.js`: cast selection and prototype bindings.
- `tools/cast-definitions.mjs` and `tools/bake-map-cast.mjs`: procedural Three.js models/animation and deterministic directional baking. These are the model source for this snapshot; authored Blender or GLB source assets are not supplied by this work.
- `art-source/littlelands/`: design reference images, briefs, prompt metadata and preview sheets.
- `public/assets/map/npcs/` and `public/assets/map/animals/`: six manifests and 30 action atlases, each in PNG and WebP.

## Verified for this save

- `npm run test:map`: 132 passing tests.
- `npm run build`: passed, with a large-chunk warning.
- `node tools/verify-authentic-cast-browser.mjs`: completed on Windows Edge and reported no page errors. Captured seven screenshots under ignored test-results/authentic-cast. It is a smoke/capture tool, not proof of visual acceptance, asset completeness or mobile performance.
- Runtime asset paths in the cast catalog were checked against the saved files.

The local image inspection tool failed with a sandbox helper error during this save. Screenshots were produced, but this handoff does not claim a fresh visual approval. No physical-phone performance review was performed.

## Known limitations and next review

- This is six prototype designs with five action clips each, not the full roster/action coverage in the production brief. The models use simple procedural shapes; their quality against the painted village style remains unaccepted.
- Existing comments call the cast authentic and prompt metadata includes approved_candidate. Those labels are inherited prototype metadata, not evidence that the user approved the finished designs.
- The renderer can select catalog artwork by stock actor ID even without an explicit authentic flag. Check custom maps, saved drafts, gallery/editor parity and fallback bounds before release.
- Action aliases reuse clips, including walking for running and grazing for drinking. They do not establish distinct requested behavior or correct interaction contacts. Review child play, tools, turning, foot contacts and interruptions in motion.
- The image cache has no byte budget or LOD/eviction policy beyond disposal. It loads outside the shared asset-ready path, so early fallback changes and loading transitions need review. The current atlas format can exceed the production brief's proposed 2048-pixel page size.
- PNG plus WebP exports and source reference images are retained for this transfer. Separate source-only files and runtime derivatives before release packaging; measure decoded memory with the intended population.
- Check reference provenance, source continuity, visual identity and the production brief before claiming this implements the requested final asset pipeline. Preserve useful experiments without treating placeholders as finished.

Continue with the requested scope and the quality contract. Fixing these limitations is follow-up work; saving this branch does not publish or approve them.
