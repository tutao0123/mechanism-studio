# Showcase and Explain pacing

Choose pacing before writing captions or motion. [Visual style](presentation-style.md) owns appearance and stable framing; [motion choreography](motion-choreography.md) coordinates useful movement, context and component close-ups; [tour transport](presentation-tour.md) owns clocks. Faster presentation does not require shaking, flashing edits or constant orbit. First select [sound](audio-delivery.md); Showcase does not require TTS. Free Inspect has no timed-loop requirement.

## Routes and pace profiles

| Mode | Purpose and target | Typical rhythm |
| --- | --- | --- |
| Showcase · Detailed, default for new public examples | Readable repository/social presentation; normally **30–40 seconds** per loop | Useful shots often 4–6s, approximately 4–7s as needed; transitions 0.6–1s |
| Showcase · Fast, when the user requests a faster social cut | Concentrated first impression; **18–24 seconds** is a starting target for X unless a duration is specified | Show the mechanism within the first 3s, select fewer observations and retain readable names and a clear action/result |
| Explain | Step-by-step understanding; often 60–90s, longer if needed | More comparison/reading/pause time; existing slower transitions retained |

Fast and Detailed are the two Showcase pace profiles; they are authoring choices, not new runtime modes or an automatic dual-cut generator. Deliver the requested profile(s), not a mandatory set of outputs. An unspecified Showcase retains the 30–40s Detailed default; Explain keeps the authored length its explanation needs. These are defaults, not required chapter counts or equal durations. Preserve existing cuts: the gearbox's **40-second full edition** is Detailed, the approximately 92-second quadruped lesson remains valid, and old inline-four/turbofan tours are not silently shortened. The separate SO-ARM kinetic cut is an explicitly authored **25.714-second** exception, preserving its original approximately 34-second study.

A requested short [Cinematic edition](presentation-cinematic.md) starts with Fast pacing unless another duration is supplied. Cinematic is a visual/audio treatment, not a third pace profile: it can also accompany Detailed or Explain. Its controlled speed ramps, causal close-ups and action-linked score get their own timeline; the gearbox's 24-second / 120 BPM example does not set universal duration or tempo rules.

## Preview speed and authored editions

A request to try **2× playback** can use the existing video's `playbackRate` where
the review player supports it. With `preservesPitch` enabled, pitch is preserved
while musical tempo and visual playback speed increase; caption reading windows
also shorten. A 40s source takes about 20s to watch at 2× but remains a 40s file.
Label this as a playback preview and retain a 1× option. It does not establish a
new 20s authored cut or a newly synchronized soundtrack. The gearbox review
offers 1×, 1.5× and 2×, with 2× initially selected; that control leaves its
40-second source edition intact.

For a requested **Fast Showcase**, author a separate shorter timeline: select
fewer explanatory observations, rewrite captions, remove repeated setup and
allocate meaningful action/result and name-reading intervals. Keep causal
relationships and real part identity; do not obtain the edition solely by
doubling every motion, camera transition and text fade. Readability takes
priority over hitting an exact duration or universal dwell time. When music is
selected, arrange and render a score for the new timeline, with action cues
synchronized to that edition. Verify actual audio/video duration and final text
readability at 1×.

For **Detailed / Explain**, retain or author the context and reading stages the
user needs. Keep each delivered edition's entry point, timeline, captions,
selected audio, duration and evidence distinct while reusing the model and
mechanics. Only claim both pace editions are available after both have real
implementations and checked outputs; a plan or speed control alone does not
supply them.

## Alternate purposeful movement and reading

Choose a small set of visible relationships: orientation → cause/action → readable result → useful expansion/reassembly.

Simple short lift/insertion/separation can use **0.8–1.5s** as a starting estimate, adjusted to travel, size and explanatory purpose. This is not a shared duration for every component or a requirement to stop after each action. Longer extraction, a few staggered cohorts and a continuous approach to detail may span more of the chapter. Do not stretch one motion across the whole chapter or compress every action into the same quick burst by default.

