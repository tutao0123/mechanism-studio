# More than gears — a planetary reducer

A **36-second English Atlas showcase** of an original 80-part planetary reducer: working enclosure → outer-layer release → exploded transmission → one sun/planet mesh close-up → bearing teardown and seated rolling detail → complete reassembly. White surfaces, fine black edges, nearby retained labels and the original code-generated score use the shared Mechanism Studio presentation runtime.

## Run and reproduce

From the repository root, after `npm ci`:

```sh
node examples/planetary-gears/audio/build.mjs
node examples/planetary-gears/serve.mjs
```

Open [the study](http://127.0.0.1:4193/) or [the clean presentation](http://127.0.0.1:4193/?clean=1). Click **Play with music** to enable sound. Pause, seek and restart retain the common mechanical, display and audio clock. The included GLB needs no external model download, Blender connection or speech credentials. Without the generated WAV, the page remains a silent visual study.

To rebuild the geometry and its dependent score:

```sh
node examples/planetary-gears/build-planetary.mjs
node examples/planetary-gears/audio/build.mjs
```

The dedicated server uses an explicit local-file allowlist on port **4193**. The root preview does not serve this study under `/examples/planetary-gears/`. Original code, the authored model and its synthesized music use the repository [MIT license](../../LICENSE).

## The authored assembly

| Design quantity | Value |
| --- | --- |
| Sun / planet / internal ring teeth | 24 / 24 / 72 |
| Planet occurrences | Three, spaced 120° apart |
| Module / pressure angle | 2 mm / 20° |
| Sun / planet / ring pitch radius | 24 / 24 / 72 mm |
| Planet-centre orbit radius | 48 mm |
| Physical part occurrences / reusable geometry definitions | 80 / 29 |
| Fixed member / input / output | Ring / sun shaft / carrier hub |
| Ideal input-to-output reduction | 4:1 |

The original 21 individually identified parts remain: sun, ring, three planets, two open carrier spiders, three pins, three **plain journal bushings**, three thrust washers, three socket screws, input shaft and output hub. Their IDs and rest placements are preserved. Version 2 adds **59 meaningful structural components**:

| Added components | Count |
| --- | --- |
| Housing | 1 |
| Endplates with integral bearing/seal seats | 2 |
| Housing gaskets | 2 |
| Housing socket screws / washers | 12 / 12 |
| Shaft seals / bearing retaining clips | 2 / 2 |
| Front and rear shaft-support bearings | 26: two sets of inner race, outer race, cage and ten balls |

The three **planet journal bushings** remain separate from the two new **shaft-support ball bearings**. Gear bores, housing/fastener passages, socket recesses, seal profiles, retaining grooves and concave raceways are actual mesh geometry. Every ball has its own occurrence ID; each cage is one identified part with two rails and joining bridges.

[`spec.mjs`](spec.mjs) declares dimensions, stable `pg:` IDs and attachment assumptions. [`geometry.mjs`](geometry.mjs) generates involute tooth profiles and solid display meshes. [`assets/provenance.json`](assets/provenance.json) records source fingerprints; the [scene index](assets/scene-index.json), [scene contract](assets/scene-contract.json) and [build report](assets/build-report.json) bind the actual exported geometry and hierarchy. Every occurrence is a direct child of the authored assembly; repeated components share definitions while retaining their own identities.

This is **original teaching geometry**, authored from the text brief and declared numerical design. It is not imported manufacturing CAD or a recovered commercial gearbox. Root fillets, fits, retention and screw threads are simplified; ring/housing restraint, rigid attachments and visible clearances are stated assumptions. Version 2 also shortens the existing output-hub flange by 1 mm to remove its overlap with the rear carrier face, preserving the shaft/bore dimensions, ID and rest placement.

## Mechanical motion and the two close-ups

With the ring fixed, the ideal model uses `carrier = sun / 4` and `planet spin = -sun / 2`. The planet's centre follows the carrier while the planet spins about its own axis in the opposite direction. Four sun revolutions restore the gear/carrier poses; they do **not** return the bearing cages and ball material orientations to their starting poses.

The gear shot follows the **existing sun and first planet**, translating both by the same display offset. Their spacing and tooth phase remain unchanged; camera magnification reveals the mesh without scaling or duplicating the parts. Other components fade during this shot, and names settle before the small working-motion demonstration.

The second close-up separates the **13 actual front-bearing components**: two grooved races, one cage and ten balls. Names settle while the parts are stationary. The bearing then seats locally before its working demonstration: its fixed outer race, shaft-driven inner race, rotating cage and orbiting/spinning balls retain their actual occurrence identities. The whole reducer closes afterward.

During that working detail, the outer race becomes translucent so it does not hide the rolling elements. A single 0.7-second recenter accompanies bearing seating after the names fade; the camera then holds a precomputed envelope throughout rolling, without reacting to live part bounds. Fine orientation lines and dots follow the displayed world poses of the actual balls, with small marks on the inner race and cage. These are explanatory ink in [`bearing-cues.mjs`](bearing-cues.mjs), not added physical grooves, extra parts or independent animated objects; the markings make a smooth sphere's material rotation visible.

Both shaft supports use explicit **ideal, zero-contact-angle rolling kinematics** with a fixed outer race. The input bearing follows the sun shaft; the output bearing follows the carrier at one quarter of the input speed. For ball radius `r`, pitch radius `R` and inner-race angle `θ`, the cage angle is `(1 - r/R) × θ / 2`, while the sphere's housing-frame spin component is `-(R-r) × θ / (2r)`. The ball's own spin, its orbit with the cage and its orientation relative to the cage are separate quantities; a bearing fault-frequency number is not used directly as an absolute ball rotation.

| Bearing | Pitch radius / ball radius | Cage turns per local shaft turn | Housing-frame ball spin per local shaft turn |
| --- | --- | --- | --- |
| Input support | 11 / 2.1 mm | +0.404545 | −2.119048 |
| Output support | 14 / 2.5 mm | +0.410714 | −2.300000 |

These equations prescribe motion under no-slip assumptions. Version 3 shifts the groove centres so the nominal zero-angle contacts lie at `R ± r`; the retained 60 μm groove curvature relief is not a uniform radial gap. The tessellated display surface is checked within a 10 μm numerical budget around that analytic contact geometry. Other visible clearances remain deliberate, and no loaded contact, cage dynamics, slip, elastic deformation or bearing life is solved. Bearing parts stop whenever their internal display offsets are separating them; the rolling close-up uses a fully reseated bearing. The housing conceals bearing orientation resets at the 36-second loop boundary, rather than claiming that four sun turns close every bearing pose.

The [mechanical evidence](planning/mechanics-evidence.md) records the tooth-count and spacing conditions, Willis relation, baked phases, transformed-point velocity checks and sampled tooth-profile separation. These checks support ideal prescribed kinematics. They do not establish torque, contact pressure, efficiency, fatigue, validated production fits or continuous 3D collision clearance. Exploded separation is an authored observation aid, **not a service procedure**.

## How the skill drives this example

[`planning/brief.md`](planning/brief.md) records the text-input route, assumptions and deliverable. [`example.mjs`](example.mjs) supplies the shared bootstrap configuration. [`presentation.mjs`](presentation.mjs) compiles a `mechanism-presentation-1` plan bound to this asset revision:

- **Assembly & Explode:** source-ID display offsets separate the enclosure, original transmission and shaft supports, expand one bearing, and restore all 80 components in stages.
- **Camera Direction:** precomputed working/exploded/detail bounds frame the whole reducer, the retained sun/planet pair and the actual front-bearing components. One 0.7-second seating recenter settles into a closer fixed bearing view before rolling begins.
- **Materials & Lighting:** Atlas white surfaces and fine edges, restrained label accents, temporary enclosure transparency and context fading; the closed housing masks the bearing orientation reset at the loop boundary.
- **Mating Close-up:** the example's ideal-motion adapter and explicit phase/velocity evidence support the actual sun/planet pair and shaft-bearing rolling relationship; no loaded contact simulation is implied.

[`choreography.mjs`](choreography.mjs) owns the 100 BPM, 60-beat schedule, mechanical angle timing and action sound bindings. [`audio/README.md`](audio/README.md) describes the original score and numerical audio checks. Music, motion, labels and camera plans share absolute time; there is no narration or external recording.

| Chapter | Time | Focus |
| --- | --- | --- |
| Eighty parts. One mechanism. | 0–3.6 s | Enclosed assembly and ideal motion |
| Open the outer layers. | 3.6–8.4 s | Housing fasteners, endplates and seals |
| A place for every part. | 8.4–13.2 s | Transmission and shaft-support separation |
| Find the driving pair. | 13.2–15 s | Approach the actual sun/planet pair |
| Spin and orbit, together. | 15–19.2 s | Labels, then working mesh motion |
| Inside one shaft support. | 19.2–21 s | Approach the input support bearing |
| Roll, orbit, repeat. | 21–27.6 s | Stationary bearing teardown, reseating, then ball/cage motion |
| Restore every layer. | 27.6–32.4 s | Transmission, enclosure and fasteners |
| Built around a four-to-one ratio. | 32.4–36 s | Assembled motion and loop closure |

## Check and delivery scope

```sh
node --test examples/planetary-gears/tests/*.test.mjs
node tools/study/check-presentation.mjs --example planetary-gears --output output/presentation-checks/planetary-gears.json
```

Tests cover actual GLB identity and geometry, source fingerprints, genuine bores/grooves, sampled ball-to-race/cage surface clearance, ideal gear equations and phase, sphere spin versus cage orbit, material-point velocity residuals, sampled tooth sections, source/display separation, seated bearing motion, audio identity and visual-loop concealment. The presentation checker supplies numerical plan evidence. Analytic no-slip checks and sampled geometry do not establish loaded contact behavior or continuous collision clearance. Browser framing/readability, listening quality and encoded-video review remain distinct checks; a passing test report does not claim those reviews occurred.

## Direct-frame video export

The source release includes the looping webpage, model assets, music generator and direct-frame adapter. Generated WAVs, JPEG sequences and MP4s stay local and are not bundled in Git.

With the study server running, open `http://127.0.0.1:4193/render.html`. Its `window.planetaryFilm` API composes the WebGL scene, SVG annotations and measured text in a fixed 1920 × 1080 document. An automation client must await `ready`, call `start()`, then sequentially await `frame(i / 30)` for `i = 0…1079`. Each result is a JPEG data URL; write its decoded bytes as `00000.jpg` through `01079.jpg` under `examples/planetary-gears/output/film-v3/frames/`. Call `stop()` after the sequence. This alpha exposes the browser adapter; it does not yet provide a one-command browser renderer.

After generating and checking the frames, install FFmpeg/FFprobe on PATH and run from the repository root:

```sh
node tools/video/check-static-region.mjs --help
node tools/video/export.mjs --frames examples/planetary-gears/output/film-v3/frames --audio examples/planetary-gears/audio/planetary-loop.wav --out examples/planetary-gears/output/planetary-80parts-bearing-36s.mp4 --fps 30 --frame-count 1080 --width 1920 --height 1080 --title "Mechanism Studio - More than gears"
```

The `--title` argument is required; this corrects the abbreviated encoding command retained in the historical delivery record. Follow [the export checks](../../tools/video/README.md) for frame geometry, decode, timing and audio verification. Existing exports are preserved unless `--overwrite` is explicitly requested. The dedicated server's `/review.html` can display the resulting MP4 at 390, 640 and 1280 CSS pixels for reading-size checks.

[`delivery.json`](delivery.json) retains the earlier 36-second local export's fingerprints and its stated review limits. Later documented input changes live in `delivery-drift.json`; they do not retroactively claim a new film was rendered or reviewed. A passing integrity check establishes neither publication nor subjective listening quality.
