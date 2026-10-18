# Motion choreography

Use this reference when a timed assembly study feels static, uniform or disconnected, or needs a close-up of one repeated component. This is the orchestrator's **cross-module authoring layer**, not a specialist module, installed skill, physics engine or new runtime API. It coordinates the existing explosion, camera, appearance, annotation and audio adapters on one timeline. For a pair's relative motion and phase/direction cues, use the [Mating Close-up contract](modules/mating-closeup.md).

## Inputs and decisions

Start from actual occurrence IDs, source parents/rest transforms, geometry revision, the [available assembly depth](assembly-depth.md), intended observation and delivery duration. Read the proposed explosion paths, camera envelopes, visibility/appearance ownership and actual score events together.

For each passage record the relationship to show, participating occurrences, context that must remain recognizable, movement/read intervals, transition into the next passage and restoration. These may extend the existing timeline and per-module plans; no new file/schema is mandatory. A written plan has no effect until the example adapter implements it.

## Shape the movement

- Vary tempo by visible size, travel, component role and purpose. A housing can leave steadily, a small nut can separate more briskly, and final alignment can decelerate. These are visual cues to weight and precision, not measured masses or simulated forces.
- Avoid assigning every part the same duration/ease just because they share a stage. Use a small number of source-aware cohorts when repetition would otherwise move as one slab: for example adjacent sectors of a real magnet ring, with a modest overlap between their movements. Preserve each occurrence and actual arrangement; do not invent an assembly order from mesh-array order.
- Give each movement a reason: reveal a joint, distinguish repeated structure, expose a surface, or restore a connection. Avoid decorative bouncing, overshoot, perpetual drifting and unrelated rotation. Threaded unscrewing or joint articulation needs supporting geometry/kinematics; a display offset alone does not establish it.
- Let preparation and return lead into the next useful view. Readable holds belong at the relationship being explained, not automatically after every group. A gentle background transition can overlap when the named target and its leader remain stationary and readable.
- Plan motion from absolute story time, with smooth endpoints and a complete offset state. Do not integrate velocities frame by frame or accumulate displacement on replay. Pause, seek and loop must restore the same state.

The goal is alternating motion and comprehension, not maximizing a motion percentage or shortening every hold. [Pacing](presentation-pacing.md) supplies delivery and reading defaults; each passage may need a different balance.

## Preserve spatial context

Carry at least one recognizable source-backed relationship through overview → component → local detail. Use an authored focus transition: approach the chosen assembly, reduce surrounding contrast/opacity if needed, then enter detail. Do not discard the surrounding solids at full opacity merely because a chapter changed.

Coordinate solid fills **and edge opacity**, depth treatment, picking and label eligibility. Hidden, isolated or already removed parts must not reappear through a focus fade. A cue must affect only the intended occurrences, not every mesh sharing a definition/material. Return restores the current appearance/visibility policy, rather than overwriting the user's observation choices.

During a continuous transition, frame the geometry that is actually still displayed, including fading context and intermediate extraction positions. Fixed envelopes and a planned target/scale path keep the camera stable; changing live bounds must not drive auto-fit. A deliberate editorial cut remains valid when it explains the next view better or no sound continuous composition exists. Document that choice; source membership changes alone do not require a cut.

## A close-up of one repeated part

Use this sequence when useful: **show the repeated set → identify one real occurrence → move that occurrence to a clear observation position → approach with the camera → read its name → pull back → return it to its set → reassemble**. Adjust the sequence to the actual geometry and available duration.

1. Bind one existing occurrence, not just the shared definition or the first matching name. Record its stable ID, source path and group. Prefer an occurrence visible from the planned view and confirm the chosen geometry actually is the named part.
2. Keep that single occurrence throughout. Compose its local observation displacement with the existing group explosion and inherited parent motion. Preserve source rest, mesh vertices, mechanical state and part counts. A focus copy/duplicate, replacement idealized shape or scaled-up mesh breaks this correspondence.
3. Establish its location in the repeated set before extraction. Keep readable context during the departure; accent only the actual selected occurrence if needed. An editorial extraction path does not prove physical clearance, magnetic behavior or serviceability.
4. Magnify using an authored camera move/orthographic half-height, with verified bounds for the real component and any retained context. A close-up changes image scale, not the component's geometric scale. Do not fit changing bounds every frame or combine large orbit, displacement and zoom during reading.
5. Settle both the selected part and camera before its near-outline name appears. Use the existing short-leader, retained-name/group-fade rules. Name the actual component; preserve generic source names where function is unknown. A count such as “40 magnets” describes the verified set, not one enlarged object made to look like the whole set.
6. Fade the close-up name before the target departs. Restore the selected occurrence to its current group position before the group returns, then restore every authored observation offset at the loop boundary. Verify no duplicate remains and final source/rest correspondence is unchanged.

For example, a WOLF source occurrence named `magnet` can illustrate one of its repeated magnets. A generic `cc` occurrence must keep that uncertainty; the close-up does not establish that it is a winding or copper part.

The same sequence applies to a sourced bearing assembly or one of its actual child occurrences. Carry its nested source path into the focus plan rather than selecting by a shared `Part N` name. The supplied WOLF bearing leaves do not, by their names alone, identify rollers, balls or a cage; use the source name and preserve that uncertainty. A source-backed close-up can explain shape and placement without inventing function or adding idealized geometry.

## Coordinate sound and reading

Map sparse effects to **actual motion events**: beginning a separation, an extracted part settling, or final alignment completing. Bind event IDs, affected occurrence/group IDs, time and envelope to the final animation, not a previous revision's scene names. A few significant events are enough; forty repeated parts do not need forty clicks.

Music, effects, motion, camera, fades and annotations sample the same seekable clock. A new label appearing does not itself call for a ding. Preserve space for reading and avoid sound transients on every chapter boundary. See [audio delivery](audio-delivery.md) for measured output, licensing and honest listening evidence.

For recorded delivery, choose the [video typography profile](presentation-style.md#typography-for-recorded-video) before allocating read intervals and label space. Larger video names/captions require measured placement and fewer words, not a blanket extension of every stationary hold. Review the encoded passage at 640px and 960px widths; extra seconds do not make tiny text readable.

## Diagnostics and acceptance

Record the delivered duration and sampled time intervals for part motion, camera motion, target/camera settling and intentional reading/result holds. Report useful diagnostics such as their total durations, longest stationary interval and motion overlap, with the sampling method and tolerance. State whether the calculation covers all displayed parts or only focus parts. Motion/hold intervals can overlap; do not add those percentages as if they were exclusive.

These are review aids, **not pass/fail thresholds or evidence of naturalness**. A long hold may support a complex relationship; constant camera motion can still be unhelpful. Review the complete loop and ask whether each pause pays for readable information and each movement preserves orientation.

For a single-part close-up, verify actual occurrence binding/count, unchanged source/rest/mesh scale, compensated display transforms, context transition and intermediate camera envelopes, settled truthful label, return-to-group and full restoration. Also check forward/back seek, pause/resume, restart/loop, narrow screens and reduced motion. Record tested inputs and limits separately from visual judgment. No choreography check certifies collision-free removal, physical weight, dynamics or hardware-safe assembly.
