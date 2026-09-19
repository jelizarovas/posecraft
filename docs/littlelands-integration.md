# Littlelands integration

The first supported game integration uses the illustrated runtime through `posecraft/browser`, `posecraft/game` and `posecraft/react`. Native 3D action modules remain a separate contract. The workout director is not a general 3D implementation of the game API.

Littlelands owns quests, learning progress, rewards, dialogue UI and durable game saves. Posecraft owns scene presentation and the execution of supported character commands. A successful reaction animation should not be the source of truth for a reward. Record the game transaction independently, then request the reaction.

## Install a specific build

The package is private and is not published to the npm registry. For an integration candidate, check out the chosen commit, run `npm ci`, then `npm pack`. Install that generated tarball into the game project:

```sh
npm install /path/to/posecraft-0.1.0.tgz
```

Record the source commit alongside the tarball. The current version alone does not identify a unique build. Keep the consumer lockfile and avoid depending on a moving `main` branch.

Use the public package imports. Do not import files from the Posecraft checkout or alias `posecraft` to its `src` directory. Keep exported scene JSON in the game's assets and validate it when loading an external document.

```js
import {mountScene} from 'posecraft/browser';

const player = mountScene(element, sceneDocument, {
  execution: 'worker',
  onError: reportSceneError,
  onSpeechRequest: ({actor, text, signal}) =>
    dialogue.show({speaker: actor, text, signal}),
});

const keeper = player.actor('shopkeeper');
const cue = keeper.sequence([
  {do: 'inspect'},
  {react: 'success'},
  {say: 'You fixed it!'},
]);

try {
  await cue.finished;
} catch (error) {
  if (error.name !== 'AbortError') reportSceneError(error);
}

// On route teardown, dispose once the host no longer needs this scene.
player.dispose();
```

Actor IDs, aliases and reactions must exist in the document. Use `player.describe()` and `actor.capabilities()` to discover what a loaded scene actually supports. See [the game API](game-api.md) for the current command and persistence contract.

`PosecraftScene` from `posecraft/react` owns mounting and disposal. Keep its `scene` document reference stable across unrelated React renders. Pass speech cancellation through to the dialogue system so a dismissed character cannot leave a stale subtitle or voice playing.

## Save and suspend

Store the semantic snapshot beside the Littlelands save, with the scene's content version. Restore it before starting a new interaction:

```js
const presentation = await player.snapshot();
await saveGame({world: littlelandsState, presentation});

// Later, after loading the same scene document:
await player.restore(savedGame.presentation);
```

Snapshots are JSON-safe and cover supported animated scenes. They do not resume JavaScript promises, physical velocities or host dialogue. Restore cancels transient commands, validates the complete snapshot before applying it and does not replay state-entry events. Changed scene content requires an explicit save migration. Specialized ensembles, fluids and prop games are outside this first persistence contract.

Use `await player.actor(id).sleep()` when a background character can stop updating, and `await player.actor(id).wake()` when the game needs it again. Sleep cancels active performance commands. Decide relevance in Littlelands, where the player's location and active interaction are known. Scene-level visibility suspension remains separate.

## Consumer release check

Run `npm run test:consumer` before handing an SDK candidate to Littlelands. It packs the repository and installs that tarball into a new `.tmp/package-consumer-*` project with its own dependencies. The install uses the workspace-local npm cache and is offline by default. To populate that cache from the registry, set `POSECRAFT_CONSUMER_ONLINE=1` for the run.

The check verifies:

- Public exports and declaration files exist in the installed package.
- Node can import the game, browser and React modules without mounting a DOM scene.
- A separate strict TypeScript consumer compiles against the installed declarations.
- A production Vite build resolves the installed package, emits its simulation worker and serves the built output without source files.
- Main-thread and worker players complete commands once, handle aborts and tolerate repeated mount/dispose cycles.
- Movement, looking and speech can run together. Object changes acknowledge completion, JSON snapshots restore state and actors sleep and wake.
- React mounting and unmounting cancel pending speech and remove rendered children. A separate development build checks StrictMode's effect cleanup and remount, including worker termination.

Results and compressed asset sizes are written to `test-results/package-consumer.json`. The test retains its consumer directory for inspection. The measured bundle includes the React consumer application. The tarball also contains examples and native assets; its size is not the browser's download size.

This check establishes one supported bundler path. It does not establish compatibility with every bundler, real-phone performance, or visual quality. The full browser player currently includes simulation support even for the minimal test scene. Selective illustration export is a separate deployment path.

The native Three view is currently an internal Studio module, uses Vite's `?worker&inline` syntax and refers to character assets relative to the hosting page. Do not treat that module as a portable public browser SDK or claim native parity from the illustrated consumer check.

## Littlelands acceptance scene

Use a small street as the release gate: a character notices the player, approaches a repaired sign, reacts, speaks and changes a shop's state. Repeat it with interruption, backgrounding, leaving the scene and loading saved game state. Run several background actors while the learning interface is active on a target phone. Review the exported document and the game integration together.

Keep missing capabilities explicit. This alpha supports authored floating and planar navigation, concurrent motion/gaze/speech, the versioned semantic snapshot and explicit actor sleep. It does not supply a general native 3D game facade, arbitrary object properties or automatic per-actor quality selection. Use the capability manifest and the API documentation when planning an interaction. A working gym demonstration is not evidence that a general game contract exists.
