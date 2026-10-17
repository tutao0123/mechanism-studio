# A humanoid, revealed

![Unitree G1 link-level exploded study with source credit](../../docs/media/humanoid-g1-preview.jpg)

A **35.555556-second English looping study** of the complete 29-DoF Unitree G1
visual description from MuJoCo Menagerie. Thirty source bodies expand in eight
ordered groups, two close views explain the arm and leg chains, and the groups
return in reverse order to their unchanged source rest placements. White
surfaces, fine black edges, atlas-style serif type, near-part names and short
leaders follow Mechanism Studio's current presentation modules.

This is a real sourced **MJCF visual assembly**, not a native STEP or detailed
manufacturing assembly. The source contains 35 visual occurrences merged into
30 semantic body meshes, retaining all **393,270 triangles**. Twenty-nine hinge
joint declarations and a free joint remain as source evidence; the presentation
uses the static zero-joint pose and authored display offsets. It does not animate
a simulated gait or solve balance, dynamics, contacts or service clearance.

## View

From the repository root:

```sh
npm ci
node examples/humanoid/serve.mjs
```

Open **http://127.0.0.1:4182/?clean=1** and click **Play with music**. Use pause,
seek, restart, free exploration and **Color cues** as supported by the shared
study shell. Sound starts from a user gesture; silent viewing retains the text
and animation. Reduced-motion preferences initially pause the presentation.
The dedicated read-only server exposes only the example's explicit viewing
assets and required shared runtime files; it does not call a speech service.

## What the short explains

| Passage | Presentation |
| --- | --- |
| Whole | Establish the assembled G1 in its retained zero-joint source pose |
| Separate | Torso, shoulders, elbows, wrists, hips, shanks, ankles and feet move in eight source-bound groups |
| Upper-body detail | Read the shoulder-yaw and wrist/hand names near the settled arm chain |
| Lower-body detail | Read the knee/shank and ankle/foot names near the settled leg chain |
| Return | Reverse the display separation and restore the original placements |
| Resolve | Hold the reassembled structure and source credit before looping |

Names appear in sequence, remain for their scene and fade together on the next
scene. Restrained color accents follow the same source IDs. Deliberate detail
cuts avoid fitting the model on every frame; cameras, labels, appearance,
separation and sound share one timeline.

## Source identity and detail limits

The pinned source is
[`google-deepmind/mujoco_menagerie/unitree_g1`](https://github.com/google-deepmind/mujoco_menagerie/tree/71f066ad0be9cd271f7ed58c030243ef157af9f4/unitree_g1),
revision `71f066ad0be9cd271f7ed58c030243ef157af9f4`. The robot model is by
**Unitree Robotics**; Menagerie contributors curate/adapt the MJCF. The model
directory's [BSD-3-Clause license](source/unitree_g1/LICENSE) covers its XML and
meshes. The repository-wide Apache license is not substituted for this model's
own license. No source-author endorsement is implied.

All 39 retained upstream files are byte-pinned in
[`source/provenance.json`](source/provenance.json). The exporter retains original
body parents, normalized quaternion placements and metre units, converting the
Z-up source to Y-up display once. Original source files are not rewritten.
See the [source/conversion guide](source/README.md) and
[`assets/build-report.json`](assets/build-report.json) for evidence and hashes.

**This source does not provide screws, motor windings, reducers, bearings or
actuator internals as separately identified CAD components.** The head is a
visual owned by the torso; the rubber hands belong to wrist-yaw bodies. They are
not fabricated additional joints. A deeper component teardown needs a separately
licensed, sufficiently detailed assembly or an explicitly labeled authored
teaching model. Enlarging or separating these merged meshes cannot recover the
missing engineering structure.

The skill's [assembly-depth contract](../../.agents/skills/mechanism-studio/references/assembly-depth.md)
records requested depth versus available source depth before a detailed
teardown is promised. A separate component source must be labeled as separate
evidence, not silently presented as Unitree's actuator design.

## Music and effects

The original mellow score is **108 BPM, 64 beats**, with a 54 BPM half-time feel:
soft sustained chords, warm bass and sparse felt keys, without drums or
narration. Exactly **1,568,000 stereo PCM frames at 44.1 kHz** produce the
35.555556-second loop. Five short **Kenney Interface Sounds** files retain CC0;
only a sparse selection of separation, focus, return and final-seating events
receive quiet cues. They are editorial sounds, not recorded G1 hardware or
simulated acoustics.

[`audio/music-score.json`](audio/music-score.json) records source group IDs,
exact event beats, mix parameters, input hashes, seed and waveform evidence.
The [audio guide](audio/README.md), [sample provenance](audio/sfx/README.md) and
[sound-library research](../../docs/sound-libraries.md) distinguish original
synthesis from the retained CC0 samples. No Doubao generation is needed; future
narration can use the [optional provider-neutral API](../../shared/voice/README.md).

## Rebuild and check

```sh
# Rebuild retained display geometry: Node plus Python 3 standard library.
node examples/humanoid/build-humanoid.mjs
# Rebuild the deterministic score and the final WAV from retained sources.
node examples/humanoid/audio/build.mjs
# Rebuild the six reviewable source-bound module handoffs.
node examples/humanoid/planning/build-plans.mjs
# Source hashes/vertices/rest/parents, timeline/framing/labels, audio and server.
node --test examples/humanoid/tests/*.test.mjs
```

Viewing requires neither Blender nor MuJoCo. Rebuilding the display requires an
already installed Python 3 interpreter; `MECHANISM_PYTHON` can select its path.
The importer is deliberately limited to the pinned G1 representation, not a
general MJCF interpreter. It does not execute upstream plugins or scripts.
The six JSON handoffs in `planning/` are marked `bound` and describe the
implemented source/timeline/explosion/camera/appearance/annotation adapters;
they are reviewable records, not a universal automatic JSON-plan loader.
Tests compare retained source hashes and source-transformed vertices to the
actual GLB, then exercise recovery, frame bounds, label timing, score identity
and server boundaries. Such checks do not establish manufacturing accuracy or
physical serviceability.

## Video delivery

The local delivery is `output/humanoid-g1-36s-v1.mp4`: **1920×1080, 30 fps,
H.264/AAC**, 35.566667 seconds on the encoded frame grid. The source music/story
loop remains 35.555556 seconds; final frame-grid padding is not a tempo change.
Review through **http://127.0.0.1:4182/review.html** after capture/encoding.
Objective verification and complete native playback are recorded locally;
these do not claim a subjective listening review. MP4s, captured frames
and review reports remain ignored local outputs; a fresh clone includes the
runtime geometry, soundtrack and source adapters rather than a promised video
download. Use deterministic continuous capture and the
[video exporter](../../tools/video/README.md) for a new recording; frame times
and the audio duration must come from the same 35.555556-second arrangement.
Opening the review page before an export exists does not generate the video.

Original Mechanism Studio runtime, adaptation code and independent composition
are MIT. G1 source/derived visual assets retain **BSD-3-Clause** and Kenney
effects retain **CC0-1.0**. Keep the full model notice in accompanying material
when redistributing model assets, screenshots or rendered clips; see
[license policy](../../docs/licensing.md) and
[documentation media notices](../../docs/media/LICENSE.md). The source model and
source-author names do not imply endorsement of this tool.
