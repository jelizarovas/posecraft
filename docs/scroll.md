# Scroll-controlled scenes

Save `scene.scroll` to export the same behavior from Studio, the browser player and React. A host may override it with the `scroll` option or disable it with `scroll:false`. DOM elements belong to host options, never to the saved document.

```js
const player = mountScene(element, scene, {
  scroll: {
    mode: 'live',
    source: document.querySelector('.story'),
    axis: 'y',
    maxVelocity: 3000,
    smoothing: 0.08,
    bindings: [{
      source: 'progress',
      target: { type: 'input', actor: 'ona', name: 'attention' },
      from: [0, 1], to: [0, 1]
    }]
  }
});
```

Live mode maps scroll progress or velocity to declared numeric actor inputs or behavior variables. Variable targets use `{type:'variable',name:'attention'}`. Each target appears once. Output ranges must fit the target's declared bounds. Values clamp to the input range; reversing the output range reverses the response.

Progress covers the source's entire scrollable range, from 0 to 1. A source without overflow reports 0. Velocity uses CSS pixels per second, capped by `maxVelocity`, then exponentially smoothed using `smoothing` seconds. A new scroll after an idle period uses at most 100 ms for its first delta. Browser event coalescing means this is an interaction signal, not a physical velocity measurement. Velocity decays to zero when scrolling stops.

Authored mode pauses the scene clock and samples the chosen clip windows directly:

```js
const scroll = {
  mode: 'authored',
  clips: [{ actor: 'ona', clip: 'wave', start: 0, end: 2.4 }]
};
```

Authored mode supports animated actors only. It uses `previewClip`, never `seek`, so each scroll event does not replay physics or social history. `player.play()` keeps this mode under scroll control. Live mode keeps normal playback and influences its inputs. Do not mix clip windows and input bindings in one configuration.

Reduced motion defaults to `still`: progress and velocity both become zero. Set `reducedMotion:'progress'` to allow direct progress sampling while still suppressing velocity. System preference changes apply immediately. Hidden tabs stop sampling and reset velocity when shown.

React accepts the same `scroll` prop. Keep the options object stable with `useMemo` when possible; changing it remounts the player. `ref.current.refreshScroll()` or `player.refreshScroll()` refreshes progress after host layout changes. Resize observation also refreshes it. Unmount/dispose removes listeners, observers, previews and scheduled animation frames.

The sampler uses one coalesced animation frame callback and stops scheduling after velocity settles. This does not promise a hard frame-time bound for complex rendering. Scroll records normal live input changes subject to the controller's existing recording limit; authored sampling does not add replay input events.

Validation: `test/scroll-bindings.test.js` covers mapping and policies. `test/scroll-bindings-browser.mjs` exercises a real nested scroller, React, reduced motion, mobile resize, disposal and a throwing `seek` stub.
