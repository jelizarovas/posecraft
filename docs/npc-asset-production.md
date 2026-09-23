# Littlelands NPC and animal asset production brief

Status: instructions only. No new images, models, animations or runtime features are delivered by this document. Counts below define a proposed production scope, not assets that already exist. Preserve existing NPC IDs so authored routines can be rebound later.

## Requirements and planning assumptions

Distinct identities, child and species anatomy, coherent directional motion, correct tool contacts, in-scene scale and the specified art style are acceptance requirements. The exact reference counts, frame counts, sampling rates, cell dimensions, pilot roster and memory budget are a proposed production plan. Keep the shot list and totals consistent when revising that plan after a pilot. Counts describe intended coverage, not proof of quality or existing assets. Do not reduce requested identities or behaviors to meet a count or budget without making the scope change explicit.

## What must change

Create six independently designed adults and two independently designed children. Each needs its own mesh, face, proportions, clothing, approved silhouette and rendered frames. Species need articulated animal rigs and full directional action clips. Held tools must be rendered with the character doing the action, with correct hands, overlap and contact.

Do not recolor the hero to make a villager. Do not shrink an adult to make a child. Do not animate a standing animal by translating, tilting or flipping its single picture. Do not substitute vector or canvas line drawings for tools in final character art. Sharing a technically compatible skeleton or retargeted source motion is allowed; sharing the hero's final pixels as a new person is not.

At the time this brief was written, `examples/village-cast.js` and `src/map-npc-renderer.js` used those placeholder operations, and farm livestock images were standing scenery. This is the replacement rationale, not a fresh audit of ongoing asset work.

## Where to do the work

| Stage | Tool/location | Deliverable |
|---|---|---|
| Concept and identity references | Built-in image generation in this workspace, or the image-generation interface used by the artist | Individual PNG reference images and exact prompts. Use the approved image as a reference for subsequent requests. |
| Modeling, anatomy, clothes, tools, rigging and animation | Blender source project | One deliberately authored character or species model, a tested rig, materials and separate named action clips. Model distinct children and heavy bodies. |
| Final directional frame rendering | One locked Blender render scene | Transparent PNG sequences, sampled deterministically from the rig. These are the actual animation images. |
| Packing and mobile derivatives | Offline export/packing step in the repository | Alpha WebP/PNG atlas pages, clip metadata, anchors and preview contact sheets. Do no pixel recoloring during gameplay. |
| Review | Local `play.html` and map editor, using the real inn, fences and crop fields | Scale, overlap, movement and performance approval at normal game size. |

Use image generation for design and reference. Do not ask it to invent every successive walk frame independently: identity, anatomy and object grip can drift. A generated sprite-sheet image is a reference until every frame has been checked and cleaned. The production path is approved design → modeled and rigged source → authored motion → repeatable offline renders. These instructions require that modeling and animation work; a set of concept images does not replace it.

Blender source can also be exported as glTF with skeletons, animation and morph targets for a later live-character renderer. This is supported by the [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.pdf); it does not make the current map renderer support those assets automatically.

Suggested source organization, to create during production:

```text
art-source/littlelands/<asset-id>/
  brief.md
  prompts.json
  concepts/01.png ... 04.png
  references/turnaround-000.png ... turnaround-315.png
  references/details-01.png ... details-03.png
  references/in-scene.png
  source.blend
  character.glb
  render-manifest.json
  frames/<action>/d00/f000.png
  previews/<action>-contact-sheet.png
public/assets/map/npcs/<asset-id>/<action>-page-00.webp
public/assets/map/animals/<asset-id>/<action>-page-00.webp
public/assets/map/equipment/<tool-id>/<state>-page-00.webp
```

Large working renders belong in the source-art store or Git LFS, not the deployed website. Deploy only approved runtime derivatives. Record provenance, source files and reuse rights alongside each asset before putting it in the public repository.

## Art direction to paste into every brief

Original painted, pre-rendered isometric fantasy village artwork, matching the existing Littlelands timber-and-plaster houses, thatched roofs, worn stone and textured vegetation. Late-1990s/early-2000s detailed strategy/RPG readability, with realistic stylization rather than photoreal photography. Muted ochre, moss green, dusty blue, plum, warm brown leather and undyed linen. Weathered materials and broad readable folds. Natural skin and deliberate facial features. Clean silhouettes with soft antialiased edges; no thick black outline, cel bands, glossy plastic, low-poly faceting, chibi proportions or flat vector shapes. Detail must survive downsampling. Warm daylight from the fixed upper-left of the scene, restrained cool fill, no dramatic rim light. Original designs, not replicas of a named game's characters.

