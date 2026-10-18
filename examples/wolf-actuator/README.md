# WOLF, layer by layer

The latest [**tooth-pair and direction edition**](tour-v4/README.md) is at
[**`/tour-v4/`**](http://127.0.0.1:4181/tour-v4/). It highlights original
source teeth through their measured herringbone phase and separates sun input,
planet spin and planet orbit into short directional cues. It retains the v3
camera, full 85.71-second story and original music. These are explanatory phase
cues, not a tooth-contact or load simulation. Its
[video review](http://127.0.0.1:4181/tour-v4/review.html) plays the separately
generated full MP4 when available.

The preceding [**tooth-interface edition**](tour-v3/README.md) is at
[**`/tour-v3/`**](http://127.0.0.1:4181/tour-v3/). It follows one original
sun–planet pair into a close-up and pulls back to the complete train, retaining
the 85.71-second story, prior mechanical model, white line style and exact music.
Build the local score with `node examples/wolf-actuator/tour-v2/audio/build.mjs`
on a fresh checkout. Its [video review](http://127.0.0.1:4181/tour-v3/review.html)
plays the separately generated MP4 when present.

The preceding [**complete WOLF motion tour**](tour-v2/README.md) remains at
[**`/tour-v2/`**](http://127.0.0.1:4181/tour-v2/) on the WOLF server.
This **85.714286-second, 160-beat, 112 BPM** edition retains the whole-to-magnet-to-bearing
story and adds gear operation and crossed-roller bearing rotation before their
respective teardown passages. It keeps the existing camera language, white fine
line work, large video typography and gentle original music.

The retained geometry gives 96 sun teeth, 24 per planet, 144 on the output rings
and 156 on the fixed toothed plates. The corresponding signed reduction is
**−31.5:1**, while the upstream README states **34:1**; this unresolved discrepancy
is documented in the [gear evidence](tour/research-v2/gear-evidence.md). The
[bearing evidence](tour/research-v2/bearing-evidence.md) positively identifies
`Part 1` as one of 66 crossed rollers. Its no-slip motion explicitly neglects the
source's 10 μm rolling clearance. These are source-bound ideal kinematics, not
recovered CAD mates, full B-rep contact or dynamics validation.

The [new local video review page](http://127.0.0.1:4181/tour-v2/review.html) is the
entry point for a separately generated MP4. Export and actual encoded-video
checks are separate delivery steps. All earlier editions remain available.

The earlier [**complete WOLF tour**](tour/README.md) remains at
[**`/tour/?clean=1`**](http://127.0.0.1:4181/tour/?clean=1) on the WOLF server.
This continuous **68.571429-second, 128-beat, 112 BPM** edition keeps all **245
source leaves** in one scene: whole-assembly opening → illustrative input turn →
86-part motor and one real magnet close-up → 70-part bearing A and its original
Part 1 close-up → full restoration. One original music track drives the complete
timeline. The limited input turn is an authored interpretation; it does not solve
gear contact, transmission ratio, bearing rolling or CAD mates. Its
[motion evidence](tour/motion-evidence.md) records that boundary.

The [local tour video review page](http://127.0.0.1:4181/tour/review.html) displays
the separately generated MP4 when available. Recording and encoded-media review
are separate delivery steps; local videos are not bundled in a fresh clone.
The earlier whole, motor and bearing cuts below remain available.

For a deeper source-component example, open the separate
[**Inside a WOLF actuator** motor study](detail/README.md):
`http://127.0.0.1:4181/detail/?clean=1` on the same preview server. It follows the
real `motor-8318 <1>` subassembly into **86 independent source pieces**—40 named
`magnet`, 40 generic `cc` pieces and six named hardware components—then restores
the complete actuator. The source name `cc` is not assigned an invented function,
and this WOLF component is not represented as internal hardware of the G1 humanoid.

The separate [**Inside a WOLF bearing** study](bearing/README.md) at
`/bearing/?clean=1` follows 70 actual bearing-A components: four larger layers,
66 small parts, and one original Part 1 extracted into a close-up and returned
before reassembly. Both component cuts use the same fine-line presentation;
their latest local video editions have larger capture-specific captions.

![WOLF actuator STEP-derived parts separated into a line-art assembly study](../../docs/media/wolf-preview.jpg)

*Existing English study frame: WOLF by Anthrobotics, adapted by Mechanism Studio
with tessellation, authored separation, neutral materials, camera and labels.
Model and adapted image retain [CC BY-SA 4.0](source/LICENSE), with
[source and change notice](source/NOTICE.md). This image is excluded from the
repository-level MIT grant.*

The original whole-assembly edition is a 34.285714-second English loop built from Anthrobotics' real WOLF V1.2 STEP
assembly. The study retains every imported leaf occurrence and its source parent
and placement. The source has 245 leaf usages, including twelve separately named
planets, two internal rings, nested bearing assemblies and the motor assembly.
Generic source names such as `Part N`, `cc` and `magnet` are retained as supplied.

Four source-bound groups separate on beats 8/12/16/20 and return in reverse order
at beats 40/44/48/52. Each movement takes two beats. The opening/restored views
match, while rings and gears receive focused inspection chapters. Names appear
near the actual projected silhouette in sequence, persist in the same scene and
fade together before the next. A small planned pullback follows detail reading.
One pale blue accent follows the same name timeline; **Color cues** restores
neutral white-and-black line art. Music uses the project's original quiet code
composition and editorial motion/seating accents with new WOLF identity bindings.
The camera uses a stable Z-up basis so the source Y-axis stack reads across a
landscape frame. This only changes viewing orientation, never source geometry or
assembly placement; the fixed envelope fitter uses the same camera basis.

The shared implementation lives in `shared/study/`, `shared/viewer/` and
`shared/appearance/`. The original whole-assembly cut supplies mechanics-free presentation timing,
source identity selection, envelope framing and English copy. It is deliberately
separate from the robot's URDF-specific adapter.

From the Mechanism Studio root, after the real CAD assets/index have been built:

```powershell
node examples/wolf-actuator/audio/build.mjs
node examples/wolf-actuator/planning/build-plans.mjs
node examples/wolf-actuator/serve.mjs
```

Open `http://127.0.0.1:4181/?clean=1`, then click **Play with music**. The isolated,
read-only server exposes only explicit viewing assets and shared runtime files.
The public repository includes the source STEP, derived GLB, plans and music;
the commands above rebuild the audio/plans when needed. No CAD installation is
required to view the included assets. See the [example catalog](../README.md).
Use `?capture=1` with a 1920×1080 browser viewport for the shared continuous
capture API; mux `audio/wolf-loop.wav` against that same time arrangement.
The complete tour has its own retained score and timeline; rebuild its music
with `node examples/wolf-actuator/tour/audio/build.mjs` and use
`tour/audio/tour-loop.wav` for that edition. See its [guide](tour/README.md) for
the corresponding capture and reproduction steps.

## Source and interpretation

Source: [Anthrobotics/wolf-actuator](https://github.com/Anthrobotics/wolf-actuator),
commit `776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea`,
`CAD/wolf-actuator-assembly.step`, SHA-256
`b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35`.
The retained source and adapted geometry are CC BY-SA 4.0; see `source/LICENSE`,
`source/NOTICE.md` and `source/provenance.json`. Presentation changes are authored
translation offsets, neutral materials, selected detail visibility, cameras,
annotations, colour accents and soundtrack. Upstream also credits Robin Fröjd's
RFX gearbox as inspiration.

This is a real STEP-derived mechanical illustration, with mixed analytic and
source-triangulated geometry. The import identifies 69 source-triangulated
bearing definitions reused across 138 occurrences; these do not become exact
analytic solids merely because they were imported from a STEP file.
Display bounds refer to tessellated geometry, not exact dimensional metrology.
The editorial axis comes from actual front/back plate centres. It is not a
recovered mate, installation axis constraint or proof of dismantling clearance.
The original whole/component cuts do not solve gearing or contact. The newer
`tour-v2` edition derives ideal gear and bearing kinematics with the evidence and
limitations above; it still supplies no torque, contact-force, collision-free
sequence or physical-acoustics simulation. Exploded views restore zero display offsets;
the complete tour also resets its illustrative input rotation. Immutable source
rest placements remain unchanged throughout.

## Current local delivery

[Watch the 34.3-second music clip](http://127.0.0.1:4181/output/wolf-34s-v2.mp4)
while this example server is running. The MP4 and capture proofs are ignored local
outputs, not bundled release files. The accepted recording is `output/wolf-34s-v2.mp4`;
the earlier raw-CDP recording was rejected for a mismatched screenshot crop.
`verification.json` links the actual source, capture, browser and encoder checks.
`output/x-posts.txt` contains the two English draft posts and current posting state.

The clip uses 1,029 complete page frames at 30 fps. Its original 34.285714-second
PCM is padded by 14.286 ms, without respeeding. H.264/AAC decoding, frame count,
audio level, source credit and the encoded contact sheet are checked separately
from subjective listening. Crowded assembled/return views omit names; the ring
and gear details retain two close labels. Source and adapted CAD/clip attribution
remain CC BY-SA 4.0; preserve the author, license and modification notice.
