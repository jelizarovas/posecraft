# Attach prop artwork

In Studio, open **Scene**, select a prop and find **Attach artwork** in its inspector. **Follow** can use a character joint or a shared object. Character targets also show a joint selector. The prop keeps its shape, color, width, height and layer.

Applying an attachment turns the prop's static collision box off in the same undoable edit. Attached artwork decorates its target; use the shared object's physics for collision. Changing the target preserves the attachment offsets and rotation settings.

Joint offsets use the joint's local coordinates and follow character scale. Shared-object offsets use scene units and rotate with the target. Artwork width and height always stay in scene units. **Rotation offset** adds a local rotation. Clear **Follow target rotation** to keep only that authored rotation while position still follows the target.

Choose **Scene placement** to detach. Studio captures the currently visible position and rotation so the artwork stays in place, and leaves collision disabled. Undo restores its attachment. Removing a shared object likewise detaches its artwork at its visible position and removes contacts targeting that object in one transaction. If the target is unavailable or hidden, there is no visible position to capture, so Studio retains the prop's saved base placement. Save/reopen retains all bindings and offsets.

## Contact targets

Choose a character in **Scene → Contacts & grips**. **Hold onto** lists scene points, character joints, shared objects and props with explicit labels. The capture-current-position button is available only for a scene point. Editing offsets or switching between bound targets keeps the binding type intact.

**Fade in** and **Fade out** use seconds and must fit together inside the contact's active window. Invalid changes leave the saved document untouched and show an error. Self-owned object targets and artwork attached to the same character are inactive to avoid a circular constraint. The live contact status explains this.

## Saved data

```js
prop.attachment = {
  type: 'joint', actor: 'carrier', joint: 'rightWrist',
  offsetX: 4, offsetY: -2, rotation: 15, inheritRotation: true
};
// Or: {type: 'object', object: 'gift', offsetX: 4, offsetY: -2}
prop.collider.enabled = false;
```

Declare `prop-attachments` in `requiredFeatures`. Studio adds it automatically. Runtime attachment evaluation uses current joint/object transforms without changing authored prop placement. Unavailable targets hide attached artwork instead of displaying it at an unrelated base position. See [contacts and grips](contacts.md) for the saved contact-target format.
