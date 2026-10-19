# Default presentation style

Apply these defaults to new mechanical scenes and tours unless the user overrides them. Free inspection does not need automatic cameras; historical pages are not silently restyled. [Pacing](presentation-pacing.md) owns timing, [motion choreography](motion-choreography.md) coordinates continuous context and repeated-part close-ups, and [tour transport](presentation-tour.md) owns playback.

For an explicitly requested cinematic or technology-film edition, read the optional [Cinematic profile](presentation-cinematic.md). It scopes the perspective camera, dark PBR lighting and sans-serif film typography overrides to that edition; the Atlas defaults below remain unchanged.

## Visual intention and implementation

White background, fine dark contours, pale neutral solids and light volume read as a mechanical atlas. Use whitespace, edge weight and occlusion to explain structure. Avoid triangle wireframes, glow, heavy shadows or decorative UI competing with mechanics. Preserve needed picking, views, cutaway/hiding and explosion/reassembly.

Reuse [study/style.css](../../../../shared/study/style.css) for music studies and [showcase/style.css](../../../../showcase/style.css) for existing tours. They are distinct shells; do not copy a new shell or paste selectors onto unrelated DOM.

The study and [robot annotations](../../../../EXAMPLE_ROBOT/annotations.mjs) implement the new near-label/scene-retention pattern. Older showcase/app.mjs annotation placement has not fully migrated. Reusing the old annotate function alone does not establish these defaults. Geometry-specific [robot framing](../../../../EXAMPLE_ROBOT/framing.mjs) is not an arbitrary CAD framing solver.

## Camera

Use orthographic engineering views by default; existing tour/study uses orthographic cameras. Start directly on the opening planned pose. Real motion/explosion must not trigger frame-by-frame centering, breathing or zoom.

Precompute conservative envelopes for full motion, maximum and intermediate explosion, and relevant process paths, with viewport/label reserves. Replan on actual asset/configuration or viewport changes. Live bounds help verification/manual fit; never drive automatic framing from moving bounds each frame. Trial planning must not mutate source poses.

Choose overview → necessary causal detail → separation/reassembly. Several chapters may share a view. Avoid constant orbit, tracking every moving part, or simultaneous large rotation and zoom. A useful detail may have a small authored entry arc, settled before names appear. For one repeated component, follow its real occurrence from the set into an observation position and magnify with camera framing; keep mesh scale and source rest unchanged.

Continuous transitions capture the actual starting view once and use the common director's quintic smoothstep, shortest azimuth arc and smooth scale. Showcase typically uses 0.6–1s (current profile 0.8s), Explain may use 2.4s; a purposeful approach/extraction may have its own longer authored path. Explicit seek/restart/paused chapter selection cuts to planned pose; exploration return begins from the actual user camera. Prefer a readable contextual transition between whole and detail: approach, soften surrounding solids and edges, then focus. Verify envelopes for all geometry still shown during the fade. Deliberate editorial cuts remain appropriate when they communicate the relationship better; membership changes do not automatically require them. Never reveal a whole arm inside an already tight jaw frame.

Pause freezes transition time. Planned poses are deterministic from chapter/time; interpolated transitions additionally depend on captured start pose/time. Resize preserves phase/play state. Reduced motion pauses autoplay and uses still views until deliberate playback. No second wall-clock camera.

## Near-part names

Default to **at most two short labels** simultaneously. Natural English capitalization and necessary abbreviations; labels name parts/actions while captions explain.

No visible label frame, badge, shadow or heavy background. Use italic serif type, optionally near-white backing for contrast. Neutral leaders are approximately **0.65 CSS px**, color **#92928a**, ending in a **1.4 CSS px radius** point, with **no arrowhead**. Flow arrows are a separate, explained process layer.

Bind real stable IDs or declared process anchors and project the actual current transforms. Prefer visible part outlines: name-to-outline gap around **15–20 CSS px**, useful leader around **10–15 CSS px** after the text-side gap. Adjust for viewport/text; do not stretch diagonally across the model to fixed sidebars or move truthful endpoints to unrelated screen edges.

Introduce one new name, allow reading, retain earlier names within the scene and fade the group before the next scene. Settle moving targets before naming. User-requested per-name dismissal overrides retention. Actual timings are in [pacing](presentation-pacing.md).

Measure/choose near-outline placement at reveal, text/viewport changes or explicit seek; do not flip sides/reflow every RAF while reading. An authored pullback may transform the settled annotation group with the planned camera, keeping endpoints tied to current projection and leaders short. If no readable arrangement remains, hide/re-layout affected labels rather than jittering or mispointing.

Avoid other names, solids, contact regions, controls, captions and credit. Narrow screens shorten names or use adjacent above/below gaps. Reduce/hide a label if necessary; do not shrink unreadably or force remote sidebars. Hide offscreen/hidden/unverifiable anchors instead of clamping them to a frame edge.

Do not reveal labels during large camera changes. A new scene clears the old group. Pause/reduced motion shows already-revealed valid labels readably, without revealing future names or reviving a previous scene.

## Typography and layout tokens

Actual CSS remains authoritative. The following sizes describe the interactive web layout; an encoded video needs its own capture profile below.

