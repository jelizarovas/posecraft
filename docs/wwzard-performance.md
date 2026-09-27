# Wwzard illustration performance check

Measured September 26, 2026 with separate close/open commands and persistent closed-laptop idles for all three moods. This is a local desktop checkpoint. It does not establish physical-phone performance or deployment.

| Budget or check | Target | Measured result |
| --- | ---: | ---: |
| Editable scene JSON | <=128 KiB | 126,587 bytes |
| Runtime and embedded HTML, summed gzip | <=100 KiB | 92,252 bytes |
| Saved vector parts | <=250 | 121 |
| Three live embeds, host p95 frame gap | <=25 ms | 16.9 ms |
| Three closed-idle moods, host p95 frame gap | <=25 ms | 16.8 ms |
| Gaps over 25 ms, each three-embed sample | Record | 0 of 120 |
| Hidden/offscreen advancement over 350 ms | <=25 ms | 0 ms |
| First observed resumed scene time | No catch-up jump | 0.100 s |

The editable-source cap is now 128 KiB to accommodate twelve new close, open, idle and pause clips, plus their contour poses. It retains the three older combined laptop clips for compatibility. The compressed website budget remains 100 KiB. The generated scene has 33 hero clips and uses the same runtime modules as before this change.

The transfer estimate sums 68,102 gzip bytes of emitted runtime and 24,150 gzip bytes of HTML containing the scene JSON after adding independent sleeve-retraction layers. This is an artifact estimate, not a network waterfall. Compilation selected one illustration runtime file; neither the module list nor the browser request trace contained physics or 3D modules. There are 96 authored linear gradients and 855 SVG descendants per embed. Three embeds used 288 unique gradient IDs and made 2,586 page nodes. Browser-reported whole-page JavaScript heap was 24.4 MiB. The artwork has no decoded raster allocation; GPU memory and per-embed CPU memory were not measured.

The test ran headless Microsoft Edge 154 on Windows x64, Node 22.23.2, on a 12th Gen Intel Core i7-1265U. Renderer: SVG with authored gradients and scene lighting disabled. Desktop viewport: 1200 by 800. Each sample contains 120 animation-frame intervals after warmup. Baseline and one-embed p95 were 16.8 ms. Three live embeds measured p95 and p99 16.9 ms. A separate sample after closing the three laptops, one in each mood, measured p95 16.8 ms and p99 16.9 ms. Frame gaps measure host scheduling, not execution time inside each frame or sustained thermal behavior.

The host check also exercised surrounding-page input, scrolling, hidden/offscreen suspension, resume and disposal. At an emulated 390 by 844 viewport, the illustration was 350 by 350 without horizontal overflow. Emulated reduced motion kept time at zero while visitor input updated saved memory and manual pose preview remained available. Compiled website playback and Studio project reopening/export passed. The Studio check preserves the paired clips and selected mood, edits and reopens an intermediate hinge contour, and inserts the character into a second scene.

Live browser playback covered all three close-to-idle-to-pause-to-open sequences. None reopened without an explicit command. Disappointed and Angry closed idles completed at quarter speed, taking 51.2 and 43.2 seconds respectively, with paired hero/screen times and no page errors. Visual review inspected the supported hands, angry elbow, window glance, sigh and return poses. It caught and corrected the lid rim crossing supported forearms. The rim now follows the shared animated depth channel, below the arms on the flat cover and above the gripping fingertips while upright.

After adding sleeve retraction layers, SVG and Canvas pixel checks cover 132 poses, 8,834 occluded hand/lid samples and 9,681 visible supported-arm samples. The full robe continues behind the furniture. Tucked-hand checks use 317 interior samples, all exposed by removing only the depth offset. Normal elbow continuity has 4,128 probes; Angry's contact patch has 558. Layer and contour checks cover all saved clips. These establish rendering and continuity invariants; artistic approval is separate. Artifact size, desktop frame delivery and memory were remeasured for this change. They are not physical-phone measurements.

Cold network startup, long tasks, GPU memory, physical-phone playback and sustained battery/thermal cost remain unmeasured. A visible settled scene still uses the shared frame scheduler. The final consumer pages need their own integration checks.

