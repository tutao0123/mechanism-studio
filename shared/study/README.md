# Assembly study shell

New studies can start from [the reusable example template](../../templates/study/README.md)
and `startStudyExample(definition)` in `example.mjs`. The optional plan compiler
provides a shared executable presentation subset; mechanism formulas, source
identity and parent-aware transform conversion remain in the example.

## Executable presentation plan

`compilePresentationPlan(plan, index)` from `plan.mjs` compiles plain JSON data
with `schemaVersion: 'mechanism-presentation-1'`. It has no DOM, Three.js, network
or clock dependency. The index must supply a matching nonempty
`geometryRevision` and a nonempty `parts` array with unique, nonempty `id` values.
The example's real index also supplies the bounds and source transforms used by
its framing and display adapters. The compiler does not derive those fields.
All top-level fields below are required; `?` marks optional nested fields.

| Plan field | Supported data and meaning |
| --- | --- |
| `id`, `geometryRevision`, `bpm`, `durationSeconds` | Plan identity, exact index revision and positive common-clock timing |
| `chapters` | Ordered, contiguous `{ id, firstBeat, lastBeat, title, copy, labels }` records covering the full duration. `labels` contains at most two unique `[partId, text]` pairs; text may also be a spec label `{ index, name, spec? }` |
| `channels` | Authored keys mapped to `{ rise: [start, end], fall: [start, end], cutoff? }` in absolute seconds. Quintic rise/fall produce a weight in `[0, 1]`; cutoff resets it to zero |
| `offsets` | `{ channel, vectors: { [partId]: [x, y, z] } }` entries. World display translations use the example's normalized display units; repeated entries add. Unmentioned parts receive zero |
| `annotations` | `{ windows, fadeInSeconds, fadeOutSeconds }`. `windows` maps every chapter ID to one chapter-local seconds interval per label, in reveal order |
| `cameras` | Every chapter maps to `{ bounds: { min, max }, direction, fillX, fillY, minHalfHeight, up?, distance?, narrow? }`. `direction` points from the bounds centre toward the camera. Optional `narrow` is `{ belowAspect, fillX, fillY }`. Fitting uses this fixed world envelope and the requested aspect, never live moving bounds |
| `appearance` | `{ labelWeight, accents?, opacity? }`. Accent entries are `{ channel, ids, weight }`; opacity entries are `{ channel, ids, minimum }`. Values lie in `[0, 1]`; repeated accents take the maximum, opacity takes the minimum |

Unknown fields, unknown IDs/channels/chapters, stale geometry revisions,
nonfinite values, unsupported JSON values and incomplete chapter coverage throw
before sampling. Compilation copies and freezes the plan; it does not mutate the
input or scene index. Revision matching checks the supplied identity, so authors
must derive that revision from the actual geometry inputs.

The returned object contains `plan`, `BPM`, `DURATION`, `CHAPTERS`,
`normalizeTime(seconds)`, `stateAt(seconds)`, `annotations`, `framing`,
`appearanceCues(state, labelCues)` and `presentationOpacity(state, id)`, plus
normalized `cameraUp` when the plan explicitly declares a common up basis.
`stateAt` returns `time`, `beat`, `chapter`, `chapterIndex`, `localTime`,
`progress` and a complete `offsetsWorld` map. Time wraps at the duration,
including negative seeks. Sampling is absolute and does not accumulate state.

`annotations` supplies `CUE_WINDOWS` and
`annotationCues(state, { paused, cameraSettled })`; unsettled cameras suppress
cues, and paused cues use full opacity inside their windows. `framing` supplies
`cameraFor(chapterId, aspect, localTime)` and `annotationCameraFor` with stable
position/target/orthographic half-height for each shot. The study shell handles
near-part placement, camera transitions and transport. It supports one common
camera-up basis across a presentation; keep custom shot `up` values consistent.

This schema samples presentation data only. It does not validate a claimed
physical removal path, reconstruct CAD, solve joints/contact, infer correct
envelopes, place a pixel-perfect label or execute the full Cinematic profile.
Older `planning/*-plan.json` handoffs are separate records.