| Role | Default |
| --- | --- |
| Page / primary / secondary / separators | #fff / #252525 / #74746f / #d8d8d2 |
| Title/caption/chapter | Georgia, "Times New Roman", serif; normal-weight title |
| Name/eyebrow/model note | Same serif, italic, natural capitalization |
| Controls/status/time | "Segoe UI", Arial, sans-serif; tabular time digits |
| Caption / chapter title | About 16px/1.6 and 29px/1.18 on desktop, responsive |
| Labels | About 16px/1.3 desktop, 13–15px narrow; shorten/rearrange first |
| Containers/navigation | Fine square borders, whitespace, light unfilled controls |

No external font request is required. Phone layouts may scroll vertically; model, text and transport remain reachable. Desktop clean/capture views should fit their intended frame. Keep visible focus, semantic controls and keyboard access.

## Typography for recorded video

Design the recording for its **displayed size**, not only the capture canvas. A 1920×1080 video shown at 640px wide reduces every element to one third: a 16px web label becomes about 5.3px and a 30px label about 10px. Capturing a working webpage at HD resolution does not make that text readable in a social feed.

Keep the existing web layout and typeface choices. Use a scoped capture/export profile for larger text and sufficient reserved space; do not enlarge every interactive page or scale the entire scene as a substitute. For a 1920×1080 capture, useful starting estimates are a **48–56px title**, **30–36px short caption**, **32–40px near-part name** and about **18–20px credit**. These are authoring estimates, not guaranteed readability or a universal minimum. Choose the actual size after the downscale review; key names may need more space or larger type.

- Write one short English observation per shot, normally one concise sentence. Keep labels to a part name or similarly brief phrase. Put source-depth explanations and detailed limitations in the example README or surrounding page, retaining any essential distinction in the frame. Prefer deleting repeated prose to shrinking important text.
- Recompute actual text widths/heights with the capture fonts. Recheck label-to-part leaders, name/name and name/solid intersections, chapter wrapping, credits and camera safety areas. A web-size layout test does not validate the enlarged video labels.
- Keep the short-leader, serif and restrained white-line language. Larger type does not justify remote sidebars, leader endpoints that miss the part, cropped titles or labels sitting over useful contact detail. If two names cannot fit, show one or recompose the shot.
- Review representative frames of the **encoded delivery**, including the densest label/caption shot, at **960px and 640px display widths** without zooming back in. Check a playback segment at those sizes as well: reading time, compression and movement matter. A full-size PNG or browser-only screenshot is insufficient evidence for the final video.
- Preserve required attribution in the delivered media or its accompanying notice according to the source terms. Fine credit is secondary to the mechanical explanation, but must remain intact and legible in its intended credit view; do not hide a legal requirement merely to clear the frame.

Record capture dimensions, actual font sizes, reviewed display widths, representative timestamps and any remaining limitations. Keep “layout checks passed,” “encoded downscale visually reviewed” and “readable during playback” as separate claims; do not mark the latter checks complete before performing them.

## Opt-in alternative styles and drafting grammar

The white atlas stays the default. When the user asks for another look, a study page may name a style from the [style registry](../../../../shared/appearance/README.md#study-styles) through the shell's `appearance` option. The registry's alternative is `blueprint`: white line work on a Prussian-blue sheet, unlit sheet-coloured solids, centre lines on real axes, a ruled title block, and at most one red stamp tied to a real state. The optional [Cinematic profile](presentation-cinematic.md) instead uses a dedicated film adapter; it is not another value in this registry. Build requested alternatives as separate editions next to the default page. Do not switch an existing page or delivery over, because that changes its fingerprints.

These grammar elements may be used in either style when they explain something:

- **Spec labels.** A two-digit index in order of appearance, the name, and one spec line. Compute every number from the model's own data, such as its spec, scene index or measured GLB, and test it. Never type a measurement into a label. Keep the two-label limit and the short-leader placement.
- **Dimensions.** Draw a dimension on the object with extension lines and slanted ticks, between real points. Show it only while every part it measures sits at its assembled rest; a dimension of a displaced state is false.
- **Wave lift.** Within one repeated set, parts may lift one after another, ordered by their geometry, with a small total spread, and return in reverse order. Each part moves along its own real offset; never copy or scale parts.

These ideas come from the MIT-licensed [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) style library and are implemented independently. Copy none of its code, films or assets. Credit it where a page or README describes the style. The [gearbox example](../../../../examples/gearbox/README.md#two-editions) is the reference implementation.

## Acceptance

Inspect real first/last, whole/detail/intermediate/max-explosion frames and intended aspect ratios. Check conservative bounds, no breathing, pause/seek/loop/exploration/resize/reduced-motion behavior, and label reveal/read/retain/fade. Review long text/crowded chapters, truthful anchors, short leaders, credit visibility and no horizontal overflow.

For video, also run the capture-profile and encoded 960px/640px readability review above. Enlarged typography changes the composition and annotation constraints even when geometry and camera paths are unchanged.

Run relevant [camera-plan](../../../../showcase/tests/camera-plan.test.mjs) and [director](../../../../showcase/tests/camera-director.test.mjs) checks plus new adapter bounds/anchors. Existing tests or a reference screenshot do not validate new geometry. No new modeling, TTS or expanded MCP scope is implied by a style change.
