# Posecraft runtime

Pre-alpha playback for authored 2D living illustrations. The package contains the shared animation engine and SVG/Canvas rendering. Studio, demos, character artwork, physics and native 3D are separate.

## Install the local pre-alpha

```sh
npm install ./posecraft-runtime-0.1.0-alpha.2.tgz
```

The archive is the installable release artifact. It does not require this repository, Vite, a hosted service or an account at playback time. No npm registry release has been made yet.

## Website integration

Export a scene JSON file from Studio and serve it with your website. Do not load untrusted project documents from arbitrary visitors.

```js
import { mountIllustration, assertDocument } from '@posecraft/runtime';

const response = await fetch('/illustrations/wwwzard.scene.json');
if (!response.ok) throw new Error(`Scene request failed: ${response.status}`);
const scene = assertDocument(await response.json());
const host = document.querySelector('#wwwzard');
const player = mountIllustration(host, scene, {
  label: 'Wwwzard at work',
  onError: error => console.error(error),
});

document.querySelector('#open-laptop').onclick = () => player.dispatch('open-laptop');
document.querySelector('#close-laptop').onclick = () => player.dispatch('close-laptop');
// During route/component cleanup:
// player.dispose();
```

```css
#wwwzard { width: 100%; aspect-ratio: 1; }
#wwwzard svg, #wwwzard canvas { display: block; width: 100%; height: 100%; }
```

Use the scene's `bounds.width / bounds.height` for the host aspect ratio. The host must have a nonzero size. Mount after the host exists in the browser. Imports and `renderSVG` are safe on a server; browser mounting needs a DOM.

`mountIllustration` is synchronous. It supplies the behavior and pointer providers. It returns a player with `dispatch`, `setVariable`, `setInput`, `play`, `pause`, `reset`, `seek`, `previewClip`, `clearPreview`, `controller` and `dispose`.

Reduced motion follows the system preference by default. Hidden and offscreen hosts suspend the animation clock. Set `autoplay: false` to start paused. For a static accessible fallback, render an illustration image alongside your page content rather than relying on animation to convey essential information.

## React

React is an optional peer dependency. Plain browser imports do not load it.

```jsx
import { useRef } from 'react';
import { PosecraftIllustration } from '@posecraft/runtime/react';

export function Wwwzard({ scene }) {
  const illustration = useRef(null);
  return <>
    <PosecraftIllustration ref={illustration} scene={scene} label="Wwwzard at work" />
    <button onClick={() => illustration.current?.dispatch('open-laptop')}>Open laptop</button>
  </>;
}
```

Keep `scene` referentially stable, such as an imported JSON document or a memoized fetch result. Replacing it remounts playback. The adapter disposes playback on unmount and React Strict Mode cleanup. It is a client component in frameworks that distinguish server and client components.

## Supported pre-alpha scope

The built-in providers cover animated 2D actors, clips, path deformation, animated depth, action interruption, scene behaviors, pointer events, scrolling, lighting and emitters. Both SVG and Canvas use the shared renderer. `supportsIllustration(scene)` checks the provider requirements of an already valid document. Call `assertDocument` for JSON validation.

Scenes with contact constraints, procedural motion layers or actor-local behaviors opt into the features entry. It loads only when imported, keeping it out of websites with no such scene requirements.

```js
import { mountIllustration, supportsIllustration } from '@posecraft/runtime';
import { illustrationFeatures } from '@posecraft/runtime/features';

if (!supportsIllustration(scene, illustrationFeatures)) throw new Error('Unsupported scene');
const player = mountIllustration(host, scene, { ...illustrationFeatures });
```

Game bindings, physical actor modes, ensembles, bottle fluid, shared scene objects and prop games are outside the built-in package scope. Unsupported scenes fail explicitly; they do not silently lose their behavior. Existing advanced integrations can supply `IllustrationProviders` through the mount/controller options.

`createIllustrationController`, `IllustrationController`, `renderSVG` and `mountRenderer` support Studio previews and custom hosts. A custom host owns clock, visibility, reduced motion and disposal; prefer `mountIllustration` for website use.

`@posecraft/runtime/animation` preserves the low-level `AnimationController`, interpolation, forward kinematics and two-bone IK exports for existing custom rigs. It contains the same shared implementation, with no Studio or scene assets.

Scene documents use schema version 1. The npm package uses pre-alpha semantic versions. Pin `0.1.0-alpha.2` and test scene playback before upgrading; this pre-alpha does not promise a stable API yet.

## Material lighting

Saved `scene.materialLighting` settings shade existing fills and gradients in both SVG and Canvas. The weight and light gains read authored pose channels; an inverted lid channel can extinguish a screen light. Studio edits and exports these bindings. The runtime supports at most two sources and adds no filters or extra paths. Numeric input layers require `applyMotionLayers` from the optional features entry. The host owns its theme preference and sends input values without remounting the scene.
