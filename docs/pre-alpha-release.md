# Website runtime pre-alpha

The release package is `@posecraft/runtime@0.1.0-alpha.1`. The private root project remains a development workspace and compatibility SDK. Publish only `packages/runtime`; the root archive is not the website release.

## Deliverables

- `releases/posecraft-runtime-0.1.0-alpha.1.tgz`: installable npm archive, with no Studio, demos or artwork.
- `releases/wwwzard.scene.json`: the portfolio-owned exported scene, outside the runtime archive.
- `dist/studio`: standalone editor and offline PWA, with direct local-file saving where the browser supports it.
- `dist/demos`: demonstrations and their assets. Wwwzard uses the runtime package. Existing map, physics and 3D demonstrations still use their established internal APIs and are not part of the illustration pre-alpha.

`wwwzard.html` is the current illustration. `wwzard.html` remains a compatibility URL; `wwwzard-legacy.html` preserves the previous character demo. Internal saved actor/pack IDs remain unchanged to keep existing projects compatible.

## Build and install

```sh
npm ci
npm run build:runtime
npm run export:wwwzard
npm run test:runtime-consumer
npm run build:studio
npm run build:demos
```

The consumer test builds, packs and installs the archive in a separate project. It checks types, React server rendering, browser playback, repeated commands, multiple embeds, visibility suspension, reduced motion and disposal. It fails when demo assets or heavyweight runtime modules enter the package, or runtime plus scene exceeds 100 KiB gzip.

Install the archive into a website:

```sh
npm install ./posecraft-runtime-0.1.0-alpha.1.tgz
```

```js
import {mountIllustration} from '@posecraft/runtime';
import {applyMotionLayers} from '@posecraft/runtime/features';
import scene from './wwwzard.scene.json';

const player = mountIllustration(document.querySelector('#wizard'), scene, {
  motionLayerSolver: applyMotionLayers,
});
player.dispatch('close-laptop');
player.dispatch('open-laptop');
// When the host component unmounts:
player.dispose();
```

The host needs a defined width and height or aspect ratio. The React adapter is available at `@posecraft/runtime/react`. Root playback includes behavior and pointer support. Contacts, motion layers and actor behavior providers are explicit imports from `@posecraft/runtime/features`. See the [runtime README](../packages/runtime/README.md) for supported features and APIs.

Serve Studio and demos as sibling directories to retain their cross-links. Studio website exports load runtime files from its `runtime/` directory, which `build:studio` emits. The default combined build keeps the existing flat-site URLs. Local package development uses a workspace link; release verification uses the installed archive without source aliases.

## Tonight's portfolio integration

The local `C:/apps/resume/apps/portfolio` project installs a copy of the archive under `vendor/`. Home, Stories, Projects and Contact load that package and their own scene JSON lazily when visible. Previous artwork remains a loading/error fallback. The legacy motion lab uses the package's `animation` entry instead of importing a sibling repository. See [portfolio scenes](portfolio-scenes.md) for scene authoring, events and verification.

Production browser checks cover desktop, a 390px viewport, reduced motion, offscreen resume, navigation cleanup and mocked contact results. Physical-phone frame cost remains unverified. Contact uses the shared exported room, window and plant. The experimental motion lab remains a separate implementation.

The alpha.1 archive measured 105,647 bytes, with zero runtime dependencies. The direct runtime graph plus the base test scene measured 99,392 gzip bytes. Website bundlers can produce different splits; the portfolio's final build must be checked separately. Measurements live in `test-results/runtime-consumer-report.json` and `test-results/portfolio-runtime/`.

Registry publication requires an npm account with access to the `@posecraft` scope. The archive works without registry publication. No credentials belong in the package or repository. Publishing and live-site deployment are separate from local builds and tests.

## Known authoring limits

Path deformation, split/animated draw order and interruption are shared runtime features. Sleeve poses, hand placement and safe approaches around the desk remain authored scene data. Interpolation does not plan collision-free motion. Studio can edit and preserve these contracts but does not automatically create a convincing rig or repair every overlap. Local-file and offline details are in [Studio on your device](studio-local-files.md).

## Day and night

The portfolio owns its saved theme preference and a bounded 1.6-second transition clock. Window interactions emit `theme-toggle`; the host sends the interpolated `night` input to each mounted scene. A second click reverses the transition. Reduced motion applies the destination immediately. The header provides the same keyboard-accessible toggle. Theme changes retain the contact form and illustration mounts.

The exported scenes own sun/moon paths, sky opacity and [material lighting](material-lighting.md). Moonlight shades the existing artwork; laptop lighting reads authored activity brightness and the lid channel, so closing the lid turns it off. Stories and Projects reuse the same material-lighting contract. These settings and motion layers remain editable in Studio.

## Alpha.2 lighting correction

`@posecraft/runtime@0.1.0-alpha.2` preserves surface color under direct lighting and supports named emissive artwork on either saved light. The portfolio consumes `vendor/posecraft-runtime-0.1.0-alpha.2.tgz`; all four scene exports use the darker night preset. Home and Contact share the cyan keyboard emission and screen/lid gains. The archive is 105,834 bytes; the isolated base-scene consumer is 99,572 bytes gzip. The complete Home integration remains above its original 100 KiB target, about 106 KiB before host-page assets.
