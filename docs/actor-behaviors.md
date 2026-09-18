# Actor decision graphs

`scene.actorBehaviors` gives up to 32 actors their own variables, timers and seeded branches. Each actor has at most one graph. The scene-wide graph still coordinates shared events. Actor graphs use the existing state, edge, handler and effect format; they do not introduce executable expressions into scene files.

Each saved entry has an `id`, an `actor`, a `graph`, and optional `sensors`, `rates` and `outputs`:

```js
{
  id: 'ona-attention', actor: 'ona',
  sensors: [{ variable: 'engaged', source: 'input.engaged' }],
  rates: [{ variable: 'patience', perSecond: -0.1,
    when: { variable: 'engaged', op: 'eq', value: false } }],
  outputs: [{ variable: 'patience', source: 'input.patience' }],
  graph: {
    seed: 42, variables: { engaged: true, patience: 1 },
    variableBounds: { patience: { min: 0, max: 1 } },
    initial: 'waiting',
    states: { waiting: { actions: [] }, impatient: { actions: [] } },
    edges: [{ id: 'tired-of-waiting', from: 'waiting', to: 'impatient',
      after: { min: 0, max: 0 }, weight: 1,
      when: { variable: 'patience', op: 'lte', value: 0 } }]
  }
}
```

The actor's pack must declare the `engaged` and `patience` inputs used above. Sensors copy current input values into graph variables before integration. Rates use units per second and clamp to declared variable bounds. Outputs copy graph variables back to writable signals. Numeric outputs require bounds that fit their target. Bindings and rates are each limited to 16 entries.

Built-in signals are `time`, `input.<name>` and `scene.<variable>`. Only numeric and boolean actor inputs are exposed. Scene variables and time are read-only. Campfire members also expose `campfire.heating`, `campfire.distracted`, `campfire.busy`, and writable `campfire.heat`. `actorBehaviorSources(scene, actorId)` lists the supported signals for an inspector.

Effects can set local variables, change the owning actor's inputs, send events, control emitters and issue shared object commands. `$actor` resolves to the graph owner. Action recipes currently stay in the scene graph; scoped `activities` are explicitly rejected. Where multiple scopes control one emitter, later scopes in document order take precedence.

Controllers expose `setActorVariable(actor, name, value)` and `dispatchActor(actor, event, payload)`. These operations enter the replay history. A scoped event evaluates immediately without advancing its clock. Broadcast `dispatch(event)` reaches the scene graph and every actor graph; supplying an actor targets that actor's scope. Live snapshots are available in `frame.actorBehaviors`. Previewing an actor, directing a scene-level activity, reduced motion and paused animation stop its automatic scope clock.

The illustration runtime loads the optional `actorBehaviorFactory` provider only when needed. Full and illustration controllers use the same implementation and include scope queues, timers, variables and RNG state in replay checkpoints. `capture()` and `restore()` are runtime data snapshots, not portable scene exports.

## Campfire cooking

New campfire scenes save four cooking graphs. Each graph controls its camper's heating rate, ready threshold, burn threshold, attention check and cold waiting. The default ready threshold is 0.72 and the burn threshold is 1.03. `food-ready` starts the existing preparation/eating animation. `burn` targets the graph owner and starts the existing startled response. A cold or disabled flame stops heat integration. Replacing food sends `cooking-reset` to that member's graph.

Old scenes without actor graphs retain their previous cooking behavior. `convertCampfireCooking(document)` returns a revised clone, preserving existing actor graphs and artwork. Studio can commit that result as one undoable edit; it must not replace a user's saved draft silently.

The saved graphs now own cooking decisions. The ensemble still plans social attention, meteor reactions, sharing, relighting routes and hand-contact choreography. This is not a claim that all campfire behavior has moved into editable graphs.

`test/actor-behaviors.test.js` verifies independent actors, scoped events, bounded signals, modified cooking thresholds, cold heat, explicit migration, preview pause and cached full/illustration replay.