Attach actual local style references to each generation request: `public/assets/map/town/cottage.webp`, `public/assets/map/town/barn.webp`, `public/assets/map/buildings/woodland-inn.webp`, and a screenshot of the map at normal zoom. Use the existing cow/sheep images only as a material and palette reference, not as a rig or universal animal pose. Do not use the current hero or procedural NPC as the anatomy target.

### Scale and camera lock

- Use metres in source scenes. A typical adult is 1.70–1.80 m; an ordinary doorway clears roughly 2.05 m. Children's heights are specified below. Do not normalize every subject to the same image height.
- An adult sheep is roughly 0.75–0.95 m at the shoulder; cows 1.35–1.50 m; hens 0.35–0.45 m and the rooster about 0.55 m. Adjust lengths and foot spacing from credible anatomy references, not tile size.
- Fixed orthographic camera, azimuth 45°, elevation approximately 30°. This matches the current baker's `(4, 3.266, 4)` camera offset and the map's 2:1 ground diamonds. Ground screen slopes are about 26.565°; that is not the camera elevation.
- Render 16 headings, 22.5° apart. Match `d00` to movement along world +X, then increasing `atan2(y, x)` headings. Check the mapping in the real engine before rendering every action. The current baker uses `root.rotation.y = Math.PI/2 - direction * 2*Math.PI/16`.
- Keep camera, light rig, exposure and world scale fixed. Rotate the actor and its held props, not the light. Do not horizontally mirror finished frames; handedness, clothing asymmetry and lighting must remain correct.
- Keep the ground anchor stable. Feet, airborne height, body bounce and shadows must each have a single owner. Export root displacement and foot contacts; do not both bake horizontal travel into the pixels and translate it again in the engine.
- Transparent background for final renders. No checkerboard painted into the image, no ground plate and no floor cast shadow baked into the body sprite. Keep body shading and contact self-shadowing. Render ground shadows separately so the engine can place and disable them.

## Proposed reference-image budget

For **each of the eight humans and each animal design**, budget **16 image-generation outputs**, excluding rejected retries:

1. Four separate full-body concept candidates. Pick one identity before continuing.
2. Eight separate neutral turnaround references of that same identity, at 45° steps. Use neutral modeling views here, not a changeable cinematic camera. Supply the approved concept as a reference on every request.
3. Three detail references. Humans: face/hair; hands and boots; garment layers/seams. Animals: head/mouth/eyes; feet/hooves/claws; coat, tail, horns or feathers.
4. One scale-and-style image beside the approved doorway, with a 1.75 m adult proxy where useful.

That is 16 images generated, with 13 retained after the three rejected concept candidates are excluded. These are references, not animation frames. A contact sheet can display them for review but does not replace the individual files. Correct contradictions between front, side and rear references before modeling.

## Human roster and exact render totals

Names and IDs below retain the current town bindings. The designs are new production briefs. Skin tones may be varied deliberately; each approved identity must stay consistent across all frames.

| Asset ID / name | Design |
|---|---|
| `npc-farmer` / Mara | Adult woman, sturdy working build, 1.70 m; broad forearms, tied dark hair, straw hat, ochre linen and patched apron. |
| `npc-trader` / Tomas | Adult man, lean and tall, 1.82 m; narrow shoulders, longer face, short beard, blue wool vest, cap and belt pouch. |
| `npc-villager` / Elin | Adult woman, medium build, 1.62 m; round face, braided hair, plum dress, off-white baker apron, rolled sleeves. |
| `npc-herder` / Ivo | Older man, wiry, 1.72 m; weathered dark skin, grey beard, slight stoop, rust coat and shepherd crook. |
| `npc-gardener` / Nell | Older woman, short, 1.55 m; silver bun, square face, green bodice, practical skirt and worn gardening gloves. |
| `npc-miller` / Bram | Fat adult farmer/miller, 1.78 m; wide belly, thick upper arms and thighs, round face, beard, flour-dusted taupe shirt and suspenders. Clothing and gait fitted to his actual body. |
| `npc-child-1` / Pip | Boy, about 8, 1.20 m; child-specific head/body proportions, shorter limbs, soft face, orange short tunic, loose cap and scuffed ankle boots. |
| `npc-child-2` / Wren | Girl, about 10, 1.34 m; distinct child rig and face, tied hair, blue pinafore over cream blouse, leggings and soft boots. |

