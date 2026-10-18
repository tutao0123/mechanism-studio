# WOLF gear topology and source-derived kinematics

The retained CAD supports a carrierless compound planetary demonstration: the front/back plates are fixed toothed members; the two central ring gears and the two outer rings form the output group. The sun is attached to the motor. The source geometry is unchanged.

## Pinned evidence

- [WOLF V1.2 source repository](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea), revision `776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea`.
- [Retained STEP](../../source/assembly.step), SHA-256 `b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35`.
- [Retained assembly manual](../../source/WOLF-Assembly-Guide-V1.1.pdf), SHA-256 `fb1aea34edd40510d8bb681856b0035ac25a1c5782fff4e04d53003e41ffe58a`.
- Retained GLB SHA-256 `2793c41488d07527d85e5e1f0729096739575f43ed9a5ef93ec0b37079fdd819`.
- The pinned upstream tree contains STEP and STL, not a native parametric CAD file or explicit mate/gear constraint dataset.

The assembly manual establishes the topology: steps 6–7 (printed pp14–15) key the central rings into the outer rings and bolt the outer rings together; steps 9–10 (pp16–17) mesh the plates with the planet ends; step 12 (p19) fastens the sun to the motor. The usage section (p20) describes securing the actuator by the front/back plates and attaching loads to the outer rings. Steps 2–3 (pp10–11) establish the stationary motor mounting and the encoder-holder attachment. The internal rotor/shaft/magnet rigid group remains an explicit mechanical interpretation of names and coaxial geometry, rather than recovered STEP rigid mates.

## Measured teeth, independent of the published ratio

`gear-sections.py` intersects actual imported GLB triangles with constant-world-Y planes, shoots 8,192 radial rays per section, and counts both significant radial extrema and the leading angular Fourier harmonic. Multiple sections per component agree:

| Member | Teeth |
| --- | ---: |
| Sun | 96 |
| Each planet, middle and both end sections | 24 |
| Each central internal output ring A/B | 144 |
| Each fixed toothed front/back plate | 156 |

All twelve individual source planet definitions are checked. The narrower end sections have different radii from the middle while retaining 24 teeth. Original helical tooth phases remain baked in the source geometry and are never replaced by evenly re-phased copies. Full observations and source IDs are in [gear-section-results.json](gear-section-results.json); the independent JavaScript implementation and sampled phase check are in [audit-transmission.md](audit-transmission.md).

For signed angle increments about world `[0,-1,0]`, let `s` be sun input, `c` planet-center orbit, `p` absolute planet spin, and `o` output. Pitch compatibility gives:

```text
96(s-c) + 24(p-c) = 0
144(o-c) - 24(p-c) = 0
156(0-c) - 24(p-c) = 0

c = 8s/21
p = -44s/21
o = -2s/63
```

The orbit coordinate does not invent a physical carrier. This yields **31.5:1 in the reverse direction** for the retained CAD. The upstream README publishes **34:1**. This unresolved discrepancy is disclosed, and the animation uses geometry-derived increments rather than forcing the advertised number.

## Runtime ownership and limits

[gearing.mjs](../../tour-v2/gearing.mjs) owns 62 actual source leaves: 46 input members, 12 planets, and four output rings. Bearings use a separate adapter. Every working pose is a parent-relative delta `P^-1 W P`, with the original source transform preserved. Whole/exploded display offsets are independent. The timeline supplies an angle and may seek, pause, reverse, and return to exact zero without accumulated integration error.

Planet own axes use each actual source mesh's XZ bounds midpoint. That is an explicit tessellation-based geometric approximation, not a recovered revolute mate. Sampled transformed source sections remain separated over the checked phases, as documented by the independent audit. This supports a source-consistent ideal kinematic presentation; it does not prove exact 3D tooth contact, clearance to tolerance, contact force, friction, backlash, fatigue, or load capacity.

## Reproduce

From the repository root, using Python with NumPy and SciPy:

```sh
python examples/wolf-actuator/tour/research-v2/gear-sections.py
node --test examples/wolf-actuator/tests/tour-gearing-v2.test.mjs
```

The script writes its compact result beside itself. Add `--profiles` only to retain the optional approximately 10 MB raw radial-profile diagnostic. No global environment or source model is modified. Original analysis/runtime code is MIT; source geometry, source-derived geometric observations, and visual derivatives retain the WOLF project's CC BY-SA 4.0 attribution and terms.
