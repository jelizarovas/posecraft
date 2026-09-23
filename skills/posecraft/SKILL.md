---
name: posecraft
description: Author or edit Posecraft scene documents and integrate their playback using this repository's SDK and CLI.
---

# Posecraft

Choose the guide for the document and runtime involved. The 2D scene, native 3D and map APIs have different schemas and coordinate contracts; support in one does not imply support in another. Read only relevant guides.

| Task | Reference |
| --- | --- |
| 2D scene fields, transactions, browser or React embedding | [API](../../docs/api.md); [Ona example](../../examples/characters/ona.json) |
| Hand/foot contacts, carried or shared props | [Contacts](../../docs/contacts.md), [attachments](../../docs/attachments.md), [shared objects](../../docs/shared-objects.md) |
| Actions, independent actor routines or physical reactions | [Actions](../../docs/actions.md), [actor behaviors](../../docs/actor-behaviors.md), [reactions](../../docs/reactions.md) |
| 2D turns, deformation or lighting | [Spatial rigs](../../docs/spatial.md), [skinned meshes](../../docs/skinned-mesh.md), [lighting](../../docs/lighting.md) |
| Sequences, camera shots or webcam takes | [Director](../../docs/director.md), [capture](../../docs/capture.md) |
| Native 3D rigs and equipment actions | [Native 3D](../../docs/native-3d.md), [native Studio](../../docs/native-studio.md), [workout](../../docs/workout.md) |
| Game interactions or isometric maps | [Game API](../../docs/game-api.md), [map SDK](../../docs/map.md), [map editor](../../docs/map-editor.md) |
| Demo documents or worker integration | [Demos](../../docs/demos.md), [performance](../../docs/performance.md) |

For 2D document edits, use `DocumentStore.transact` or `posecraft edit`. Transactions carry `expectedRevision`; a conflict requires rereading the document. Studio and agents share validation and commands. Select declared character inputs rather than inventing fields. Keep asset provenance and licenses with source artwork.

The repository CLI exposes `capabilities`, `inspect`, `validate`, `preview` and `simulate` through `node tools/cli.mjs`. Use the commands relevant to the edit; these are not a mandatory sequence or a capability inventory for the native and map APIs. Director has separate episode commands documented in its guide.

Use the selected API's schema and affected runtime code to resolve stale documentation or unsupported fields. Preserve the distinction between authored poses, contact constraints and physical simulation when describing results.
