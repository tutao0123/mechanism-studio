# Source-bound tooth-pair cue

The new cue colours retained source surfaces on **sun-gear** and **planet-4**. It does not replace either gear with a schematic gear and does not change source transforms, tooth count, transmission ratios, camera motion, music, or timing.

## Bound source

- STEP SHA-256: `b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35`.
- GLB SHA-256: `2793c41488d07527d85e5e1f0729096739575f43ed9a5ef93ec0b37079fdd819`.
- Geometry revision: `wolf-b352183e1bd0-2793c41488d0-xcaf-1`.
- Sun occurrence: `occ-b352183e1bd0-root-953098-767` (96 teeth).
- Planet occurrence: `occ-b352183e1bd0-root-953098-774` (24 teeth in the middle band).
- The two different end tooth bands on this planet are excluded from the cue.

This is a visualization derived from [Anthrobotics' WOLF](https://github.com/Anthrobotics/wolf-actuator), whose geometry and derivatives retain CC BY-SA 4.0. The cue code is project-authored MIT code. The existing [gear evidence](../../tour/research-v2/gear-evidence.md) remains authoritative for topology and for the unresolved 31.5:1 geometry versus 34:1 README discrepancy.

## Measured identity, not screen proximity

`tooth-phase-probe.py` intersects the actual world-transformed GLB triangles at 15 axial Y sections between 0.25 and 21.75 mm. Each section uses 16,384 radial rays, verifies the complete-turn peak count, then measures the complex Fourier coefficient at the observed tooth count. The coefficient phase locates a tooth centre modulo one pitch. Phases are unwrapped along the axial direction before interpolation.

Peak positions alone were unsuitable: the tessellated flattened tooth tips can make a peak finder jump along the tip plateau. The Fourier phase is a stable tooth-centre descriptor. This is still a tessellated geometric measurement, not recovery of exact CAD gear parameters.

The actual middle teeth are herringbone. In the first half the sun phase advances roughly 0.664 degrees/mm and the planet phase retreats roughly 2.65 degrees/mm. Both have a short centre plateau and reverse helix in the second half. A simple `atan2 / tooth pitch` mask without axial compensation would incorrectly cut across multiple physical teeth.

`vertexBinding(role, sourceWorldPosition)` assigns a stable tooth index after subtracting the measured axial phase. Its radial mask selects only the existing root-to-tip surfaces, and its axial mask excludes all geometry outside Y = 0…22 mm. The renderer applies the resulting weight to the original positions and triangles. No added gear geometry is needed.

## Paired phase and direction

The existing rig supplies input angle `s`, orbit `c = 8s/21`, and absolute planet angle `p = -44s/21`. Let `a` be the original centre-line azimuth plus `c`, and let `phi_s` and `phi_p` be the measured tooth phases at the observation section Y = 4 mm:

```
q_s = (a      - s - phi_s) / (2*pi/96)
q_p = (a + pi - p - phi_p) / (2*pi/24)
```

The sum `q_s + q_p` is invariant. A constant integer pair sum binds one sun tooth to one planet tooth. Selection follows this shared passage coordinate; the highlighted original teeth persist through approach and departure. Only a short passage interval blends to the next neighbouring pair. Reverse motion follows exactly the same pairs in reverse, and arbitrary seeking has no state or random selection.

The cue fades in during beats 28–29, remains at full weight through beat 35, and fades out by beat 36. Original motion reverses smoothly at beat 32. Direction metadata follows the existing absolute spin/orbit signs and reports zero direction at the reversal instant. The reference is the source shaft axis `[0, -1, 0]`; screen clockwise/counter-clockwise must be projected by the renderer, never hard-coded independently of the camera.

## Validation and limits

`node --test examples/wolf-actuator/tests/tooth-phase-v4.test.mjs` passes 3 tests:

1. Pinned GLB hash, 30 section counts/phases, helix reversal and centre plateau; actual source vertices cover all 96 sun teeth and 24 middle planet teeth; distinct end teeth are excluded.
2. Pair-sum invariance, pose agreement with the existing gear rig, forward/reverse identity and direction signs.
3. Per-tooth continuous handoff, finite input checks, source mismatch rejection, arbitrary seek, fade, and loop reset.

These tests do not establish browser visibility, video legibility, actual contact location, pressure distribution, force, deformation, backlash or collision response. In particular, selecting the nearest phase pair is an **explanatory convention**, not a solved loaded tooth-flank contact. It must be described as a tooth-pair highlight, not a contact stress simulation. Browser and encoded-video review belong to the completed delivery's separate QA record.

Reproduce measurements from the project root with local Python/numpy/scipy:

```
python examples/wolf-actuator/tour-v4/research/tooth-phase-probe.py
```

This writes only `tooth-phase-sections.json` beside the script. The runtime embeds the measured phase table and does not fetch a new remote asset or execute the probe.