Bram's belly, shoulder width, gait, clothing drape and arm clearance must be modeled and animated, not produced by stretching a thin character. Pip and Wren need shorter limbs, different head-to-body ratios, age-appropriate faces, balance and stride. Do not share an adult mesh scaled to 66%.

Every human receives the core and rest packages, plus the assigned occupation/play package. Render every listed clip at all 16 headings. Counts are unique frames; do not add a duplicate last frame to a loop.

| Character | Reference images | Clips | Frames per heading, all clips | Final body/action frames |
|---|---:|---:|---:|---:|
| Mara | 16 | 40 | 466 | 7,456 |
| Tomas | 16 | 38 | 430 | 6,880 |
| Elin | 16 | 32 | 370 | 5,920 |
| Ivo | 16 | 32 | 378 | 6,048 |
| Nell | 16 | 40 | 466 | 7,456 |
| Bram | 16 | 40 | 466 | 7,456 |
| Pip | 16 | 37 | 418 | 6,688 |
| Wren | 16 | 37 | 418 | 6,688 |

## Action package shot lists

Counts are deliberate production specifications. Sample slow cycles at about 12 unique frames/second and sharp reactions at 18–24 where needed; record a duration for every clip rather than forcing all clips to the same speed. Keep continuous source animation in Blender so sampling can be revised after review.

### human-core

| Action | Frames per heading |
|---|---:|
| idle | 8 |
| walk | 12 |
| run | 12 |
| start-moving | 4 |
| stop-moving | 6 |
| turn-left-90 | 8 |
| turn-right-90 | 8 |
| look-around | 12 |
| talk | 12 |
| wave | 12 |
| startled | 8 |
| disappointed | 12 |
| pick-up | 12 |
| put-down | 12 |
| jump | 12 |
| land | 8 |
| hand-vault | 16 |
| climb-up | 16 |
| climb-down | 16 |
| roll-recover | 16 |

Package total: **222 frames per heading, 3,552 at 16 headings**.

### human-rest

| Action | Frames per heading |
|---|---:|
| sit-down | 12 |
| seated-idle | 8 |
| stand-from-seat | 12 |
| drink-from-cup | 16 |
| wipe-sweat | 12 |

Package total: **60 frames per heading, 960 at 16 headings**.

### farm-work

| Action | Frames per heading |
|---|---:|
| hoe | 16 |
| harvest | 16 |
| plant | 12 |
| water-plants | 16 |
| carry-basket-walk | 12 |
| lift-basket | 12 |
| lower-basket | 12 |
| push-wheelbarrow-empty | 12 |
| push-wheelbarrow-loaded | 12 |
| start-wheelbarrow-empty | 8 |
| start-wheelbarrow-loaded | 8 |
| stop-wheelbarrow-empty | 8 |
| stop-wheelbarrow-loaded | 8 |
| load-wheelbarrow | 16 |
| unload-wheelbarrow | 16 |

Package total: **184 frames per heading, 2,944 at 16 headings**.

### trade-work

| Action | Frames per heading |
|---|---:|
| carry-sack-walk | 12 |
| lift-sack | 12 |
| lower-sack | 12 |
| push-cart-empty | 12 |
| push-cart-loaded | 12 |
| start-cart-empty | 8 |
| start-cart-loaded | 8 |
| stop-cart-empty | 8 |
| stop-cart-loaded | 8 |
| load-cart | 16 |
| unload-cart | 16 |
| offer-item | 12 |
| receive-item | 12 |

Package total: **148 frames per heading, 2,368 at 16 headings**.

### baker-work

| Action | Frames per heading |
|---|---:|
| carry-basket-walk | 12 |
| receive-item | 12 |
| offer-item | 12 |
| kneel-work | 12 |
| knead-dough | 16 |
| place-bread | 12 |
| retrieve-bread | 12 |

Package total: **88 frames per heading, 1,408 at 16 headings**.

### herder-work

| Action | Frames per heading |
|---|---:|
| shoo | 12 |
| beckon | 12 |
| reach-to-catch | 16 |
| guide-animal-walk | 12 |
| scatter-feed | 16 |
| fill-trough | 16 |
| inspect-animal | 12 |

