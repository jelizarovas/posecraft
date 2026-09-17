# Action variations and stats

A live scene can perform named actions from `behaviorGraph.activities`. Each action belongs to one actor and chooses a weighted animation variant when it starts. Variants can use different clips, a window within a clip, a sampled playback speed, and small sampled pose offsets. Selection uses the graph's seed, so resetting or replaying the same inputs gives the same result.

In Studio, open **Scene → Behaviors & interactions → Stats** to add numeric stats and their limits. **Actions** edits animation choices, success chances, and effects. States and event handlers can use **perform** to start an action and **add** to increase or decrease a stat. Saving, undo, redo, project downloads, and website exports include these definitions.

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