## Shared example bootstrap

Await `startStudyExample(definition)` from `example.mjs`. It validates the definition,
creates the shared shell, loads index and provenance once, calls
`createPresentation(index)` and starts the study. A definition supplies its
`id`, UI/credit copy, actual `indexUrl`, `sourceUrl`, `assetUrl`, `contractUrl`,
`scoreUrl`, `audioUrl` and presentation factory. The template shows the complete
definition rather than requiring another copied page bootstrap.

The factory returns `{ plan, timeline, annotations, framing }`, with the needed
existing study hooks such as `workingPoses`, `appearanceCues`,
`presentationOpacity`, `labelObstacleIds`, `labelObstacleBounds`, `detailIds`, `cameraCuts` and `rig`.
Use the compiler's timeline functions and add `localDisplayOffsets` to convert
the sampled world intentions into real display-parent residuals. Keep mechanical
motion in `workingPoses`; any source-specific additions to timeline state remain
explicit adapter code. The [gearbox](../../examples/gearbox/presentation.mjs) and
[Robotiq](../../examples/robotiq-gripper/presentation.mjs) factories show this
split with real model inputs.

The bootstrap exposes `window.mechanismStudy`; optional `globalName` preserves
an example's existing global alias. The study API supplies `play`, `pause`,
`seek`, `reset`, `snapshot` and `ready`, with `capture` only for the explicit
capture query. Omit `appearance` to keep Atlas; choosing a plan does not migrate
other examples or enable a cinematic renderer.

Check a registered example from the project root:

```sh
node tools/study/check-presentation.mjs --example gearbox --output output/presentation-checks/gearbox.json
node tools/study/check-presentation.mjs --example robotiq-gripper --output output/presentation-checks/robotiq-gripper.json
```

The report records `schemaVersion`, `example`, `geometryRevision`, `inputHashes`,
`samples`, `checks`, `manualReview` and `status`. It checks finite offsets/poses,
seek determinism, display reassembly and exact loop reset, cue ranges, unchanged
source/index records, score timing metadata and projection of declared camera
boxes at landscape, square and portrait aspects. Box projection does not prove
moving geometry containment; score metadata does not verify the audio file.
`status: 'automated-passed'` remains separate from
`manualReview.status: 'pending'`. The checker does not open a browser, export
video or establish that visual checks happened. See the
[skill workflow](../../.agents/skills/mechanism-studio/references/executable-presentation.md)
for authoring and evidence boundaries.

## Lower-level study configuration

`createAssemblyStudy(config)` in `study.mjs` owns a page's audio transport, shared
viewer, stable camera director, near-part annotation placement, restrained colour
cues and rendering clock. It does not import an example or supply its mechanics.
Load `style.css`; either retain the matching static DOM or call
`createStudyShell({ title, creditLabel, sourceUrl })` from `shell.mjs` first.

Required configuration:

- `timeline`: `{ BPM, DURATION, CHAPTERS, stateAt, normalizeTime,
  localDisplayOffsets }`. Chapters have `firstBeat`, `lastBeat`, `labels`, title
  and copy; state includes the chapter, index, chapter-local time and complete
  `offsetsWorld` keyed by stable identity. `localDisplayOffsets` accepts the index,
  world offsets, Three.js `Matrix4` and `Vector3` constructors and returns a Map.
- `annotations`: `{ annotationCues, CUE_WINDOWS }`, using that same chapter clock.
  At most two short labels are shown by this shell. Every named target must stay
  stationary while its label is retained; offsets here are display translations.
- `createFraming(index)`: returns `{ cameraFor(chapterId, aspect, localTime) }`.
  A camera plan supplies position, target and orthographic half-height.
  Optional `annotationCameraFor(chapterId, aspect)` provides the settled reference
  plan when a short entry arc finishes before labels appear. Otherwise labels
  retain the existing chapter-start reference. Named solids must stay still.
