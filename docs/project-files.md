# Portable project files

Director's **Save portable project** button saves a `.posecraft.json` file containing the episode, its reusable scenes and rigs, shot/camera/pose/expression keys, applied webcam takes, and every reference image attached to its shots. Open that file on another device to restore the images as well as the animation. Original videos, unapplied camera recordings, audio and external fonts are not included.

**More file options → Export episode JSON** preserves the smaller `.episode.json` format. It contains reference names, IDs and source timestamps, but no image bytes. Opening an older episode with missing media reports the missing names. In the Reference panel, open the matching image to replace that shot's missing reference, or remove it. Portable saving refuses to silently omit missing or corrupt images.

The **Studio scene source** selector distinguishes Character Studio's usual scene from the separate Draw / Rig scene. Choose a source, then **Use Studio scene**. This creates a scene and shot in the current episode. It does not replace the other Studio draft.

## Validation and limits

Files use version 1 of the `posecraft-project` container. Each distinct reference is stored once as base64, with its MIME type, byte count and SHA-256 checksum. Only assets referenced by a shot are accepted. The enclosed episode still uses the existing episode schema; character artwork and applied performance keys stay in that document unchanged.

| Limit | Value |
| --- | --- |
| Portable file | 80 MB, decimal bytes |
| One reference image | 20 MB |
| All decoded reference images | 40 MB |
| Distinct reference images | 120 |
| Image dimensions | Up to 4096 × 4096 |
| Formats | PNG, JPEG, static WebP |
| Plain episode or scene JSON import | 20 MB |

The decoder checks image signatures and dimensions before allocating a bitmap. Director then verifies that the browser can decode every image. SVG, HTML, remote URLs, invalid base64, checksum mismatches, missing or duplicate assets, and unsupported container versions are rejected. SHA-256 detects changed bytes; it does not identify or authenticate an author.

All assets must validate before importing any media. A single IndexedDB transaction installs them under fresh IDs, so a file cannot overwrite another project's references. Director saves the remapped episode before changing the open editor. A storage failure rolls back the new media batch and leaves the previous project open. Cancelling the file picker also leaves it unchanged. If the tab or browser crashes between the media commit and the episode save, an unused media batch may remain; existing projects remain intact.

Local autosave still depends on browser storage and can be cleared by the browser or user. Keep downloaded portable files as backups. This first version does not provide recovery history, media garbage collection, linked source videos, schema migration, audio packaging or movie export.

## Runtime API

Import from `posecraft/project-bundle`:

```js
import {createProjectBundle, readProjectBundle} from 'posecraft/project-bundle';

// loadReference(id) returns a Blob from your application's media store.
const file = await createProjectBundle(episode, loadReference, {validateImage});
const {project, assets} = await readProjectBundle(JSON.stringify(file), {validateImage});
// assets is a Map from reference ID to Blob. Persist before opening project.
```

`validateImage(blob)` is an optional asynchronous decoder hook. Core validation always checks bounded byte counts, signatures, dimensions, reference coverage and hashes. Applications accepting untrusted image files should also supply a real image decoder, as Director does; headers alone cannot prove a compressed image will decode. The module uses `Blob`, base64 helpers and Web Crypto, available in current browsers and the supported Node runtime. It does not write browser storage. `inspectRaster(bytes, type)` and `projectBundleLimits` are exported for callers sharing these bounds.
