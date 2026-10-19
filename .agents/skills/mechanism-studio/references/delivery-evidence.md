# Delivery evidence and version handoff

Use this when delivering a rendered film, handing an example between agents, or
reusing earlier validation after edits. A small documentation change only needs
its relevant checks; it does not require a film manifest or a new export.
This is the orchestrator's delivery record, not a fifth artistic module.

## Keep four conclusions separate

| Conclusion | Evidence to retain |
| --- | --- |
| Implemented | Real entry point, source assets and an adapter; plans alone are not implementation |
| Checked | What actually ran, on which inputs, with results, unresolved limits and unexecuted checks |
| Exported | Actual output bytes/hash, dimensions/fps/duration and the corresponding encoding report |
| Published | Verified remote commit and relevant paths, or an actual published post URL; a local file, Git remote, upload attempt or `release:check` result is insufficient |

Module stages (`concept / bound / validated`) still describe their declared
scope. A validated phase highlight does not establish tooth contact. A posted
MP4 does not mean the source changes are on GitHub. Check the current remote
when asked about publication; historical receipt files are historical evidence.

## Freeze the material that was checked

For a substantial media handoff, keep a project-relative `delivery.json` beside
the example. The [WOLF v4 record](../../../../examples/wolf-actuator/tour-v4/delivery.json)
is a complete worked instance. Record:

- `schemaVersion: 1`, an `id`, and `route` (`Inspect`, `Explain` or `Showcase`).
- `files`: each declared path's SHA-256 and byte length, `role` (`input`,
  `evidence` or `artifact`) and `storage` (`repository` or `local`). Paths are
  relative to the repository root, not to the manifest directory.
- `checks`: a unique ID, `status` (`passed`, `limited` or `not-run`), a concise
  scope/result, and paths of declared evidence files. `passed` and `limited`
  require evidence. A requirement or an intended test is not a passed result.
- `limitations`: remaining engineering and delivery limits. Optional module,
  output-format and capture notes may add context; the checker does not execute
  them or interpret their claims.

Choose inputs that actually affect the claim: source/model identity, renderer,
mechanical adapter, camera, timeline, captions, appearance, audio and relevant
dependency versions. Include the scripts/evidence behind measured source facts.
An author must review this dependency list; the helper does not discover all
imports or prove it is exhaustive. Do not hash the manifest into itself.

Keep generated films, private browser screenshots, raw test logs and machine
paths under ignored local output. Their relative paths and fingerprints can be
listed in the public manifest without shipping their contents. `repository`
means intended package storage, not confirmation that a file was committed or
pushed. Mark ignored generated music as `local` and document its build command.

## Prefer direct frame composition for studies

For study-shell films, prefer rendering each supplied timeline time into a fixed
output frame: read the WebGL canvas pixels, explicitly compose SVG annotations,
titles, chapter copy and credits, then encode the sequence and mux the verified
audio. A canvas-only export omits the DOM/SVG overlays. Set output dimensions and
render scale explicitly so host display DPI or browser-window zoom cannot choose
the output geometry. Keep the authored mechanics, camera and pacing unchanged.

The legacy `capture.frame(seconds)` name identifies the study's deterministic
timeline API; it does not record the screen or produce image bytes by itself.
Record the compositor/version, frame times, fixed layout/output dimensions,
renderer ratio, canvas dimensions, fonts and included overlay layers. Validate
the direct compositor and the complete exported sequence before declaring this
route implemented and checked for a delivery; a proposed module is not evidence.
Use browser screenshots only when the requested output needs that surface or a
direct composition route is unavailable, and record that choice explicitly.

## Validate captured frame geometry

For a browser-screenshot route, also retain its setup with the frame evidence:
CSS layout viewport width/height, visual viewport scale/offsets when available,
browser `devicePixelRatio`, renderer pixel ratio and canvas backing dimensions,
output pixel dimensions, screenshot API and its explicit clip rectangle/scale.
Record surface and beyond-viewport options where the API exposes them. CSS
viewport size, drawing-buffer size and screenshot size are distinct measurements;
matching output dimensions alone do not establish a correctly framed capture.