- `cameraTransitionSeconds`: optional finite nonnegative transition duration;
  omission keeps the existing 0.8 seconds.
- `cameraCuts`: optional chapter-ID array for deliberate edits when the visible
  source solids change between a detail and whole view. A listed chapter cuts
  once on entry; it does not suppress the adapter's authored detail arc. Other
  chapter changes keep the ordinary camera transition. Omission changes nothing.
- `cameraContinuity: 'authored'`: opt in when `cameraFor` already supplies a
  continuous path on story time, including chapter boundaries. The director uses
  one path key and adds no second chapter interpolation; exploration return still
  blends from the actual user view. The adapter must verify seam and transition
  bounds, and hold labels until its own camera movement has settled.
  Optional `stillCameraFor(chapterId, aspect, localTime)` supplies a stable reduced
  motion view; omission keeps the chapter-start plan.
- `workingPoses(state)`: optional complete absolute pose object keyed by stable
  source ID, in the viewer's existing position/quaternion/scale format. This
  writes the `model` wrapper before applying display offsets and never writes
  source nodes. Include identity poses to reset previously active joints. The
  adapter owns source kinematics, limits and any gate between motion/explosion;
  the shell does not infer a joint from an assembly hierarchy.
- `appearanceCues(state, labelCues)`: optional `{id, weight}` array for authored
  action accents; omission preserves named-part accents. The existing complete
  neutral map, colour toggle and selection-layer behaviour remain in force.
- `createPresentationLayer({ viewer, index, viewport })`: optional factory for
  example-specific material regions or explanatory marks. It runs once after
  source loading and matrix setup and must return an object with
  `update({ state, viewer, index, viewport, colorCues, capturing, manualCamera,
  playing })`. Update runs after working poses, observation offsets, the current
  camera and base color cues, immediately before drawing. Sample the supplied
  state on the common clock; do not start another timer or advance mechanics.
  This layer owns only its presentation resources. Preserve source vertices,
  rest transforms, IDs, working poses, camera and audio; respect selection,
  visibility, the color toggle and exploration state. `capturing` identifies an
  explicitly sampled frame, not permission to alter its time. Repeated updates
  at the same state must not accumulate changes. Omission preserves existing
  studies; this hook does not infer mates or supply a universal cue/contact
  renderer. The factory and its resources remain owned by the example adapter.
- `detailIds(state)`: optional list of owned solid IDs to show; `null` shows all.
  Hiding a source wrapper is intentionally avoided because it can hide children.
- `presentationOpacity(state, id)`: optional source-ID-bound value in [0, 1].
  Fades the solid and its owned feature lines together; solid depth surfaces are
  retained to suppress hidden-edge clutter, and zero opacity hides only the owned solid. Source transforms,
  hierarchy and geometry remain unchanged. Existing examples stay opaque when
  this hook is omitted. Labels require at least 0.5 opacity on their named target;
  context below 0.5 is excluded from label obstacles. `labelObstacleIds(state)`
  can explicitly restrict obstacles for an authored detail, without changing
  target anchors. Check contrast and actual overlap in the delivered viewport.
- `labelObstacleBounds(state)`: optional `Map<partId, { min, max }>` of world-space
  obstacle bounds, already including working poses and display offsets. Used
  when the near-label layout is prepared; missing IDs keep the legacy endpoint
  sweep. The adapter must cover the entire retained-label interval, or prove
  those obstacles stationary throughout it. This handles a component opening
  and closing inside one chapter, whose endpoints alone miss its open extent.
  The planetary bearing study supplies settled current bounds and checks its
  reading holds. It does not change real-mesh label anchors or part visibility.
- `appearance`: optional style ID or style object from
  `shared/appearance/styles.mjs`. Omission and `'atlas'` keep the shell's existing
  background, lights, solid fill, feature lines and accent colours value for value;
  the [pixel-identity record](evidence/default-style-pixels.json) shows existing
  pages unchanged. `'blueprint'` adds `body.style-blueprint`: load `blueprint.css`
  with it. A style changes appearance only, never identity, geometry, motion,
  camera, labels or timing. `snapshot().style` reports the active ID.
