# WOLF modular crossed-roller bearing: evidence and model boundary

This investigation uses the retained WOLF STEP and its identity-preserving display asset, together with the upstream v1.1 bearing generator and assembly guide. It adds semantic aliases to the presentation; source occurrence names and geometry remain unchanged.

## Primary evidence

- WOLF source revision `776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea`, retained `source/WOLF-Assembly-Guide-V1.1.pdf`. Printed page 18 / step 11 aligns the bearing's inner and outer mounting holes with the front/back plates and output outer-ring nubs. Printed pages 14–15 / steps 6–7 key the internal gears to the output outer rings and bolt those two rings together. Printed page 20 distinguishes the fixed front/back plate mounting from loads attached to the outer rings.
- [Anthrobotics modular-bearing generator, pinned revision](https://github.com/Anthrobotics/modular-bearing/blob/2b63192188d81eea663c04e5a2b98c44d60186f2/ModularBearingGenerator.scad). Its header explicitly identifies the default configuration as the one used for WOLF v1.1. Default dimensions: outer diameter 200 mm, bore 153 mm, width 11 mm, nominal roller diameter 6 mm, rolling clearance 0.01 mm, sliding clearance 0.25 mm, roller spacing 2 mm. The source creates alternating −45°/+45° roller axes.
- [Pinned modular-bearing assembly instructions](https://github.com/Anthrobotics/modular-bearing/blob/2b63192188d81eea663c04e5a2b98c44d60186f2/README.md): inner ring, cage, lower and upper outer-ring halves, alternating rollers. These instructions explicitly say the pictured bearing is configured for WOLF.

Downloaded generator and README are retained as `bearing-generator.scad` and `bearing-UPSTREAM-README.md`; source URLs/revision are in `bearing-source.json`. They retain Anthrobotics' **CC BY-SA 4.0** license. The retained WOLF source already carries its corresponding license in `../../source/LICENSE`. The audit/kinematic implementation is original Mechanism Studio code under MIT. Downloading source for research does not relicense it.

## Actual occurrence mapping

The source contains two bearing assemblies, each with 70 leaves. One is the WOLF output support named `outer-ring-A`/`outer-ring-B`; the remaining **69** form the modular bearing.

| Source name | Confirmed presentation alias | Geometric/source evidence |
| --- | --- | --- |
| `Part 59` | Inner race | 153 mm bore, radial outside 86.75 mm, 11 mm width; generator inner-ring profile |
| `Part 69` | Outer race | Outer diameter 200 mm, inner cylindrical edge 89.75 mm, width 11 mm; generator outer-race profile |
| `Part 62` | Cage | Radial band about 87.25–89.25 mm, width 10.5 mm, 66 alternating seats; generator cage profile |
| 66 smaller `Part N` leaves, including `Part 1` | Roller, with original name retained | Every leaf has the same 716 source triangles / 360 unique vertices; chamfered cylinder diameter 5.98 mm, length 5.50 mm; centres on 88.25 mm radius, alternating ±45° axes |

These aliases are supported jointly by the generator, assembly instructions, source hierarchy and measured shape. A name or visual resemblance alone was not used. The source outer race is **one occurrence**; the film must not invent separately selectable outer-race halves even though the upstream manufacturing instructions describe two printed halves.

The binding file records all 132 real roller IDs, source names, measured centres and source-supported alternating axes, plus the six ring/cage IDs. `bearing-probe.py` reads the retained GLB and regenerates `bearing-geometry.json`, `bearing-bindings.json` and `../../tour-v2/bearing-data.mjs`. Unique vertices are transformed by each retained source world matrix. PCA supplies each cylinder's measured axis; the runtime idealizes it onto the source's radial ±45° construction. Maximum deviation is below 2e-6 in unit-vector distance; measured pitch radii differ from 88.25 mm by less than 4e-7 mm. These are mesh consistency checks, not claims of physical manufacturing accuracy.

The existing XCAF diagnostic reports zero analytic solids and one embedded triangulated face for these bearing definitions. The source AP242 bearing geometry therefore remains **source triangulation**, not an analytic contact surface or recovered assembly constraint.

## Mounting and motion model

The two inner races stay with the fixed front/back plates. The outer races follow the bolted output supports. The gear adapter owns those support rings; the bearing adapter owns only the 69 modular-bearing leaves on each side. This avoids writing the same mechanical pose twice.

For an ideal, clearance-free crossed-roller model define:

- `R = 0.08825 m`: roller-centre pitch radius.
- `r = 0.00299 m`: actual modeled roller radius, from `6 − 2 × 0.01 mm` diameter.
- `h = r cos(45°)`.
- `θi`, `θo`: inner and outer race angles about world axis `[0, −1, 0]`.
- `θc`: cage/orbit angle; `β`: roller spin relative to the orbit frame.

The two tangential no-slip contact equations are

```
θc_dot (R + h) + β_dot r = θo_dot (R + h)
θc_dot (R − h) − β_dot r = θi_dot (R − h)
```

Therefore

```
θc = ((R + h) θo + (R − h) θi) / (2R)
β  = (R² − h²) (θo − θi) / (2Rr)
```

With the inner race fixed, `θc = 0.5119787494376644 θo` and `β = 14.74905482865453 θo`. Rollers orbit with the cage and spin around their alternating tilted axes. All axes point toward the global bearing axis; the sign of the radial component alternates. The world transform is orbit rotation about the bearing centre multiplied by spin about the actual roller's initial centre/axis. Each world delta is conjugated through the actual source parent matrix before applying it to the mechanical pose wrapper. Display explosion stays independent.

The source deliberately specifies **10 μm rolling clearance** and sliding clearance. The no-slip model neglects that clearance and contact deformation. It is an explicit ideal kinematic interpretation, not a claim that the unloaded source meshes touch at both contacts. There is no preload, friction, lubricant-film, slip, load, contact-stress, collision or life calculation. Motion while the bearing is exploded would imply unsupported contact, so the operating segment must keep the bearing internally assembled; hiding/fading a race for visibility is presentation only.

## Verification and reproduction

```
python examples/wolf-actuator/tour/research-v2/bearing-probe.py
node --test examples/wolf-actuator/tests/tour-bearings-v2.test.mjs
```

Tests check actual IDs, both sets of 66 alternating source cylinders, shared-input rigid rotation, independent finite-difference velocities at both ideal contacts, parent-space pose conjugation, preservation of source data, bounds, source revision rejection and exact zero-input restoration. The contact check validates the authored ideal equations; it does not validate physical contact forces.
