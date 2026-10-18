# Assembly study shell

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

The returned API exposes `seek(seconds)`, `play()`, `pause()`, `snapshot()` and
`viewer`, `framing`, `index` getters. `.ready` resolves after the model and music
attempts finish, returning the API on successful model initialization or `null`
when initialization fails. Inspect `snapshot().ready` and `.musicReady` separately.
Pause/seek, reduced motion, native audio time and neutral colour viewing retain
the same semantics as the robot reference. UI titles and chapter counts come from
the example, not a hard-coded robot or six-chapter assumption.

With the explicit local `?capture=1` URL, `.capture` is added:

1. Await `.ready`, then `.capture.start()`. It pauses audio and starts a fresh
   zero-time deterministic render run with continuous camera transitions.
2. Call `.capture.frame(seconds)` in monotonically nondecreasing order within
   `[0, DURATION]`, capturing each rendered frame before asking for the next one.
   RAF stays alive but cannot advance the clock. Each chapter boundary captures
   the prior real camera once; recording is not a sequence of force-cut seeks.
3. Call `.capture.stop()` to return to a paused, readable ordinary view.

Capture overrides reduced-motion camera stillness only during that explicit
recording run. It does not play or synthesize audio: mux the verified score file
against the same timeline. Capture CSS hides transport/status/navigation while
keeping chapter explanations and source credit. Set the browser viewport to
1920×1080 for an HD frame; the page fits that viewport without forcing a size on
ordinary readers. The `?clean=1` page remains the interactive viewing mode.

HD capture uses its own type hierarchy: 58 px main title, 46 px chapter title,
36 px explanatory copy and part names, and 18 px source credit. Keep copy short
enough for two lines and measure label placement using the actual rendered font.
Inspect the encoded MP4 at 640 and 960 px display widths as well as full HD;
ordinary responsive web text is not a substitute for video readability review.

Capture keeps the WebGL drawing buffer and repaints the same frozen chapter time
when a screenshot or viewport change invalidates the canvas. That repaint does
not advance the clock or restart the camera transition. Wait for the initial
layout to settle before starting, and verify the actual captured model rather
than only the DOM or image dimensions.

Verify the first captured image against the actual page before recording a full
loop. A 1920×1080 file can still contain a scaled or cropped browser surface.
Check the full title, chapter text, source credit and part envelope. On the current
IAB setup, CUA `tab.getScreenshot({ emit: false })` retains the whole page, while
a raw default `Page.captureScreenshot` produced a mismatched crop. An explicit
full `clip: {x:0,y:0,width:1920,height:1080,scale:1}` with `fromSurface:true` and
`captureBeyondViewport:true` was verified on the current kinetic capture session;
the default CUA screenshot was scaled when the host was at 130% zoom. Calibrate
again per session instead of assuming either path is universally correct. Inspect the
returned byte signature rather than assuming a PNG/JPEG format from a filename.
