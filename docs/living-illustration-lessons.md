# Living illustration lessons

Recorded September 27, 2026 from the Wwwzard reviews on jelizarovas.com. These decisions extend the [product direction](product-direction.md) and [quality contract](engine-quality-reset.md). They describe shipped mechanisms and remaining limits separately.

## Shape and contact

A waving hand must read as an open hand at its actual website size. Shortening a stretched palm into a fist did not fix the gesture. Author the palm, fingers, wrist, sleeve and elbow together. Keep the elbow near the body; let the forearm swing, the torso lead and the head follow. Review the lift, greeting and return, including interruption. The latest wave uses saved contour morphs shared by Home and Contact in examples/wwzard-wave.js.

Rotation and translation alone cannot preserve a bent sleeve silhouette. Use compatible path contours with authored intermediate shapes and additive channels. Additional finger paths must inherit the hand's joint AND its local transform. A correct shape attached at the wrong origin can render elsewhere while schema validation still passes. Compound finger contours collapse to zero area at rest and unfold with the palm. Keep path topology compatible through every frame.

## Occlusion is part of the rig

A single arm-wide depth value cannot put a shoulder behind a torso and its hand above a keyboard. The shared depthSplit contract renders fragments of one continuous contour at independently authored depths. Keep the full torso behind furniture instead of cutting its source shape at the tabletop. Sleeve shading must inherit its surface's split and transforms.

Depth changes are authored animation channels. Move hands clear before crossing a lid or desk edge; retreat and tuck them with intermediate poses rather than swinging both arms outward. Check normal, angry and disappointed poses separately. Fixing one state does not establish the other states.

For a book grip, the palm belongs behind the cover while only curled fingers overlap the edge. A page-turn hand crosses depth deliberately and hands contact back to the resting grip on return. In Stories these are saved parts and pageHand.z / bookGrip.opacity tracks. A blanket increase in hand depth recreates the defect.

## Responsive behavior

A click should interrupt from the current displayed pose, including the current contour, rather than wait for an idle cycle or travel through an unrelated neutral pose. The shared action system captures interruption shapes and blends toward the requested action. Close and open are distinct commands; a visitor moving the laptop lid gets a different authored reaction from the character closing it himself. Repeated events must not restart a gesture endlessly.

Head attention and hand activity need independent channels. Physical keys select anatomical hands, not screen-left versus screen-right. Key repeat holds a contact until release. A held prop reserves its hand; the remaining hand handles every key. Blur, hidden tabs, submission and disposal release held input. The host supplies bounded offsets and semantic events, never field text.

Closed-laptop idle, anger and recovery belong to saved behavior with bounded state. Anger is expressed in posture and breathing, without a visible meter. Stillness is allowed. Particle bursts accompany actual typing rather than run continuously.

## Environment, lighting and host motion

Use the same authored plant and window across placements. Foliage bends from the soil under nearby pointer gusts and page inertia; the pot stays planted. The window is a recessed opening with a distant horizon. A contact plane passes through its open aperture. Success closes it; failure keeps the draft and retrieves another plane for retry.

Night lighting preserves dark local colors. Broad whitening made the character look ghostly. Saved material lighting separates moon highlights from laptop light and backlit keys, with laptop response tied to activity and lid state. Theme changes and window interaction stay synchronized with the host page.

Page movement drives a saved overlay from normalized host progress. It affects robe, shoulders, hat and foliage while retaining prop contacts. Reuse the existing outgoing renderer, coalesce updates into its frame, and clean up on cancellation. Do not compile a second scene for a sliding screenshot of the old page.

## Where this is enforced

| Contract | Shared implementation | Regression evidence |
| --- | --- | --- |
| Contour frames and layers | src/spatial.js, src/schema.js | test/morph-frames.test.js, test/morph-layers.test.js |
| Partial and animated depth | src/scene-depth.js, src/spatial.js, shared render evaluation | test/depth-split.test.js, test/scene-depth-schema.test.js, test/wwzard-layering.test.js |
| Interruptions and held channels | src/action-variations.js, src/motion-layers.js | test/action-interruption.test.js, test/wwzard-interruption.test.js, test/motion-layers.test.js |
| Pointer gusts | src/pointer-interactions.js, src/pointer-browser.js | test/pointer-proximity.test.js, test/pointer-proximity-studio.mjs |
| Host motion | src/host-transition.js, Studio Page motion panel | test/host-transition.test.js, test/studio-page-motion-browser.mjs |
| Material lighting | src/material-lighting.js, Studio lighting tools | test/material-lighting.test.js, test/wwwzard-night.test.js |
| Open-hand wave and book contact | Saved Wwwzard parts, morphs and clips | test/wwzard-wave.test.js, test/portfolio-wave-browser.mjs, test/wwwzard-stories-browser.mjs |
| Authoring and delivery | Studio documents, runtime package, scene exports | test/portfolio-scenes-studio.mjs, packages/runtime/test/consumer.mjs |

## Delivery and limits

Keep runtime code in @posecraft/runtime, artwork and behavior in scene documents, and website integration in the consumer. The portable runtime must contain no Wwwzard coordinates or website-specific gesture repairs. New source-authored data must survive Studio save/reopen and export. Character-specific poses remain artwork; they are not automatically generated by the engine.

Review full movement in day and night at embed size, then verify the exact live build. Do not blame caching when the screenshot already shows the latest flawed art. Automated numeric bounds cannot certify an expressive silhouette. Tests must intercept contact requests rather than send real messages.

The saved scenes and shared contracts are available now. A complete no-code authoring workflow and reuse on a separately designed second character remain acceptance work. Physical-phone performance remains unverified. Raw Home scene JSON has a 30 KiB gzip check; this is not the complete website transfer budget. Record complete host cost and equivalent one/multiple-embed frame timings separately. Preserve current performance evidence in [Wwwzard performance](wwzard-performance.md).

## Follow-up: night fingers and tucked sleeves

A day-approved open hand still read as dark spikes at night. The lighting evaluator sampled the collapsed rest contour of the finger part rather than its displayed morph. Runtime alpha.3 now samples the evaluated contour, including interruption blends, and invalidates its bounds cache when that shape changes. A generic regression compares unfolded geometry with identical static geometry. Finger silhouettes are shorter and rounder.

The near arm also collapsed into a thin strip when the retraction warp compressed its width along X. Its saved retraction target now has a deliberately drawn hanging sleeve and matching shadow while preserving the wrist and depth contracts. The day/night review checks resting and both emotional tucked poses, plus geometric sleeve width. Judge both themes and the entire retract/return, not only the wave peak.