Package total: **96 frames per heading, 1,536 at 16 headings**.

### child-play

| Action | Frames per heading |
|---|---:|
| skip | 12 |
| chase | 12 |
| crouch-pick-up-ball | 12 |
| hold-ball | 8 |
| wind-up-throw | 8 |
| throw-ball | 12 |
| catch-ball | 12 |
| kick-ball | 12 |
| stumble | 12 |
| get-up | 12 |
| cheer | 12 |
| shrug | 12 |

Package total: **136 frames per heading, 2,176 at 16 headings**.

Assignment: Mara, Nell and Bram receive `farm-work`; Tomas `trade-work`; Elin `baker-work`; Ivo `herder-work`; Pip and Wren `child-play`. Shared action names mean compatible timing/contracts, not the same rendered body. Retarget the motion and repair contacts per character.

Work actions need anticipation, planted support feet, weight shifts, follow-through and a clear return pose. A loaded wheelbarrow changes gait and torso lean. Bram moves with a heavier settling response. Children take shorter steps and use their own crouches and throws. Do not replay a generic walk while only the tool moves.

Turn clips are actual planted-foot turns. Hold the input orientation at the clip's start and hand off its final heading once; do not rotate the body in the animation and apply the same turn a second time in the runtime. Chained turns cover larger angles. Look-around should turn eyes/head before shoulders and should not rotate the feet without a step.

For throws, detach the ball at the release event and let the scene own its flight. For catches, attach it at hand contact. Never show both a ball baked into a hand and the same airborne ball. For animal handling, pair reach and reaction using contact markers; avoid a human grasping empty air.

## Animal roster and full action sets

Create **seven first-batch animal designs**, then the two optional birds. Sheep, cows, hens and roosters require different skeletons or species-appropriate rigs. Retargeting within a species is allowed after silhouette, foot-contact and weight checks. Every coat variant below gets its own final rendered art; no in-game pixel recoloring.

| Design | Identity |
|---|---|
| `ewe-cream` / Cream ewe | Rounded wool mass, narrow legs, relaxed ears; no horns. |
| `ram-grey` / Grey ram | Heavier neck and chest, curled horns, grey fleece; distinct silhouette from ewe. |
| `cow-brown-white` / Brown-and-white cow | Broad barrel, large white patches, brown head, short horns and visible udder. |
| `cow-dark` / Dark cow | Slightly taller and leaner, dark coat, white forehead blaze, different horn shape. |
| `hen-brown` / Brown hen | Round red-brown body, small comb and short tail. |
| `hen-speckled` / Speckled hen | Lighter speckled feathers, slimmer body, different comb and tail. |
| `rooster` / Rooster | Taller body, red comb, layered green-black arched tail and clear wattles. |
| `crow` / Crow (second batch) | Small black corvid, grey-black feather breakup, heavy bill; avoid featureless silhouette. |
| `eagle` / Eagle (second batch) | Large brown raptor, hooked beak, broad wings and visible primary feathers. |

Quadrupeds receive `quadruped-core` plus their species extras. Both hens receive `poultry-core`; the rooster receives that plus `rooster-extra`. Each bird receives `bird-core`. Render all these actions in 16 directions, including feeding and displays, not just locomotion.

### quadruped-core

| Action | Frames per heading |
|---|---:|
| idle | 8 |
| walk | 12 |
| trot | 12 |
| start-moving | 4 |
| stop-moving | 6 |
| turn-left-90 | 8 |
| turn-right-90 | 8 |
| look-around | 12 |
| lower-head | 6 |
| graze | 16 |
| raise-head | 6 |
| drink | 16 |
| chew | 12 |
| lie-down | 12 |
| rest | 8 |
| stand-up | 12 |
| startled | 8 |
| flee | 12 |
| social-nuzzle | 16 |
| threaten | 12 |
| recoil | 8 |

Package total: **214 frames per heading, 3,424 at 16 headings**.

### sheep-extra

| Action | Frames per heading |
|---|---:|
| bleat | 12 |
| headbutt-display | 16 |
| shake-wool | 12 |
| scratch | 12 |

Package total: **52 frames per heading, 832 at 16 headings**.

### cow-extra

| Action | Frames per heading |
|---|---:|
| moo | 12 |
| head-warning | 16 |
| lick | 16 |
| tail-swat | 8 |

