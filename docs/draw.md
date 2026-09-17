# Draw & Rig

Open [Draw & Rig](../draw.html) to make a character or prop from vector artwork. The page has its own local draft. Character Studio opens the result in a separate Draw draft, preserving the main Studio project.

Add rectangles, ellipses or triangles. Select a shape on the canvas or in the Artwork list. Drag it to move it, edit fill and stroke, change its path coordinates, or apply a numeric local transform. Bring forward and Send backward change drawing order. Artwork stays in vector form in the scene JSON.

In Rig, add a joint, choose its parent, and set its pivot. Dragging a joint moves its pivot while keeping attached artwork and immediate child joints in place. Changing parents or assigning artwork also preserves the rest drawing. Rest rotation turns the attached artwork. Minimum and maximum rotation become the joint limits used by Character Studio. Undo and redo cover artwork and rig edits, including each completed drag.

Choose **Animate** to transfer the scene to Character Studio and add keys. **Save JSON** downloads a normal Posecraft scene. **Open** accepts Draw & Rig JSON projects. SVG import, Open and New replace the current drawing and start a new undo history. Save a file before replacing work you want to keep. Drafts recover across page reloads, but browser storage is not a substitute for a downloaded file.

## SVG import

The importer accepts UTF-8 SVG files up to 1 MB, with up to 1,000 elements. The root must have the SVG namespace. It supports paths, rectangles, circles, ellipses, lines, polygons, polylines and nested groups. Colors must be three- or six-digit hex values, or `none`. Fills use the normal nonzero winding rule. Numeric transforms can use translate, scale, rotate or matrix. Inherited colors and nested transforms are flattened into each path. A viewBox becomes the drawing bounds, including its origin offset.

For stroked artwork, set both `stroke-linecap="round"` and `stroke-linejoin="round"`, or expand the strokes into filled paths before importing. These are the stroke shapes supported by the runtime. Stroke width is limited to 30 drawing units. Width, height and geometry must use plain numbers, without CSS units.

Unsupported elements and attributes stop the import with an explanation. Text, embedded or linked images, stylesheets, inline style declarations, gradients, clipping, masks, filters, opacity, named colors, rounded rectangle attributes, nested SVG viewports, root SVG transforms, event handlers, scripts, external references and entity declarations are not imported. No source SVG node is inserted into the live page. Use your vector editor's plain path export and expand unsupported appearances first.

## Scope

This first workspace edits a single flat vector rig in its rest pose. It does not provide freehand drawing, draggable curve handles, mesh deformation, imported raster images, automatic bones, IK, turnaround art or attachment animation. Path coordinates and transforms have editable text controls; shape creation and placement do not require editing a path. Existing complex scenes remain in Character Studio and Director.