- Chapter `labels` name a part with a short string, rendered exactly as before, or
  a spec label from `shared/viewer/spec-label.mjs`: `specLabel({ index, name,
  spec })` gives a two-digit index, the name and at most one spec line. Compute
  spec numbers from the example's own model data; never type a measurement by
  hand. Load `drafting.css` for the label lines. Placement measures the whole
  two-line block, and snapshots report the label as plain text.
- `cameraUp`: optional finite nonzero three-component orientation vector. It is
  assigned before OrbitControls is constructed and inherited by annotation
  camera clones. The framing adapter must fit with the same up basis. Omission
  retains the ordinary Y-up viewer; no source placement or geometry is rotated.
- `indexUrl`, `sourceUrl` (provenance JSON), `assetUrl`, `contractUrl`, `scoreUrl`,
  `audioUrl`: actual inspectable source/asset/music paths. The index provides parts
  with `id`, `worldBounds` and original source identity. Music must match the same
  BPM, duration, byte length and SHA-256 recorded in its score.
- `title`, `sourceName`, `creditLabel`, `initialStatus`; optional `documentTitle`
  and `playingStatus`. Credit text supports newlines and is never parsed as HTML.
  Provenance uses `sourceUrl`/`url` and `revision`/`commit` fallbacks.

The returned API exposes `seek(seconds)`, `play()`, `pause()`, `reset()`, `snapshot()` and
`viewer`, `framing`, `index` getters. `.ready` resolves after the model and music
attempts finish, returning the API on successful model initialization or `null`
when initialization fails. Inspect `snapshot().ready` and `.musicReady` separately.
Pause/seek, reduced motion, native audio time and neutral colour viewing retain
the same semantics as the robot reference. UI titles and chapter counts come from
the example, not a hard-coded robot or six-chapter assumption.

## Frame export

Prefer direct frame composition for study films: render the model at each
supplied time, read its WebGL canvas pixels, explicitly add SVG annotations,
titles, chapter text and credits, then encode those frames and mux the verified
audio. Reading the WebGL canvas alone omits all DOM/SVG overlays. The compositor
must use fixed output dimensions and an explicit layout/render scale independent
of host display DPI or browser-window zoom. Preserve the authored camera,
mechanics and timing. Verify the actual implementation and full output sequence
before calling a direct export complete.

### Timeline API

With the explicit local `?capture=1` URL, `.capture` is added. This legacy name
denotes a deterministic timeline API, not screen recording; `.capture.frame()`
updates the model and overlays and returns state, not image bytes:

1. Await `.ready`, then `.capture.start()`. It pauses audio and starts a fresh
   zero-time deterministic render run with continuous camera transitions.
2. Call `.capture.frame(seconds)` in monotonically nondecreasing order within
   `[0, DURATION]`, composing each rendered frame before asking for the next one.
   RAF stays alive but cannot advance the clock. Each chapter boundary captures
   the prior real camera once; export is not a sequence of force-cut seeks.
3. Call `.capture.stop()` to return to a paused, readable ordinary view.

Capture overrides reduced-motion camera stillness only during that explicit
rendering run. It does not play or synthesize audio: mux the verified score file
against the same timeline. Capture CSS hides transport/status/navigation while
keeping chapter explanations and source credit. Set the export layout to
1920×1080 for an HD frame; the page fits that layout without forcing a size on
ordinary readers. The `?clean=1` page remains the interactive viewing mode.

HD capture uses its own type hierarchy: 58 px main title, 46 px chapter title,
36 px explanatory copy and part names, and 18 px source credit. Keep copy short
enough for two lines and measure label placement using the actual rendered font.
Inspect the encoded MP4 at 640 and 960 px display widths as well as full HD;
ordinary responsive web text is not a substitute for video readability review.

