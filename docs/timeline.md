# Editing several animation tracks

In Character Studio, choose a character and clip, then press **Edit keys across tracks** beside the add-key button. The workspace shows every keyed joint and channel in that clip. The existing single-track strip still supports posing and adding individual keys.

Click a key to select it and preview that moment. Shift-click or Ctrl/Cmd-click adds or removes individual keys. On a phone, turn on **Select several** and tap keys. A track name selects all of its keys; with Select several enabled, it adds the track to the selection. Filter by a track name and choose **All shown** to select all matching keys. Hidden selected tracks still participate in edits, and the selection count includes them. Clear removes the selection.

- **Move** offsets every selected key by the entered number of seconds. Negative offsets move earlier.
- **Copy** keeps the source keys and selects the new copies at the offset time.
- **Scale** changes timing around an explicit anchor. A factor of 2 doubles each selected key's distance from the anchor; 0.5 halves it. Values and easing stay unchanged. The clip duration stays unchanged.
- **Apply easing** sets Smooth, Linear or Step on every selected key. Easing controls the segment after that key. Step holds its value until the next key.
- **Delete** removes the selected keys, removing a track when it becomes empty.

Each operation is one undoable change. Undo and Redo are available inside the workspace; Ctrl/Cmd-Z and Ctrl/Cmd-Shift-Z work when a text or number field does not have focus. Closing the workspace keeps the edited document. The local draft, Save project and Export scene all include the changes. Saved projects reopen with the edited tracks; the temporary key selection is not saved.

Edits use millisecond precision. An operation that would put two keys at the same time on the same track, move a key outside the clip, or exceed 1,000 keys per track is rejected as a whole. Existing keys are never silently overwritten. A selected key may move into another selected key's previous time if that other key moves away. Copying with zero offset conflicts with its source and is rejected.

Clips belong to character packs. Editing a clip changes it for every actor using that pack, including duplicated characters. Key selection spans tracks within one clip, not several clips or characters. Selected-key edits preserve values and their time relationship; they do not move contact windows. Use Whole clip timing below to retime a complete clip and its matching contacts. Curve handles and clip arrangement remain roadmap work. Reusable additive movement is available through motion layers.

## Programmatic edits

`editTimelineKeys` in `src/timeline-editing.js` is a pure helper. It accepts a clip, a list of `{track, time}` references and one operation. It returns `{clip, selection}` without changing its inputs. It checks clip structure, stale references, key collisions, time bounds and supported easing. Joint-specific value validation remains part of `DocumentStore` validation.

```js
import {editTimelineKeys} from '../src/timeline-editing.js';

const result = editTimelineKeys(document.packs.ona.clips.wave, [
  {track: 'head.rotation', time: 0.5},
  {track: 'rightArm.rotation', time: 0.5}
], {type: 'move', offset: 0.2});

store.transact([{
  op: 'set',
  path: ['packs', 'ona', 'clips', 'wave'],
  value: result.clip
}]);
```

Other operations are `{type:'copy', offset}`, `{type:'scale', factor, pivot}`, `{type:'easing', easing:'smooth'|'linear'|'step'}` and `{type:'delete'}`. The returned selection follows moved or copied keys and is empty after deletion. Commit the returned clip in one transaction so validation, history and revision checks apply to the complete edit.

## Whole clip timing

Open **Edit keys across tracks**, expand **Whole clip timing**, enter a new duration and choose **Retime clip**. This changes every track in the selected clip, its event markers, and contacts explicitly filtered to that clip for every actor using the pack. Contact start/end, repeat period and fade durations scale together. Matching authored scroll windows scale too. The playhead moves to the same proportional point. Undo restores the entire edit at once.

Times use millisecond precision and durations range from 0.1 to 180 seconds. If rounding merges keys or distinct event times, collapses a contact window, or makes its fades invalid, the whole operation fails without changing the document. Contacts without a clip filter retain their timing because they also apply to other clips. State transition blend times remain wall-clock seconds. External Director projects and application schedules are separate files and are not modified.

Live activity recipes, behavior graphs, relevant motion layers and procedural controllers can own their own timing. The operation rejects those unsupported dependencies with an explanation. For example, changing the handoff clip alone cannot also retime the receiving character and the graph's transfer deadline. Changing presentation to Sequence does not bake live actions into authored motion.

The SDK operation is `retimeSceneClip(scene, {packId, clipId, duration})` from `posecraft/timeline-editing`. It returns `{document, commands, expectedRevision, scale, contacts, notes}`. Apply `commands` with `DocumentStore.transact(commands, expectedRevision)` for revision checking and undo.

## Event markers

Choose **Markers** inside the key editor to add, rename, move, seek or remove a marker. Markers are stored as `clip.events: [{time, name}]` and emit the existing runtime `marker` event during playback. Scrubbing and pose previews do not fire them. A label such as `hand:reach` is only a label; it does not execute a script or automatically attach a prop.

A clip supports at most 128 markers. Names contain 1–80 trimmed characters without control characters. Different names may share a time, and a name may repeat at different times. An identical name/time pair is rejected. Simultaneous markers keep their saved order. Whole-clip retiming moves markers; selected-key edits leave markers unchanged. Marker edits share the same undo, save and reload behavior as keys.

## Pose guides

In Character mode, open **Pose guides** above the scene and enable **Nearby poses** or **Selected joint path**. Enabling a guide pauses playback. Earlier artwork is coral, later artwork is blue, and spacing is adjustable from 0.01 to 2 seconds. Ghosts stop at clip boundaries, even when the clip loops. The path samples the selected joint's origin at 31 points across the clip; it is not the tip of the artwork. Selecting a different joint updates the path.

Guides use the saved clip, current unsaved pose overrides, current expression and contact constraints. Other characters, free objects, ownership and procedural effects stay at the captured visible scene state. They do not predict a future live handoff, physics response or decision. The preview excludes spring motion and live additive layers. Ghost artwork includes the selected character, not separately attached scene props.

Guides hide during playback and outside the Character timeline. They are cached while paused, generated in cancellable batches, and do not enter saved scenes, SVG downloads or website exports. Their settings are temporary editor preferences. These guides help inspect timing and contact arcs; they do not generate a walk or repair anatomy.

`posecraft/animation-preview` exposes `createAnimationPreview(scene, frame, {actor, clip, overrides?, boundary?})`. Its `sample(time)`, `onion(time, {step, count})` and `path(joint, {start, end, samples})` methods do not advance a controller or emit events. The default boundary policy is clamp; wrap is explicit. The SDK caps ghosts at three per side and paths at 61 points. Recreate the sampler after changing the document or captured stage state.