Place holds where the viewer needs to read a name or compare a relationship. Avoid long unchanged passages whose only progression is a new caption. Link useful movements while keeping named targets settled; nearby context may move only when it does not compete with reading. A single-component close-up needs time to establish its origin, extract, magnify by camera, read and return. Shorten other repeated explanation before rushing that correspondence.

Run periodic mechanisms at a readable meaningful speed. Briefly slow/hold a causal event only when needed, derived from the same model/time. Stable framing does not mean slow mechanisms. Avoid covering the critical result with a camera transition.

Short versions have independently authored English captions/narration and action stages. Do not globally speed old audio, set a shorter durationHint or repeat motion until a long track ends and call it a complete short version.

## Runtime profiles

[showcase/presentation.mjs](../../../../showcase/presentation.mjs) centralizes existing Showcase/Explain configuration; transition defaults are 0.8s/2.4s. The existing showcase URL supports mode=showcase|explain and defaults to Showcase only when that story has an actual registered short mode. Older Explain-only stories remain Explain. Standalone examples do not automatically implement those URL modes.

Register actual short lesson/manifest/durations in stories.mjs when using the narrated showcase. Music studies have their own validated timeline and [shared/study](../../../../shared/study/README.md) adapter; do not fabricate speech manifests or assume the old showcase has a music mode. Old showcase annotation timing has not fully migrated to the near-name default below.

Cancel old audio/asynchronous play on mode changes. Use one model and display shell, not duplicate formulas for each cut.

## Scene name rhythm

Arrange **settle → one name fades in → reading hold → next name → optional pullback → whole-group fade → next scene**.

- First name follows target/action/camera settling; a stable opening may name sooner. Fade in typically **0.18–0.25s**, followed by about **0.9–1.2s** of independent reading before the next name. Adjust for length and action.
- Retain revealed names in the scene. If two names cannot fit with reading time, use one; do not slow all assembly motion or cram a second name. Fade the entire group during approximately the final **0.25–0.4s**, with old names hidden at the next scene.
- Optional gentle pullback after reading changes scale about **6–10%**, maintaining direction/target and verified bounds. One useful context reveal, not zoom per name or repeated push/pull. A larger single-part close-up is a separately authored camera passage with labels hidden until settling; it does not enlarge the mesh. Reduced motion uses still plans.
- Names, camera, offsets and sound cues sample the same seekable time. Seek computes the revealed set directly; restart/loop/new scene resets old groups. No setTimeout, previous-loop residue or independent effect timer.

[Robot annotations](../../../../EXAMPLE_ROBOT/annotations.mjs) and [framing](../../../../EXAMPLE_ROBOT/framing.mjs) implement this pattern for their own IDs/chapters; only wrist/grip use the original study's small pullback. The kinetic version settles its short detail arcs before names. New examples need their own targets/ranges/time checks.

## Narration versions and measured duration

Only when Doubao is selected, retain separate lesson/digest/audio/manifest identities for short and full cuts. Existing quadruped uses showcase/voice/quadruped-short versus showcase/voice/quadruped. Camera-only changes do not force speech regeneration.

Write brief English first, synthesize only when explicitly authorized, then decode/probe audio and compute real chapter/loop durations. Word counts/durationHint are estimates. Report a 30–40s narrated delivery only after measurement; shorten content before trimming silences or changing speaking speed. Silent/music work measures its actual display/media timeline instead.

Successful audio playback uses native currentTime. Same-mode silent preview uses the same measured durations/action configuration. Do not leave silent preview at the old full-course time. Missing public MP3s remain a visible fallback; generated speech is not shipped in the public Git package.

## Acceptance

Record actual route/profile, total/chapter durations, action completion/holds and preserved old versions. For a speed preview, record playback rate separately from source duration; for an authored edition, measure its encoded duration and verify its own captions and audio at 1×. Use the [choreography diagnostics](motion-choreography.md#diagnostics-and-acceptance) to identify long stationary passages and awkward overlaps; no fixed motion-percentage threshold defines good pacing. Watch a full delivered loop, key boundaries, pause/resume, forward/back seek, mode switch, exploration, reduced motion and narrow screens. Check required audio paths only. Timing/model checks, actual audio measurements and real visual evidence are separate. Faster pacing does not upgrade engineering claims.
