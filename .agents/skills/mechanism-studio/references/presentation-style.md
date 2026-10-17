# Default presentation style

Apply these defaults to new mechanical scenes and tours unless the user overrides them. Free inspection does not need automatic cameras; historical pages are not silently restyled. [Pacing](presentation-pacing.md) owns timing and [tour transport](presentation-tour.md) owns playback.

## Visual intention and implementation

White background, fine dark contours, pale neutral solids and light volume read as a mechanical atlas. Use whitespace, edge weight and occlusion to explain structure. Avoid triangle wireframes, glow, heavy shadows or decorative UI competing with mechanics. Preserve needed picking, views, cutaway/hiding and explosion/reassembly.

Reuse [study/style.css](../../../../shared/study/style.css) for music studies and [showcase/style.css](../../../../showcase/style.css) for existing tours. They are distinct shells; do not copy a new shell or paste selectors onto unrelated DOM.

The study and [robot annotations](../../../../EXAMPLE_ROBOT/annotations.mjs) implement the new near-label/scene-retention pattern. Older showcase/app.mjs annotation placement has not fully migrated. Reusing the old annotate function alone does not establish these defaults. Geometry-specific [robot framing](../../../../EXAMPLE_ROBOT/framing.mjs) is not an arbitrary CAD framing solver.

## Camera

Use orthographic engineering views by default; existing tour/study uses orthographic cameras. Start directly on the opening planned pose. Real motion/explosion must not trigger frame-by-frame centering, breathing or zoom.

Precompute conservative envelopes for full motion, maximum and intermediate explosion, and relevant process paths, with viewport/label reserves. Replan on actual asset/configuration or viewport changes. Live bounds help verification/manual fit; never drive automatic framing from moving bounds each frame. Trial planning must not mutate source poses.

Choose overview → necessary causal detail → separation/reassembly. Several chapters may share a view. Avoid constant orbit, tracking every moving part, or simultaneous large rotation and zoom. A useful detail may have a small authored entry arc, settled before names appear.

Continuous transitions capture the actual starting view once and use the common director's quintic smoothstep, shortest azimuth arc and smooth scale. Showcase typically uses 0.6–1s (current profile 0.8s), Explain may use 2.4s. Explicit seek/restart/paused chapter selection cuts to planned pose; exploration return begins from the actual user camera. Deliberate editorial cuts are appropriate when visible-solid membership changes between macro and whole views; verify no newly shown arm pops into a jaw macro frame.

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

Actual CSS remains authoritative.

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

## Acceptance

Inspect real first/last, whole/detail/intermediate/max-explosion frames and intended aspect ratios. Check conservative bounds, no breathing, pause/seek/loop/exploration/resize/reduced-motion behavior, and label reveal/read/retain/fade. Review long text/crowded chapters, truthful anchors, short leaders, credit visibility and no horizontal overflow.

Run relevant [camera-plan](../../../../showcase/tests/camera-plan.test.mjs) and [director](../../../../showcase/tests/camera-director.test.mjs) checks plus new adapter bounds/anchors. Existing tests or a reference screenshot do not validate new geometry. No new modeling, TTS or expanded MCP scope is implied by a style change.
