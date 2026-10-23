# Inside a robot joint

An **original 129-part compact joint actuator**, built locally from a mechanical design specification. Its 36-second English Atlas loop opens the enclosure, separates the motor and reduction stage, visits the motor, gear pair and bearing in close-up, then returns every layer. White surfaces, fine dark edges, nearby labels and an original synthesized score follow one seekable clock.

No external model or speech API is needed. This is an `original-parametric-teaching-model`, not a replica of a commercial actuator or validated manufacturing CAD.

![The original robot joint at 11.8 seconds, with its motor, gear train, supports and fasteners separated](../../docs/media/robot-joint-preview.png)

*Frame from the locally synthesized 36-second, 1920 × 1080, 30 fps Atlas film, reduced to 1280 × 720 for documentation. [Watch the published video](https://x.com/tutao0123/status/2113647451538419915). Original MIT model and presentation. The film uses the code-generated score described below; the MP4 itself is not stored in Git.*

## Generate, preview and export

From the repository root after `npm ci`:

```sh
npm run studio -- generate robot-joint
npm run studio -- preview robot-joint
```

Open **http://127.0.0.1:4198/** and choose **Play with music**. Pause or seek to inspect a stage. Open **Inspect 129 authored parts** below the scene to choose a part by assembly group, or click visible geometry. The same occurrence is selected in the grouped chooser and model; repeated components report their shared definition count. Selection pauses playback. Clear the selection or resume the story to remove the temporary outline.

The generation command runs this example's actual local builder and music source. It does not send a natural-language prompt to a model service. A different mechanism requires an agent-authored specification, geometry builder and suitable runtime adapters; the skill guides that work. The included GLB can also be previewed without rebuilding geometry.

For the direct-frame film workbench, with FFmpeg and FFprobe on PATH:

```sh
npm run studio -- export robot-joint --port 4199
```

Open its printed URL, review the opening and exploded calibration frames, then choose **Generate checked MP4**. Port 4199 keeps the export workbench separate from a running preview on 4198. The adapter samples 1,080 frames at 30 fps in a fixed 1920 × 1080 canvas and combines them with the 36-second score. The browser and CLI remain open during composition. MP4s, frames and per-job reports stay in ignored `output/studio/` directories; they are not committed or published by the command. Adapter availability does not establish that a film has been exported or reviewed: consult the actual job's reports and inspect the completed video.

## The authored assembly

| Group | Part occurrences | Contents |
| --- | ---: | --- |
| Motor and position sensing | 48 | Rotor, 14 magnet blocks, 12 winding packs, stator, shaft, rear journal bushing, sleeve, cap, sensor representations and fasteners |
| Planetary reduction | 20 | Sun, fixed ring, three planets, carrier spiders, pins, bushings, washers, screws and input shaft |
| Shaft support | 26 | Two bearings, each with inner race, outer race, cage and ten balls |
| Reducer enclosure | 33 | Housing, endplates, gaskets, seals, retaining clips and repeated screws/washers |
| Robot-link output | 2 | Output hub and flange |
| **Total** | **129** | **44 reusable geometry definitions; one root and five authored subassemblies** |

The nominal housing diameter is **115.2 mm**; protruding features can extend beyond it. The reducer uses 24 / 24 / 72 teeth, module 1.2 mm and a fixed ring. Its motor-driven sun turns four times per carrier/output turn. Three planets both spin and orbit. The motor is an authored 12-slot / 14-pole arrangement; its rotor, magnets and drive shaft share the sun's ideal angular motion while the stator and winding packs remain fixed.

The rear motor cap also carries an authored plain journal bushing; this is not a rated support design. The two rolling shaft bearings use ideal no-slip, zero-contact-angle rolling with fixed outer races. The motor-side inner ring follows the input; the output-side inner ring follows the carrier. Balls spin independently of their cage orbit. Gear ratios and bearing motion are prescribed kinematics, not force/contact simulation.

`spec.mjs` owns the dimensional and connection assumptions. It reuses the project's original planetary reducer at 0.6 scale, then adds newly authored motor, sensing, housing and flange components. Repeated magnets, winding packs, balls and screws share definitions while retaining distinct `rj:` occurrence IDs and assembled transforms. This assembly tree describes the original design; it is not an imported STEP hierarchy.

## Story and sound

| Time | Scene |
| --- | --- |
| 0–3.6 s | Establish the complete joint |
| 3.6–8.4 s | Release fasteners and open the outer layers |
| 8.4–13.2 s | Show the separated mechanism and component relationships |
| 13.2–19.2 s | Inspect the fixed stator and rotating rotor |
| 19.2–24 s | Follow one sun–planet pair and the ideal reduction |
| 24–28.8 s | Inspect the shaft bearing's balls and cage |
| 28.8–33.6 s | Restore the components and enclosure |
| 33.6–36 s | Return to the complete working joint |

[The original score](audio/README.md) uses 100 BPM with a restrained half-time feel. Sustained chords and sparse rounded notes leave space around reading moments. Quiet synthesized release, movement and seating cues attach to actual authored actions. There is no narration, external sample or service credential.

## Reproduction and evidence

- [`build-joint.mjs`](build-joint.mjs) exports the real geometry and nested identity records from [`spec.mjs`](spec.mjs) and [`geometry.mjs`](geometry.mjs).
- [`assets/scene-index.json`](assets/scene-index.json) and [`assets/scene-contract.json`](assets/scene-contract.json) connect definitions, occurrences, parents, units and rest transforms to the GLB.
- [`assets/provenance.json`](assets/provenance.json) records original authorship and generator input fingerprints. [`assets/build-report.json`](assets/build-report.json) reports the exported counts, bounds, asset digest and structural validation scope.
- [`kinematics.mjs`](kinematics.mjs) owns mechanical poses. [`presentation.mjs`](presentation.mjs) binds the four authoring contracts to those occurrences; display offsets, camera and appearance do not redefine mechanical relationships.
- [`choreography.mjs`](choreography.mjs) owns the 60-beat story and action cues. The audio build binds its output to the geometry and story revisions.

The builder's structural result, mechanism tests, browser framing, subjective listening and delivered-video review are distinct evidence. A successful generation job is not a claim that all of them have been performed.

Run the example's mechanics and presentation checks from the repository root:

```sh
node --test examples/robot-joint/tests/mechanics.test.mjs examples/robot-joint/tests/presentation.test.mjs
node tools/study/check-presentation.mjs --example robot-joint --output output/presentation-checks/robot-joint.json
```

The tests cover real geometry/identity, authored dimensional and kinematic invariants, reversible display offsets, framing and the shared timeline. The numerical report does not certify tooth contact, continuous visual quality or music listening; review a newly exported film separately after any changes.

## Limits and license

This is an original teaching design with tessellated geometry, ideal kinematics and editorial separation. It does not solve electromagnetic forces, commutation, sensing electronics, heat, torque, stiffness, bearing loads, tooth contact or lubrication. Fits, shaft connections, screw threads and preloads are simplified or assumed; the exploded paths are not a collision-checked maintenance procedure. Hidden internals are authored for this design and make no claims about another manufacturer's hardware.

Original code, model and synthesized score: [MIT](../../LICENSE), © Mechanism Studio contributors. Existing project dependencies retain their own notices. No downloaded CAD or third-party mechanical mesh is used by this recipe.
