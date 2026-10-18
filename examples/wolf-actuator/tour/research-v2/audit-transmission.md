# Independent WOLF transmission audit

This audit keeps the retained WOLF source geometry and original occurrence placements. It does not recover CAD mates or certify gear contact, manufacturing clearances, loads, or dynamic performance.

## Source and assembly interpretation

- Retained source: `../../source/assembly.step`, SHA-256 `b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35`.
- Upstream: [Anthrobotics WOLF](https://github.com/Anthrobotics/wolf-actuator), retained revision `776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea`.
- Retained assembly manual: `../../source/WOLF-Assembly-Guide-V1.1.pdf`. Printed pages 14–15 (steps 6–7) key the central internal ring gears to the outer rings and bolt the outer rings together. Printed pages 16–17 (steps 9–10) mesh the front/back plates with the ends of the planets. Printed page 20 describes supporting the actuator at the front/back plates and attaching a load to the outer rings. Printed page 19 (step 12) attaches the sun to the motor.

Consequently the two named central internal ring gears belong to the same output group; one is **not** a separate fixed ring. The front and back plates supply the fixed toothed rows. There is no physical planet carrier in this source. The orbit coordinate used below describes the common motion of the planet centers, not a newly invented carrier component.

## Independent tooth count

`audit-transmission.mjs` intersects actual GLB triangles with several constant-world-Y planes, constructs radial inner/outer profiles, and measures their angular Fourier components. The imported geometry is tessellated; these measurements identify repeated teeth, not exact involute parameters.

| Retained member | Count | Sections sampled, world Y (m) |
| --- | ---: | --- |
| Sun | 96 | 0.004, 0.014 |
| Each central internal ring A/B | 144 | 0.014 / 0.004 |
| Front / back fixed toothed plates | 156 | −0.006 / 0.028 |
| Each of all 12 planets, middle and ends | 24 | −0.006, 0.004, 0.014, 0.028 |

These independently match `gear-section-results.json`, which uses a separate Python implementation and additional section planes. Evidence is retained in `audit-sections.json`. The 24th-harmonic planet phases at the same axial section agree across the original placements, up to tessellation differences; the helical phase changes between different axial sections and must not be compared as if the gears were spur gears.

## Ideal kinematics

Let `s`, `c`, `p`, and `o` denote the signed sun angle, common planet-center orbit angle, absolute planet-body spin angle, and output angle, measured as increments from the original source placement. Positive rotation is around world `[0, −1, 0]`, hence increasing polar angle in the world XZ plane. The front and back plates remain fixed.

The three pitch constraints are:

```text
96 (s − c) + 24 (p − c) = 0       sun / central planet, external mesh
144 (o − c) − 24 (p − c) = 0      central output ring / planet, internal mesh
156 (0 − c) − 24 (p − c) = 0      fixed plate / planet end, internal mesh
```

They give:

```text
c =   8/21 s
p = −44/21 s
o =  −2/63 s
```

Thus this retained CAD geometry implies an ideal **31.5:1 reverse-direction** reduction. Upstream documentation states **34:1**. The discrepancy remains unresolved; the display must identify the geometry-derived ratio and must not present 34:1 as independently confirmed or distort the motion to match it.

For general counts `Ns`, `Pmid`, `Pend`, `Rout`, `Rfixed`, the solution is:

```text
c/s = 1 / (1 + Pmid Rfixed / (Ns Pend))
p/c = 1 − Rfixed/Pend
o/s = [1 − Pmid Rfixed/(Rout Pend)] / [1 + Pmid Rfixed/(Ns Pend)]
```

Each planet's axis passes through its original XZ bounds midpoint, equal to `scene-index.json`'s `worldCenter` for this source. Its original mesh already includes its assembled angular phase. For an original world vertex `q` and planet center `C`, the working transform is:

```text
q' = R_global(c) C + R_global(p) (q − C)
W_planet = R_global(c) T(C) R_global(p − c) T(−C)
```

The equivalent adapter into the actual source parent frame `P` is `P⁻¹ W_planet P`; the original source node stays unchanged. All rotations use the same world axial direction. Source rest placements, mechanical poses and explosion translations must remain separate.

One input revolution is not an identity cycle for this train. An exact complete angular identity requires 63 sun turns, 24 center-orbit turns, −132 planet turns and −2 output turns. A short gentle demonstration can instead run forward and reverse through the same angle function, ending at zero without a transform reset.

## Sampled phase and clearance check

`audit-clearance.mjs` retains the real source phases and uses the ratios above. It checks all 12 planets against the sun, central rings and fixed plates at six corresponding axial sections, at 121 phases across two input turns. Each source section uses 7,200 angular samples. The check transforms the original planet profile by its orbit and spin, then compares the boundary against the appropriate central member's transformed inner/outer profile.

| Pair / world Y | Lowest sampled radial separation across all 12 planets (mm) |
| --- | ---: |
| Front plate / −0.006 | 0.220131 |
| Sun / 0.004 | 0.111903 |
| Ring B / 0.004 | 0.212443 |
| Sun / 0.014 | 0.114883 |
| Ring A / 0.014 | 0.201985 |
| Back plate / 0.028 | 0.214963 |

All these sampled sections remain separated. Full results are in `audit-clearance.json`. Values are diagnostics of the retained display mesh, **not specified mechanical clearances**. Sampling selected planes and phases is not a continuous 3D interference test, a tolerance analysis, proof of rolling contact, a herringbone contact solver, or engineering certification. Backlash, deformation, friction, tooth contact forces and load-bearing behavior are not modelled.

## Reproduce

From the Mechanism Studio root:

```sh
node examples/wolf-actuator/tour/research-v2/audit-transmission.mjs --report
node examples/wolf-actuator/tour/research-v2/audit-clearance.mjs
```

Both scripts read the retained source-derived display assets and write only `audit-*` evidence inside this directory. They do not alter source assets or the presentation runtime.
