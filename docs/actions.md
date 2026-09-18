# Action variations and stats

A live scene can perform named actions from `behaviorGraph.activities`. Each action belongs to one actor and chooses a weighted animation variant when it starts. Variants can use different clips, a window within a clip, a sampled playback speed, and small sampled pose offsets. Selection uses the graph's seed, so resetting or replaying the same inputs gives the same result.

In Studio, open **Scene → Behaviors & interactions → Stats** to add numeric stats and their limits. **Actions** edits animation choices, success chances, and effects. States and event handlers can use **perform** to start an action and **add** to increase or decrease a stat. Saving, undo, redo, project downloads, and website exports include these definitions.

## Stats and variation choice

In **Actions**, select a variation and use **Choice-weight influences** to make its frequency depend on current stats. The effective weight is `max(0, weight + sum(stat × influence))`. For example, a strained variation with base weight 1 and fatigue influence 0.08 has weight 1 when fresh and 9 at fatigue 100. With a steady variation weighted 3, its chance rises from 25% to 75%. This changes animation choice separately from the recipe's success chance.

```js
{ id: 'strained', clip: 'strained-pull-up', weight: 1,
  weightInfluences: [{ variable: 'fatigue', weight: 0.08 }],
  speed: { min: 0.8, max: 1 } }
```

Each variation supports up to eight influences referencing existing numeric stats, with coefficients from −1000 to 1000. Conditions filter variations first, then positive effective weights determine their relative chances. The same rules apply to failed variations. If the selected outcome has no positive eligible weight, the request starts nothing and applies no effects. Keep a positive fallback when an action must always be available. Selection reads stats before start effects and remains fixed for that attempt; resetting and replaying the same inputs reproduces it. Studio undo, reload, and exports preserve the influences.

## Outcome rules

Success chance is the base probability plus each current stat multiplied by its influence, clamped to 0–1. For example, a base of 1 with fatigue influence −0.006 and dehydration influence −0.004 gives a 70% chance at fatigue 30 and dehydration 30. These are authoring values for a cartoon, not physiological measurements.

The runtime samples success when an action starts, before applying its start effects. This lets a failed attempt play its own animation. Start effects apply once per attempt; success or failure effects apply once on completion. Use these effects to spend energy, increase dehydration, reward success, lower confidence, or send an event that chooses the next action. Changing a stat during an attempt affects later attempts; it does not reroll the current one.

Only one action runs per actor. A perform request for a busy actor is ignored. Different actors can run actions concurrently. Effects cannot recursively perform another action; send a completion event and start the next action in its handler or destination state. The completed pose holds until the next action starts. Choose matching start/end poses for continuous movement.

## Scene data

```js
behaviorGraph: {
  seed: 17,
  variables: { fatigue: 0, dehydration: 0, reps: 0 },
  variableBounds: {
    fatigue: { min: 0, max: 100 },
    dehydration: { min: 0, max: 100 },
    reps: { min: 0, max: 8 }
  },
  initial: 'working',
  states: {
    working: { actions: [{ type: 'perform', activity: 'rep' }] },
    resting: { actions: [] }
  },
  edges: [
    { id: 'next', from: 'working', to: 'working', event: 'rep-done',
      when: { variable: 'reps', op: 'lt', value: 8 }, weight: 1 },
    { id: 'finished', from: 'working', to: 'resting', event: 'rep-done',
      when: { variable: 'reps', op: 'gte', value: 8 }, weight: 1 },
    { id: 'failed', from: 'working', to: 'resting', event: 'rep-failed', weight: 1 }
  ],
  activities: {
    rep: {
      actor: 'atlas',
      variants: [
        { id: 'steady', clip: 'pull-up', weight: 3, speed: { min: 0.85, max: 1.1 } },
        { id: 'effort', clip: 'strained-pull-up', weight: 1,
          speed: { min: 0.7, max: 0.9 }, offsets: { 'head.rotation': { min: -2, max: 2 } } }
      ],
      failureVariants: [
        { id: 'stall', clip: 'failed-pull-up', weight: 1, speed: { min: 0.8, max: 1 } }
      ],
      success: { base: 1, modifiers: [
        { variable: 'fatigue', weight: -0.006 },
        { variable: 'dehydration', weight: -0.004 }
      ] },
      onStart: [
        { type: 'add', variable: 'fatigue', value: 5 },
        { type: 'add', variable: 'dehydration', value: 3 }
      ],
      onSuccess: [
        { type: 'add', variable: 'reps', value: 1 },
        { type: 'event', event: 'rep-done' }
      ],
      onFailure: [{ type: 'event', event: 'rep-failed' }]
    }
  }
}
```