Run the Wwzard unit tests, `node test/wwzard-occlusion-browser.mjs`, `node test/wwzard-illustration-browser.mjs`, and `node test/wwzard-studio-browser.mjs`. The Studio test defaults to port 5178; set `POSECRAFT_URL` for another local Vite server. Detailed measurements are written to `test-results/wwzard-export-budget.json` and `test-results/wwzard-browser-performance.json`.


## Immediate interruption checkpoint

After adding shared action interruption, the editable scene is 128,493 bytes. The compiled runtime is 69,103 gzip bytes and embedded HTML 24,367, totaling 93,470 bytes within the existing 100 KiB budget. On the same desktop Edge/SVG setup, three embeds measured p95 16.8 ms; three closed-idle moods measured p95 16.9 ms, with zero gaps over 25 ms in each 120-frame sample. Whole-page heap was 19,754,351 bytes. Offscreen advancement was zero and the first observed resumed scene time was 0.108 seconds. These are a new short desktop sample, not proof of a memory improvement or phone performance. Live command/reversal, host input/scroll, reduced-motion, compiled playback, and Studio interruption-edit/save/reopen/export checks passed. Captured blend paths are released after the 0.25-second transition.

The September 27 window and viewer-facing greeting add an independent masked sky actor and saved arm contours. The editable-source allowance increases from 128 to 132 KiB to accommodate these drawings and tracks. The compiled website limit stays at 100 KiB gzip, and each portfolio scene retains its 30 KiB gzip limit. This source-size allowance is not a decoded-memory measurement.

## September 27 day/night checkpoint

On the same desktop, headless Edge/SVG with two 300 px Home/Contact illustrations, complete host-transition updates measured p95 7.2 ms in daylight and 7.6 ms at night, against the declared 12 ms budget. This excludes browser paint. Six warmed real portfolio route transitions measured p95 frame intervals of 16.9 ms in both modes. Night had 2 of 296 intervals over 25 ms and one 52 ms long task; day had 3 of 296 intervals over 25 ms and no long tasks. These short samples do not prove phone performance. Reports: `test-results/host-transition-cost*.json` and `test-results/route-performance/{day,night}-theme.json`.

The installed alpha.1 base-scene consumer totals 99,392 gzip bytes and passes the 100 KiB contract. The richer portfolio Home entry totals approximately 108,460 gzip bytes across its emitted runtime, common animation, selected optional provider and scene chunks, about 106 KiB. That is above the original 100 KiB playback target. Contact is about 99.5 KiB; shared modules are cached across routes. These are summed build artifacts, not measured cold network startup, and exclude site React/CSS/fonts and theme code in the host bundle. Each raw exported scene remains under its separate 30 KiB gzip allowance.

Night shading uses the existing vector paths and gradient stops, with no decoded raster assets or filters. Per-embed CPU/GPU allocation, physical-phone frame time and battery cost remain unmeasured. Package checks exercised suspension/resume, reduced motion, multiple embeds and disposal. Website checks exercised system/saved preference, repeated window toggles, preserved Contact inputs, page-transition leases and 320 px layout.

Alpha.2 reflected-color and keyboard-emission correction: two 300 px SVG embeds measured p95 6.7 ms and max 8.7 ms for complete host-transition updates on the same desktop setup, within 12 ms. The revised Contact keeps 156 paths, adds no filters/raster assets, and matches Canvas colors. Studio emission editing, save/reopen and website export pass. This does not add physical-phone evidence.

Alpha.3 displayed-contour lighting correction: two 300 px Home/Contact SVG embeds on the host desktop in headless Edge measured night host-transition work at p95 9.8 ms, max 14 ms, average 5.79 ms, against 12 ms p95. This includes updating deformed material bounds and excludes browser paint. It is not a speedup claim or physical-phone evidence. Material browser checks confirmed SVG/Canvas parity, no filters and Studio material save/reopen.

Alpha.4 focus weighting: the same two 300 px Home/Contact SVG host-transition check in headless desktop Edge measured night p95 7.3 ms and max 9 ms, below the 12 ms p95 budget. This short run excludes browser paint and is not a physical-phone result or a claimed speedup over alpha.3. The standalone package consumer retained its 100 KiB base-scene contract.
