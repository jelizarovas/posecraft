# Vision assets

Pinned MediaPipe Tasks Vision 1.0.1. JavaScript and WASM are copied without modification from the Apache-2.0 npm distribution. Copyright The MediaPipe Authors. See [Apache 2.0 notice](../notices/mediapipe-Apache-2.0.txt). Posecraft code remains MIT.

Official task bundles, float16 version 1:

- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

These are the model bundles linked by the MediaPipe face/hand guides, not artwork generated or owned by Posecraft. The SDK and MediaPipe repository publish Apache-2.0 notices; the task archives do not include separate license files. Retain this provenance when redistributing.

Files are served from the same origin and loaded only when camera tracking is enabled. No CDN is contacted at runtime. The SDK telemetry fetch is blocked by the vision worker.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| face_landmarker.task | 3758596 | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |
| hand_landmarker.task | 7819105 | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` |
| vision_wasm_module_internal.js | 323415 | `da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d` |
| vision_wasm_module_internal.wasm | 11756972 | `2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b` |