Package total: **52 frames per heading, 832 at 16 headings**.

### poultry-core

| Action | Frames per heading |
|---|---:|
| idle | 8 |
| walk | 12 |
| run | 12 |
| start-moving | 4 |
| stop-moving | 6 |
| turn-left-90 | 8 |
| turn-right-90 | 8 |
| head-cock | 8 |
| peck | 16 |
| drink | 12 |
| scratch-ground | 16 |
| dust-bathe | 20 |
| wing-flap | 16 |
| startled | 8 |
| flee | 12 |
| rest | 8 |
| settle | 8 |
| rise | 8 |
| cluck | 12 |
| warn | 12 |
| chase | 12 |
| hop | 12 |
| land | 8 |

Package total: **246 frames per heading, 3,936 at 16 headings**.

### rooster-extra

| Action | Frames per heading |
|---|---:|
| crow | 16 |
| wing-display | 16 |
| spar-display | 16 |

Package total: **48 frames per heading, 768 at 16 headings**.

### bird-core

| Action | Frames per heading |
|---|---:|
| perch-idle | 8 |
| turn-left-90 | 8 |
| turn-right-90 | 8 |
| look | 12 |
| hop | 12 |
| takeoff | 16 |
| flap-flight | 12 |
| glide | 8 |
| bank-left | 12 |
| bank-right | 12 |
| land | 16 |
| preen | 16 |
| call | 12 |
| threat-display | 12 |
| feed | 16 |

Package total: **180 frames per heading, 2,880 at 16 headings**.

Animal acting rules:

- Walking is a leg cycle with weight transfer and stable planted contacts. Running uses a different gait, not faster sliding. Tail and ears follow with slight delay.
- Eating has separate approach, head lowering, bite/peck, chew and head-raising beats. Grazing and hay feeding may share a chewing clip only if their contact heights match; otherwise author a height-adjusted version before use. Initial counts cover ground grazing and a correctly positioned low feeder.
- Drinking puts the mouth at the declared water height. Chickens must raise their heads between sips. Cows and sheep should not inherit that motion.
- "Taunting" means species-appropriate signaling: lowered ram head, warning head toss, rooster wing display, crow call or eagle wing spread. Pair it with another animal looking, recoiling or responding. Do not make every species perform the same human-like gesture.
- A fence display stays on its side of the fence. Rams may make a brief supported lunge; cows must not jump like sheep. Escape uses a real gap or an explicitly authored, physically appropriate traversal.
- Render fronts, backs and intermediate views. The udder, horns, wool, wing attachments and tail must remain in the correct place through every turn.
- Bird flight frames contain wing movement and banking. World translation and altitude remain scene-owned. A bird circling is not a stationary cutout orbiting a point without banking.

| Animal design | Reference images | Clips | Frames per heading | Final body/action frames |
|---|---:|---:|---:|---:|
| Cream ewe | 16 | 25 | 266 | 4,256 |
| Grey ram | 16 | 25 | 266 | 4,256 |
| Brown-and-white cow | 16 | 25 | 266 | 4,256 |
| Dark cow | 16 | 25 | 266 | 4,256 |
| Brown hen | 16 | 23 | 246 | 3,936 |
| Speckled hen | 16 | 23 | 246 | 3,936 |
| Rooster | 16 | 26 | 294 | 4,704 |
| Crow (second batch) | 16 | 15 | 180 | 2,880 |
| Eagle (second batch) | 16 | 15 | 180 | 2,880 |

## Tools, wheelbarrows and carried objects

Produce 12 modeled designs: hoe, rake, shovel, sickle, pitchfork, watering can, harvest basket, grain sack, wheelbarrow, ball, water bucket and shepherd crook.

For each tool, request **eight reference images**: two design candidates, four orthographic views of the chosen design, one correctly gripped example and one in-scene scale example. Total: **96 tool reference images**. Attach the approved character hand reference to the grip request. One handle must remain one handle, with consistent dimensions across all images.

Render ground/placed versions in 16 headings. Hoe, rake, shovel, sickle, pitchfork, ball and crook have one initial placed state. Watering can, basket, sack, wheelbarrow and bucket have two: empty/filled for vessels and barrow, and closed/open for the sack. That is **17 states × 16 headings = 272 placed-object frames**, separate from the character-animation totals.

