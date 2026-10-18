# Mating Close-up

Use when the reader needs to see how two actual components interact: a gear pair,
a roller and its races, or a supported pin–slot or screw–nut relationship. This
is an internal authoring contract selected by [Mechanism Studio](../module-orchestration.md),
not a new installed skill, mate solver or contact simulation. It coordinates a
local explanation; the mechanism adapter still owns every mechanical pose.

## Responsibility and evidence

Own the chosen relationship, source bindings, observation region, phase-aware
visual cues and the meaning of direction marks. Hand framing to Camera
Direction, color/visibility to Materials & Lighting, and any display offsets to
Assembly & Explode. Read [motion choreography](../motion-choreography.md) for
approach/read/return timing and [visual style](../presentation-style.md) for type,
line and annotation defaults.

A source placement is not proof of a mate. Before animating the relationship,
record the supporting assembly instructions, geometry sections, declared model
or other actual evidence. Distinguish these levels in the handoff:

| Basis | What the close-up can claim |
| --- | --- |
| Visible or authored arrangement only | Illustrative relationship with explicit assumptions; no recovered CAD mate |
| Sourced geometry and consistent kinematic adapter | Source-based relative motion; disclose model idealizations and unresolved discrepancies |
| Separately checked contact model | Only the contact quantities and intervals actually computed and checked |

These evidence descriptions are separate from `concept / bound / validated`
production stages. A visually validated phase cue is still a phase cue. Neither
proximity to a pitch circle nor highlighting two teeth establishes contact
pressure, force transfer, slip, backlash or a collision-free motion range.

## Inputs

| Input | Required meaning |
| --- | --- |
| Observation question | One relationship the reader should understand; requested delivery, existing style and camera/music constraints |
| Scene binding | `geometryRevision`, asset/source references, actual occurrence IDs and parents, units, basis and source-rest transforms |
| Pair or interface | Driver/follower occurrence IDs; for a bearing, the particular roller and both race occurrences; no name-only or shared-definition binding |
| Evidence and mechanical adapter | Supported relation, fixed/moving roles, axes/centers in declared spaces, tooth counts or relevant dimensions, phase/rest offsets, ownership and limitations |
| Local region | Geometry-derived or explicitly idealized pitch-region anchor, section/axial band, local envelope and how it follows the known mechanical state |
| Timeline | Existing clock and intervals for approach, naming, working motion, cue fade and return; angular positions and velocities from the same adapter |
| Appearance and layout | Current selection/isolation policy, maximum retained context, readable video type profile, target viewport and intended cue meaning |

The local anchor is an observation target. Label an ideal pitch-region anchor
as such; do not rename it a measured contact point. A selected repeated planet
or roller remains the same occurrence throughout. Camera magnification changes
image scale, not mesh scale, tooth spacing or source placement.

## Author the passage

1. Establish the pair within the whole assembly. Approach the existing local
   region using the agreed camera path. Fade only context that hides the
   relationship, preserving enough structure to show where the pair belongs.
2. Name each member near its visible outline, sequentially, after the view is
   readable. Apply the existing short-leader and scene-fade rules. Avoid long
   leaders to remote margins or a new stack of explanatory panels.
3. Show the supported working motion. Highlight a small, meaningful surface
   region on each real member rather than flooding the whole mechanism with
   color. For repeated teeth, bind the candidate teeth or surface masks to the
   retained geometry and source phase; compute entry/exit weight from relative
   phase at the observation region. A fixed glow at the pitch anchor is not a
   tooth-following highlight.
4. Show concise rotation marks only while useful and moving. A short local
   arc with a restrained arrowhead can indicate rotation; it is distinct from
   name leaders, which retain their no-arrowhead style. Keep the teeth and gap
   visible. White/pale-neutral solids and fine dark edges remain the base;
   limited pale accent conveys the selected relationship, not heat or stress.
5. Fade the cues before pulling back. Restore the current appearance and
   visibility policy and the established whole view. Leave the original camera,
   chapter duration and music unchanged when that is the user's constraint;
   allocate cues within the existing passage rather than restarting a score.

For gears, distinguish **spin about the gear's own axis** from **orbit of its
center**. Derive each arc's sign from the angular velocity it represents, in an
explicit axis/view convention. A projected clockwise arrow is not universally
correct from the opposite side. If a passage reverses, the mark reverses; near
zero speed it fades or hides rather than implying continued drive. Orbit needs
its own meaning if shown and should not be conflated with absolute gear spin.

Keep geometry, source rest and mechanical transforms untouched by cue creation.
Materials may use occurrence-owned masks or overlay surfaces with a documented
depth policy; these are presentation resources, not new source parts. Prevent
z-fighting and through-solid arrows. Hidden/offscreen parts do not receive
clamped proxy labels or misleading detached cues.

## Output: mating-closeup-plan

Return a compact plan or equivalent example notes with:

- Stage, input revisions and actual pair/interface occurrence IDs.
- Evidence basis, relation/axis conventions, adapter reference and unresolved
  engineering questions. Reuse the adapter's formulas; do not create a second
  independently drifting kinematic model in annotation code.
- Anchor/section and envelope definition, including whether the anchor is
  idealized; approach, naming, motion, cue and return intervals on the common
  timeline.
- Tooth/region bindings, phase window and visibility rules; direction channel
  (spin or orbit), sign convention and zero/reversal behavior.
- Handoffs to camera and appearance, restoration rules, actual implementation
  files, checks performed and limits. A plan is not an executable JSON loader.

For an existing film, also record preserved camera/audio inputs and the changed
passage. If geometry or phase cannot support a tooth binding, return a limited
relationship view or an explicitly illustrative cue, not invented contact data.

## Validation and delivery

Check the invariants that affect the explanation:

- Real pair identity and geometry revision; unchanged source transforms, mesh
  scales, counts and mechanical outputs with cues enabled or disabled.
- Cue regions follow the intended tooth/phase in the declared axial section;
  neighboring teeth enter and leave smoothly. Record the method and tolerances;
  a screen review alone does not validate exact contact.
- Spin/orbit distinction and projected direction during forward motion,
  reversal, rest, and both seek directions. Pause and loop restore deterministic
  cue state, with no independent wall-clock timers.
- Cue visibility, depth, near labels and readable type in the actual renderer,
  including intermediate approach/pullback frames and relevant narrow views.
- Actual exported passage at 640px and 960px width, plus whole-video transitions,
  loop and original audio synchronization. Report technical audio checks
  separately from subjective listening.

An example-specific adapter can demonstrate this contract without becoming a
universal gear, bearing or CAD mating API. Preserve previous valid cuts, source
attribution and applicable asset/media licenses. Module use grants no new
filesystem, account, publication or synthesis permissions.
