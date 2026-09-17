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

Clips belong to character packs. Editing a clip changes it for every actor using that pack, including duplicated characters. Key selection spans tracks within one clip, not several clips or characters. Retiming preserves selected key values and their time relationship; it does not solve hand contacts or foot pinning. Curve handles, onion skins, motion paths, markers, additive layers and clip arrangement remain later roadmap work.

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