For held actions, bake the character and tool together in the same render pass. Hands wrap around the handle, the far hand can disappear behind it, and the shaft passes in front of or behind the torso correctly. Those images are already counted in each occupation package. Do not add a generic hoe, hat, basket or wheelbarrow overlay after rendering. If a free-swappable equipment system is later needed, export synchronized front/body/back layers with per-frame sockets and depth; that is additional pipeline work, not permission to substitute vectors.

For every work clip, author these contacts: left grip, right grip, tool tip, support feet, and wheel axle/contact when applicable. Wheel rotation follows distance traveled. Hoe and shovel contacts stop at the soil instead of tunneling through it. Harvest appears in the basket or barrow after the transfer event, not before. Dropped tools switch to the matching placed object at release without a scale or lighting jump.

## Copy-ready image prompts

### First character concept

> Create one original full-body character design for the Littlelands isometric village. [PASTE THE ART-DIRECTION PARAGRAPH.] Character: [PASTE ONE ROSTER BRIEF]. The attached cottage and barn define material detail, palette and lighting. This must be a distinct person with a distinct face, body silhouette and garment construction, not a reskin of the hero. Neutral relaxed stance, full hands and feet visible, unobstructed anatomy, plain neutral background, no scenery, no text, no dramatic camera or depth of field. Produce one candidate image, not a sprite sheet. Keep working-age adults clearly adult and the child designs clearly their specified age, in ordinary fully clothed village clothing.

### Consistent follow-up reference

> Use the attached approved character as the identity source. Preserve exact face, body proportions, hairstyle, garment seams, accessories and colors. Show only the [FRONT / REAR / LEFT SIDE / RIGHT SIDE / SPECIFIED THREE-QUARTER] neutral modeling view. The unseen side must be anatomically coherent and consistent with the other approved references. No redesign, no new accessories, no cropping of hands or feet. One full-body image on a plain background. This is a modeling reference, not an animation frame.

### Animal concept

> Create one original [ANIMAL DESIGN] for the same Littlelands village art style. [PASTE ART DIRECTION AND SPECIES BRIEF.] Correct species anatomy and weight-bearing stance, clear joints and all visible feet, anatomically attached ears, tail, horns or wings. Preserve realistic relative size against the supplied adult-height reference. No cartoon eyes, no vector outline, no toy-like surface. One whole animal, plain background, no floor shadow. This is a source-design reference; do not fake a walk by leaning a standing pose.

### Action key-pose correction request

> Using only the approved character and tool references, show the [ANTICIPATION / CONTACT / RECOVERY] pose for [ACTION]. Keep the exact identity and clothing. Specify the supporting foot, gripping hands and target contact point. The character's weight must be supported. Do not change the tool dimensions or camera. One pose only. This supplements the rigging reference; the production animation will be authored and rendered from the rig.

Action correction images are optional rework and are not included in the fixed reference budget. Do not request them for every animation frame.

## Render and package delivery

1. Start with a calibrated source scene and approved turntable. Render at 3× the final frame dimensions, then downsample once. Keep PNG masters with alpha. Human delivery cells start at 128×176, large quadrupeds 176×144, poultry 96×96 and birds 128×128; enlarge the bird flight cell or a tool-work cell when the full silhouette needs it. These are cell envelopes, not a command to stretch anatomy to fill them.
2. Use one consistent cell and anchor across the directions of a clip. Work clips may need a larger envelope than idle. Keep logical world scale and foot anchors identical when changing envelopes. Never crop off a pitchfork, horn, wing, skirt or lifted hand to keep a cell size.
3. Export names as `asset/action/d00/f000.png`. Record duration, loop/one-shot, frame count, headings, ground pivot, logical scale, root-motion policy, action entry/exit poses and contact/event times in the render manifest.
4. Loop frames sample `[0, duration)` with no repeated final image. One-shot actions include a usable end pose. Never reverse climb-up to stand in for climb-down; descending support and weight transfers require a separate clip.
5. Metadata needs left/right foot plants, left/right hand grips, tool tip, feeding/mouth point, frame bounds and any release, catch, bite, hit, load or unload events. Hand-vault frames need a per-frame support anchor and a support window, as the current engine already expects for that action.
6. Render ground-contact/cast shadows separately. Prefer shared inexpensive ground-shadow shapes for mobile unless the scene truly needs a unique articulated shadow. Shadow frames, masks and contact-sheet thumbnails are additional exports, not counted in the body-frame totals.
7. Keep transparent edges clean. Pack atlas pages with at least two pixels of color extrusion plus transparent spacing; generate mip-safe padding when downsampling. Limit runtime pages to a proposed 2048×2048 maximum and split actions/direction groups when necessary. The current single-image clip schema will need a page-aware importer before split atlases can be used.
8. Produce full 16-direction source sets. A mobile derivative may select eight real directions and fewer temporal samples from those renders; it must not invent missing views by mirroring. Changing frame count must preserve clip duration and event timing. Retain 16 directions for close inspection where the device budget permits.
9. Separate common movement pages from work, interaction and rarely used reaction pages. Decode only nearby actors' active and imminent actions, with shared immutable pages and an eviction budget. Do not preload the entire production inventory into the browser.