For either route, calibrate the opening frame and a consecutive test sequence,
then validate **every source frame** against an invariant landmark, such as a
fixed title, rule or credit. Check position and extent/scale as well as pixel differences;
exclude authored changes from the reference region. Record the reference crop,
method, compression-aware tolerance, checked/expected frame counts and flagged
frame numbers/times. Review and resolve each flag before declaring the sequence
passed. If no invariant region is available, record the alternative geometry
check and its limits rather than claiming an unperformed landmark check.

Repeat the landmark/scale check over **every decoded delivery frame**, allowing
for encoding differences, and retain separate source and encoded results. An
unplanned scale/crop jump that also moves static composition landmarks in source
frames indicates a frame-generation defect; it does not establish that the
mechanical camera or line renderer needs changing. Use the actual frame sequence
to localize the failing stage before changing it.

Still samples, contact sheets, hashes, correct dimensions and a clean opening
frame do not prove absence of intermittent flicker. A passing static-landmark
check establishes frame geometry only; motion/line stability still needs
continuous playback review of the delivered film and targeted frame analysis
where artifacts are suspected. State the reviewed coverage and remaining limits.

## Check the handoff

From the repository root:

```powershell
npm run check:delivery -- --manifest examples/wolf-actuator/tour-v4/delivery.json
npm run check:delivery -- --manifest examples/wolf-actuator/tour-v4/delivery.json --require-local
```

The [read-only helper](../../../../scripts/check-delivery.mjs) checks the manifest,
project-scoped paths, size and SHA-256 of each listed file. It never runs shell
commands, changes fingerprints, regenerates media or publishes anything.

Default mode allows absent `local` files and reports them as `unavailable`, so a
fresh public checkout can check its retained package. Missing `repository`
files, changed present files and unsafe paths fail. `--require-local` additionally
requires every listed local file, for checking the full delivery on its authoring
machine. It does not require files that the manifest never listed.

Read file integrity and check-evidence availability separately. A verified
fingerprint establishes identity of bytes. It does not establish that a report's
claims are true, that a screenshot was reviewed, that sound was heard, or that a
film has good framing. The helper labels check status as **declared** for this
reason. Keep actual [layered validation](teaching-and-validation.md) and
[visual/media review](presentation-style.md) in the workflow.

If a renderer input changes, an old report may still have
`evidenceAvailability: "verified"`: its own bytes match the record, but its
results have not been established for the edited renderer. Read the overall
`ok` and file mismatches first. The helper does not infer a dependency graph or
automatically invalidate each declared check; the orchestrator applies the
rules below before reusing its conclusions.

## Change and reuse rules

Use the [invalidation table](module-orchestration.md#invalidation) to decide the
affected checks. If an input changes, do not merely replace its digest to turn
a failed report green. Review its dependents, rerun affected checks, then issue
an updated delivery record. Preserve prior valid cuts and their evidence.

Partial recapture is appropriate only with evidence that the remaining passage
is unaffected. Record the recaptured interval, original edition, frame count,
unchanged camera/time/audio dependencies, boundary comparisons and any measured
differences. Compare transitions and encoded reading sizes as well as source
screenshots. File hashes alone cannot prove an unchanged visual passage.

Delivery-only edits to a plan may follow capture if that plan is not consumed
by the renderer. Record the old/new hash and the reason; retain the historical
capture record. Do not silently rewrite the original measurement history.

## Report completion clearly

Return the working page, relevant local output and reproduction/check command.
Distinguish retained source from locally generated files. State unexecuted audio
listening, missing local evidence, source discrepancies and other material limits.
For authorized publication, record the confirmed destination after success;
after an ambiguous submit, inspect the destination before retrying. No delivery
record grants new permission to publish or broadens the project folder's scope.