The timeline API keeps the WebGL drawing buffer and repaints the same frozen
chapter time when a screenshot or viewport change invalidates the canvas. That
repaint does not advance the clock or restart the camera transition. Wait for
the initial layout and fonts to settle, and verify the actual composed model
and overlays rather than only the DOM or image dimensions.

### Direct compositor API

`direct-frame.mjs` exposes `createStudyFrameRenderer(api, { width, height })`.
The gearbox atlas layout has been exercised in a fixed 1080 × 1080 iframe,
including text, part labels and drafting dimensions. A repeated frame remained
byte-identical across parent viewport/DPR changes. This coverage does not extend
to arbitrary DOM layouts or establish perceptual quality by itself. Set a fixed CSS viewport equal to
the requested output dimensions, including when using a parent-controlled iframe.
The compositor uses the WebGL canvas's owning document/window for layout, then
draws its pixels, SVG overlays and HTML text into the explicit output canvas.
It does not use browser-window screenshots or SVG `foreignObject`.

```js
import { createStudyFrameRenderer } from '/shared/study/direct-frame.mjs';

// api is the study API returned by this example's createAssemblyStudy().
await api.ready;
const frames = createStudyFrameRenderer(api, { width: 1080, height: 1080 });
const canvas = await frames.render(0);
const firstFrame = canvas.toDataURL('image/jpeg', .94);
// Encode/save each returned canvas before rendering the next time n / fps.
```

`render(t)` starts the deterministic timeline automatically and requires
monotonically nondecreasing times. Await each frame; `restart()` begins another
sequence, `snapshot()` exposes its state, and `dispose()` releases the exporter.
Host DPI is not the output-size setting. Validate the actual canvas dimensions,
model content, text, SVGs and complete source/decoded sequences before delivery.

### Browser-screenshot fallback

Use this route when the requested output needs the browser surface or direct
composition is unavailable. Verify the first image against the actual page before
a full loop. A 1920×1080 file can still contain a scaled or cropped browser surface.
Check the full title, chapter text, source credit and part envelope. Set and record
the intended CSS viewport and explicit screenshot clip; for a 1920×1080 CSS
viewport, the CDP profile is
`clip: {x:0,y:0,width:1920,height:1080,scale:1}`, `fromSurface:true`,
`captureBeyondViewport:true`. Use the actual target width/height for other formats.
Record `devicePixelRatio`, the renderer's actual pixel ratio (capture requests 1),
canvas backing dimensions and visual viewport scale/offsets as well. Neither the
default screenshot path nor matching image dimensions guarantees stable scale.
Calibrate the chosen API again per session with consecutive frames. Inspect the
returned byte signature rather than assuming a PNG/JPEG format from a filename.

### Frame validation

For either route, follow the [frame geometry evidence checklist](../../.agents/skills/mechanism-studio/references/delivery-evidence.md#validate-captured-frame-geometry):
check a static title/rule/credit region for position and scale in every source
frame and every decoded output frame, recording coverage and any exceptions.
A successful short test or representative stills cannot rule out intermittent
zoom/crop jumps later in the run. Review continuous encoded playback for motion
and line stability separately from this static-region check.

## Preview servers

Each isolated study example (`EXAMPLE_ROBOT`, `examples/humanoid`,
`examples/gearbox`, `examples/allegro-hand`, `examples/robotiq-gripper`) keeps
its own read-only `serve.mjs` with page-specific routes. The shared runtime
every study page loads is declared once in
`STUDY_RUNTIME_FILES` in `preview-server.mjs`, together with the common
GET/HEAD/range file server. When the shell imports a new shared file, add it to
that list once; do not add `/shared/...` rules to an example server.

`tests/preview-pages.test.mjs` walks every served HTML page of those servers with
`scripts/page-graph.mjs` (HTML tags, import map, ES imports, CSS, and literal
`fetch()` / `*Url:` runtime resources) and fails when a dependency is refused,
missing or unmapped, or when a declared runtime file is used by no page. Files
git ignores, such as rendered video or synthesized music, may be absent. It is a
static check: a green result does not prove the page renders, so still open the
page after a visual change.