A single uncompressed 128×176 RGBA frame is 90,112 bytes. Twelve walk frames across 16 headings are about 16.5 MiB for just one character, before padding or extra copies. WebP file size does not predict decoded memory. Target a provisional 32 MiB resident NPC/animal page budget on mobile, then measure total CPU/GPU copies alongside terrain and the player. This budget is a delivery target, not a capability the current loader already enforces. If it fails, change LOD/page residency; do not quietly reuse the hero or drop actions.

### Integration baseline when this brief was written

Verify these boundaries against the affected code before production; later asset and loader work may supersede this baseline.

`tools/bake-map-character.mjs` is an example, not a general production baker: it hardcodes `adventurer.gltf`, a small clip list, frame sizes and output filenames. Do not run it over new source art expecting these packages to be exported. The current map renderer chooses a limited action set; the village renderer approximates many reactions and tools procedurally. Arbitrary role/species clips, page streaming, event-based prop transfer and the full clip manifests above still need engine integration. Keep those tasks separate from asset approval and never claim an imported atlas automatically enables a routine.

## Pilot review and production

Technical and visual review means the implementing agent or artist inspects the assets in context, records evidence and corrects defects. It is not an automatic request for user permission after each step. Ask the user to choose when an unresolved identity or style decision needs their judgment, or when they explicitly requested a checkpoint. Missing physical-phone measurements remain an unverified delivery criterion; they do not prevent useful offline asset work.

1. Establish the pilot designs for Mara, Bram and Pip first, alongside one ewe, one cow and one hen. These expose adult, heavy-body, child, quadruped and bird-like anatomy problems early.
2. Before full production, render idle, walk, turn, feeding/work and one interaction for those six. Review the frames at their actual on-map size and at 2× zoom beside the cottage door, crops and fence. Review every heading; enlarged contact sheets alone are insufficient.
3. Reject identity changes, changing hand counts, foot skating, joint inversion, independent drifting tools, silhouette popping, flickering hair, incorrect facing, baked floor plates, halos or mismatched light. Check the belly and arms on Bram, age and stride on Pip, hoof contacts on the cow, and head/neck feeding on the hen.
4. Review each full loop forward, slowly, and frame by frame. Review transitions into and out of the action, including interruption before contact, during contact and during recovery. Confirm transfer events never duplicate or lose a prop.
5. Play the same assets using Canvas2D and WebGL2 at identical resolution and camera settings. Measure sustained frame time and resident memory on the target phone with the intended visible population. A prettier screenshot is not a performance pass.
6. Resolve pilot design and motion defects before scaling the same process to the remaining cast and clips. Track any unverified performance criteria separately; do not describe the full delivery as mobile-validated until measured. Keep rejected placeholders out of the finished NPC selection list. Keep the old files only for backward compatibility while saved maps are migrated.

## Inventory summary

- First batch: **8 human designs + 7 animal designs**. **240 character/animal reference images**, plus **96 tool references**, for **336 image-generation outputs** before optional rework.
- Full first-batch body/action delivery: **84,192 rendered frames**, plus **272 placed-tool frames**. These come from offline animation renders, not 84,192 separate generative-image requests.
- Optional crow and eagle: **32 more reference images** and **5,760 more rendered frames**.
- All planned references including birds: **368**. All body/action frames including birds: **89,952**, plus the 272 placed-tool frames. Shadows, review sheets, LOD derivatives and padding are not included in those counts.
- The machine-readable per-character inventory is [npc-asset-shot-list.csv](npc-asset-shot-list.csv). Its counts are for the proposed full production set, not what a browser loads at once.