Clips must exist in the actor's pack. A variant's optional `start` and `end` select a nonempty interval within its clip. Its speed range is 0.1–4. Pose offsets ease in over the first 10% of the interval and ease out over the last 10%, then joint/channel limits constrain the result. Contacts run after the action pose, using its clip and local clip time so a slower rep retains its authored grip.

`frame.behavior.variables` contains current stats. `frame.behavior.actions[actorId]` reports activity, variant, sampled speed, outcome, progress, and whether it is still active. Actor frames expose the evaluated `clip`, `clipTime`, and `activity`. Use the ordinary `dispatch` and `setVariable` controller methods to control a scene from a website. Explicit clip preview takes precedence over live action poses. Sequence presentation disables the live graph.

Graphs support up to 32 activities, 16 variants per outcome, 32 pose offsets per variant, and 32 success influences per activity. Numeric stats stay within authored bounds, or ±1,000,000 without bounds. Live playback stores current actions rather than an ever-growing action history. The self-hosted compiler includes these rules in the illustration runtime without requiring rigid-body physics.


## Remembering prop placement

A successful variant may write its own state before the action's shared completion effects. For example, one bottle animation can leave it at the bar and another can leave it by the bench:

```js
{
  id: 'drink-from-bench', clip: 'drink-from-bench',
  weight: 1, speed: { min: 0.95, max: 1.05 },
  when: { variable: 'bottleLocation', op: 'eq', value: 2 },
  onSuccess: [
    { type: 'set', variable: 'bottleX', value: 610 },
    { type: 'set', variable: 'bottleY', value: 320 },
    { type: 'set', variable: 'bottleLocation', value: 2 }
  ]
}
```

`when` is optional and supports equality against an existing numeric variable. Eligible variants retain their relative weights. Conditions are checked once at action start, before start effects. If the selected outcome has no eligible variant, the perform request returns false, leaves the previous pose intact, and applies no start or completion effects. Include an eligible fallback or cover every possible location in the graph. A variant's optional `onSuccess` list uses the same effects as the recipe, cannot contain `perform`, and runs exactly once before the recipe's `onSuccess`. Failed attempts do not run variant success effects.

A scene can keep a joint at the remembered point while the actor walks away:

```js
poseBindings: [{
  actor: 'atlas', joint: 'water-bottle', space: 'world',
  x: { variable: 'bottleX' }, y: { variable: 'bottleY' },
  excludeClips: ['drink-from-bar', 'drink-from-bench']
}]
```

Here `world` means absolute coordinates within the actor's pack, before its scene `Actor.transform`. Moving, scaling or rotating the whole actor instance still moves this coordinate space. For a joint directly below an untranslated root definition, the binding subtracts the root's current position and the joint's rest offset. Rotated parents use the inverse projected parent transform. Only position is bound; rotation and depth order remain authored. Joint `.z` changes drawing order, not local translation.

Bindings run after contacts in both the full and illustration runtimes. The excluded clips own the prop's position while picking it up, carrying it or placing it. Explicit clip previews, sequence presentation, physics and recovery keep their authored/evaluated poses. An edge-on parent or an offset outside the supported ±4096 joint translation range leaves the authored position unchanged instead of producing invalid geometry.

A scene supports 32 bindings, one per actor/joint, with up to 64 excluded clips each. Targets must be existing non-root joints and both coordinates must reference numeric graph variables. Bindings are serialized with the scene and reported as the `pose-bindings` export feature. Actor deletion removes its bindings. Reset and recorded-input replay restore the same locations and eligible action choices.
