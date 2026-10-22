# Planetary gear set — mechanical evidence

This is an original, parametrically authored teaching mechanism, not a recovered
production STEP assembly. The rest geometry and part identities are declared in
`../spec.mjs`; `../kinematics.mjs` supplies ideal rigid-body motion. Presentation
offsets, labels and camera views do not modify that motion.

The detailed edition contains 80 physical occurrences. It retains the original
21-part gear train and adds 59 enclosure/support parts: one housing, two end
plates, two gaskets, twelve housing bolts, twelve washers, two shaft seals,
two 13-part support bearings (inner race, outer race, cage and ten balls each),
and two bearing clips. Repeated balls and fasteners retain distinct occurrence
IDs while sharing geometry definitions. This count describes authored display
geometry, not a production bill of materials.

## Reference and authorship

Kohara Gear Industry's [Internal Gears technical information](https://khkgears.net/pdf/internal-tech.pdf)
(section “Gear tooth conditions for planetary gear mechanisms”, consulted
2026-10-21) supplies the three standard tooth-count/spacing conditions and the
internal-mesh rotation convention. KHK also distinguishes involute, trochoid
and trimming interference; satisfying the spacing conditions alone is not a
complete interference or manufacturing check. No KHK drawing, mesh, photograph
or catalog asset is redistributed here. The numerical design, meshes, motion
adapter and the derivations below are project-authored.

## Declared design

| Quantity | Value |
| --- | --- |
| Sun teeth `Zs` | 24 |
| Planet teeth `Zp` | 24 on each of three occurrences |
| Ring teeth `Zr` | 72, internal, held fixed |
| Module / pressure angle | 2 mm / 20 degrees |
| Gear pitch radii | Sun 24 mm; planet 24 mm; ring 72 mm |
| Planet-centre orbit radius `a` | 48 mm |
| Planet centre rest angles | 0, 120 and 240 degrees |
| Axes and angle convention | XY gear plane; positive rotation about +Z |
| Imported/viewer lengths | Metres; no further millimetre conversion |

Applying the cited conditions to this authored design gives:

1. Coaxial: `Zr = Zs + 2 Zp = 24 + 48 = 72`.
2. Equally spaced phase-compatible planets: `(Zs + Zr) / 3 = 32`, an integer.
3. Neighbouring standard planet tips: `Zp + 2 < (Zs + Zp) sin(pi/3)`;
   here `26 < 41.5692`. The nominal tip-circle gap is
   `2 a sin(pi/3) - m (Zp + 2) = 31.1384 mm`.

These checks concern the specified gear layout. They do not establish pin
strength, bearing life, axial retention, fits, lubrication or housing design.

## Derived ring-fixed motion

Let `s`, `p`, `r` and `c` be absolute incremental angles of the sun, a planet,
ring and carrier, respectively, measured from the authored rest pose. In the
carrier frame the sun/planet external mesh rotates oppositely, while the
planet/ring internal mesh rotates in the same sense. Consequently:

```text
Zs (s - c) + Zp (p - c) = 0          external mesh
Zr (r - c) - Zp (p - c) = 0          internal mesh
Zs (s - c) + Zr (r - c) = 0          eliminated planet / Willis relation
```

With `r = 0` and the chosen counts:

```text
c = s / 4                           carrier output; same sign as input
p = -s / 2                          absolute spin about the planet's own axis
p - c = -3 s / 4                    planet spin relative to its carrier
alpha_i = alpha_i0 + c              centre orbit angle
C_i = a [cos(alpha_i), sin(alpha_i)] planet centre in the fixed frame
```

The input/output reduction is 4:1. Planet spin and centre orbit are explicitly
different channels. A complete carrier revolution requires four sun
revolutions (`s = 8 pi`), restoring the gear train, including the
non-axisymmetric carrier and screws, to its original orientation. The added
rolling-bearing cages and individually identified balls have different phases;
they do not return to their initial poses after those four input turns.

The same equations differentiated give the velocity checks. At the ideal
sun/planet pitch point the planet-side tangential velocity is
`a c_dot - rp p_dot = rs s_dot`; at the ring pitch point it is
`a c_dot + rp p_dot = 0`. These are ideal rolling-velocity identities, not a
computed friction/contact model.

## Tooth phase and repeated identities

All phases below are baked into the authored tooth vertices, not applied a
second time by the motion wrapper:

- Sun external material tooth centre: `phi_s = 0`.
- Planet external material tooth centre: `phi_p = pi / 24`.
- Ring internal **gap** centre: `phi_gap = pi / 72`, so its material tooth
  centre is `phi_r = phi_gap - pi / 72 = 0`.

At the +X planet, a sun tooth faces a planet gap. Because the 24-tooth planet
has an even tooth count, its outward face is also a gap; the ring must present
a material tooth there. Setting the ring's gap phase to zero would therefore
be wrong even though the speed ratios would still pass.

For each actual planet occurrence and its current centre direction `alpha`,
the adapter checks both independent phase conditions, modulo `2 pi`:

```text
Zs [alpha - (phi_s + s)]
  + Zp [alpha + pi - (phi_p + p)] = pi     external tooth/gap alternation

Zr [alpha - (phi_r + r)]
  - Zp [alpha - (phi_p + p)] = pi          internal tooth/gap alternation
```

The 120-degree centre intervals are eight planet pitches and twenty-four ring
pitches, so all three planets share the same baked tooth orientation while
retaining separate occurrence IDs (`pg:planet-1` through `pg:planet-3`). Phase
agreement is evidence for this authored gear geometry, not a claim about
contact pressure, torque, backlash compensation or arbitrary CAD meshes.

## Source rest, attachment assumptions and display

Every physical occurrence is a direct child of `pg-asm:planetary`; its source
rest transform is a translation to its own authored centre. The rig verifies
that parent, identity, motion role, geometry revision, metres, and full
local/world rest matrices agree with the specification before it binds.

The model wrapper applies a rotation `R(spin)` and translation
`C(t) - R(spin) C(0)`. Therefore applying the wrapper before the source rest
translation yields the intended centre `C(t)`, without rotating a planet
around the origin instead of around its own axis. Source vertices, baked tooth
phase, source transforms and mesh scales remain unchanged.

The input shaft is assumed rigidly connected to the sun. The two carrier
spiders, output hub, planet pins, thrust washers and socket screws are assumed
rigidly connected to the carrier. The three planet-bearing parts are **plain
journal bushings**, assumed fixed to the planets for this visualization and
therefore turning with the planets around their pins. The geometry deliberately
retains 0.1 mm radial display clearance at the planet/bushing interface; it does
not establish a press fit or other production fit. No rolling elements are
implied for those three journals.

The two additional shaft-support bearings have separately modeled inner and
outer races, cages and ten actual ball occurrences each. The front inner race
follows the input shaft/sun; the rear inner race follows the output/carrier.
Outer races remain fixed to the enclosure. The v3 adapter assigns cages and
balls explicit mechanical ownership. Both cages orbit at their bearing's
ideal cage rate, with all ten ball centres retained in their original cage
pockets. Every ball also rotates about its own centre at its absolute
housing-frame spin rate, as derived below. During the separated detail these
poses hold still; rolling resumes only after each bearing's internal parts
have been seated together. The displayed separation does not change ratios.

## Bearing evidence, contact convention and derived motion

NSK's [Rolling Bearings for Industrial Machinery, E1103c Part A](https://www.nsk.com/content/dam/nsk/common/catalogs/ctrgPdf/bearings/e1103c_parta.pdf),
section 5.4.1, equations 5.1–5.4 and Table 5.3 on printed pages A100–A101
(consulted 2026-10-21), provides ideal rolling-element and cage speed equations
from inner/outer race speeds, ball/pitch diameters and contact angle. The cage
relation reduces to `(1 - r/R) wi / 2` for a stationary outer race and zero
contact angle. NSK's [Introduction to Bearings](https://www.nsk.com/tools-resources/introduction-bearings/)
also identifies the cage as the component that positions rolling elements.
No manufacturer illustration, catalog model or text passage is redistributed.

These formulas support the **ideal kinematic model**, not a recovered mate or
commercial bearing selection. In this authored mechanism:

| Side | Inner-race driver | Outer race | Pitch radius R | Ball radius r | Contact angle |
| --- | --- | --- | --- | --- | --- |
| Front | Sun/input shaft | Fixed enclosure | 11 mm | 2.1 mm | 0 degrees |
| Rear | Carrier/output hub | Fixed enclosure | 14 mm | 2.5 mm | 0 degrees |

Both bearings contain ten actual ball occurrences. Their groove profiles are
centered axially at the declared bearing plane. Earlier v2 groove construction
left a 60 micrometre display gap to each ball. V3 retains a groove curvature
radius `r + delta`, with `delta = 60 micrometres`, and moves each curvature
centre by `+delta` for the inner groove or `-delta` for the outer groove.
The nominal equatorial race radii therefore become exactly `R-r` and `R+r`.
This is a geometry correction for the authored zero-contact-angle model,
not a solved bearing clearance or preload. The actual polygonal mesh remains
an approximation: sampled race/ball surface deviation is below 10 micrometres;
no claim of exact mesh tangency or Hertzian contact is made.

To make reference frames explicit, let `wi`, `wo`, `wc` and `wb` be inner-race,
outer-race, cage and **world-frame sphere spin** angular rates, respectively.
All are signed about +Z. Let `er` point from the bearing centre to a ball and
`et = ez cross er`. The ball-centre velocity is `R wc et`. Its material-point
velocities at the ideal inner and outer contacts are consequently:

```text
R wc - r wb = (R-r) wi       inner contact, along et
R wc + r wb = (R+r) wo       outer contact, along et

wc = [(R-r) wi + (R+r) wo] / (2R)
wb = [(R+r) wo - (R-r) wi] / (2r)
```

For fixed outer races:

```text
wc = (1 - r/R) wi / 2
wb = -(R-r) wi / (2r)
wb_relative_to_cage = wb - wc = -(R/r - r/R) wi / 2
```

The last magnitude is the conventional ball-spin-frequency factor used in
bearing diagnostics. Its direction here is defined by the explicit +Z frame.
Applying it directly as the sphere's world rotation would be wrong: add the
cage rate to obtain `wb`. Independent contact-velocity tests catch this error.
This frame conversion is the project's derivation above; it is not a quote
claiming that a catalog supplies a ready-made mesh transform.

| Rate per inner-race rate | Front | Rear |
| --- | --- | --- |
| Cage / ball-centre orbit | +0.4045454545 | +0.4107142857 |
| Sphere spin in housing frame | -2.1190476190 | -2.3000000000 |

Because the rear inner race moves at one quarter of the sun rate, its cage
and sphere spin rates per sun rate are `+0.1026785714` and `-0.575`.
Angles use the same linear equations with zero phase at source rest. Ball `k`
remains the same physical occurrence: its centre is
`R [cos(2 pi k/10 + c), sin(2 pi k/10 + c)]`, while its own-axis orientation
uses `b`, not `c+b`. The rest-relative wrapper computes
`T(C(t)) R(b) T(-C(0))`, preserving source rest transforms and mesh scale.
The cage uses `R(c)`. No independent animation timer or numerical integration
is used, so reversal and arbitrary seeks are deterministic.

The assumptions are circular rigid races, radial contact angle zero, no slip,
and equally spaced balls. The implementation does not calculate load sharing,
radial deflection, preload, lubrication, friction, skidding, cage contact,
elastic deformation, fit, fatigue life, stress or thermal performance.
Real bearing slip and cage behaviour can differ under operating loads.

### Loop boundary

Four sun turns close the gear train, but yield `89/55` front-cage turns and
`23/56` rear-cage turns. The actual occurrence phases are deliberately **not**
clamped or remapped to force closure. Rolling internals are hidden at the
showcase's closed-enclosure start/end, covering an authored editorial reset.
This visual loop is not a common mechanical repeat period. Repeated-ball
identity is maintained inside each pass; it is not shuffled to conceal a jump.

The ring, enclosure, end plates, gaskets, seals and bearing-retention parts are
fixed in the authored housing frame. Ring restraint and shaft-to-race/shaft-to-
gear connections remain teaching assumptions; no keys, fits or recovered CAD
mates establish these constraints. Seal geometry does not establish sealing
performance or measured contact.

The detailed geometry also corrects an earlier output-hub flange overlap: its
forward face now ends at global Z = -14 mm, at the rear carrier face, instead
of extending 1 mm into that carrier. Existing occurrence IDs, source centres,
shaft bore and the core gear geometry are retained. This local correction is
not a claim that the entire assembly or teardown has been collision-certified.

Axial/radial separation belongs only to the presentation plan. Motion is held
during teardown as an editorial choice. The separated view is not a
collision-checked service procedure. Root joins, clearances, fastener threads,
retaining fits and other production details remain simplified as listed in
`LIMITATIONS` in the specification.

## Executable checks

Run from the project root:

```powershell
node --test examples/planetary-gears/tests/kinematics.test.mjs
node --test examples/planetary-gears/tests/bearing-kinematics.test.mjs
```

The checks bind the generated `assets/scene-index.json`, then verify tooth
conditions, Willis and both relative mesh equations, both tooth-phase
residuals across forward/reverse motion, unit quaternions, exact own-axis
spin and orbit, repeat-pose recovery, unchanged source data and actual viewer
model/display separation. Independently differentiated transformed material
points verify tangential velocity agreement at the two ideal pitch
interfaces. A further sampled section check evaluates all three planet
occurrences over 721 states spanning one relative tooth period. It uses each
generated profile vertex and three interior points on every edge (2,880 points
per external gear). Signed ray/edge distances test that both external contours
remain outside one another and planet contours stay inside the ring void. The
minimum sampled radial clearances for this revision are 0.1563 mm externally
and 0.1857 mm internally. They are sampled polygon-section distances, not
certified normal backlash or a continuous 3D collision result. Profile and
actual binary-mesh integrity checks also live with the model generator.

The bearing checks separately validate source-bound dimensions and metadata,
front/rear ratios, all twenty ball centres staying inside their own cage
pockets, unit-scale rest-relative poses, and unchanged source data. Both
contact velocity equations are checked for forward, reverse, stationary and
co-rotating races. A numerical derivative of actual transformed sphere and
race **material points** independently tests zero relative tangential velocity
at both ideal contacts in the assembled state. A regression test rejects the
common error of using cage-relative ball spin as world spin. Tests also retain
the non-closure of bearing phases at four sun turns rather than incorrectly
expecting all 80 part matrices to repeat. Analytic contact velocities do not
turn polygonal geometry into an exact contact or dynamics simulation.

Automated numerical success does not replace browser inspection, label
readability, a full visual loop or an engineering design review. Those are
separate delivery checks.
