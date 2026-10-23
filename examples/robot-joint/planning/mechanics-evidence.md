# Original robot joint — mechanical evidence

This example is an original, locally generated teaching assembly. It is not a recovered robot CAD design or a manufacturable actuator. Its source is `spec.mjs`; `geometry.mjs` reuses the project's original MIT planetary solids at 0.6 scale and adds an authored motor, sensor package, rear journal support and output flange. No external model is downloaded.

## Structure and identity

129 actual occurrences share 44 mesh definitions. The six-node assembly tree has a root and five authored subassemblies: motor, reduction stage, rolling supports, reducer enclosure, and robot-link output. Repeated coils, magnetic blocks, screws, planets and bearing balls share geometry definitions while keeping independent stable `rj:` occurrence IDs. Coils and magnets carry an explicit immutable source rotation; motion never rewrites that rest transform.

The nominal reducer diameter is 115.2 mm; the motor sleeve's cooling lands extend the maximum diameter to 116.6 mm. Motor and reducer axes are +Z. The motor centre is Z=39 mm, the gear plane Z=0, and the output flange Z=-26.5 mm. All positions are authored in metres once; the reducer's scale is baked into its generated mesh, never animated as a zoom effect.

## Structural motor model

A 12-tooth stator surrounds a 14-pole rotor. Fourteen distinct arcuate magnetic blocks occupy the rotor exterior. Twelve genuine hollow winding packs wrap the radial stator teeth; their apertures run along the radial tooth axis. The nominal magnet-to-stator radial air gap is 0.8 mm. The tests measure the actual faceted vertices and require at least 0.5 mm after their visible edge bevels.

The rotor, magnet blocks, motor shaft, input shaft and sun gear share one authored rotation. The two shaft segments meet at Z=22.8 mm; the structural connection is assumed rigid, without an engineered keyed or splined coupling. The input shaft has a reducer-side rolling support and a rear plain journal bushing seated in the motor cap. The cap, bushing, shaft, spacer, output flange and screw passages are actual bored solids. The spacer also clears the reducer's existing bolt heads rather than hiding them in a solid adapter.

Coil phase and magnetic-polarity metadata label the illustrative layout only. No electromagnetic field, commutation, torque/current relation, winding schematic, position measurement, control circuit, thermal or load analysis is implemented. The rotor-position disc, sensor board and package show placement, not an electronic device specification.

## Gear relationship

The module is 1.2 mm, pressure angle 20°, and tooth counts are sun 24, each planet 24, ring 72. The planet-centre radius is 28.8 mm. The ring is fixed and the carrier drives the robot-link flange:

`omega_carrier = omega_sun * 24 / (24 + 72) = omega_sun / 4`

`omega_planet_relative_carrier = -(24 / 24) * (omega_sun - omega_carrier)`

`omega_planet_absolute = -omega_sun / 2`

External and internal pitch-phase residuals are checked for every actual planet; both pitch-point tangent velocity equations must be zero. The underlying tooth profiles are reused from the original validated involute teaching reducer; root joins, display backlash and shaft couplings remain simplified. These equations are not a gear-contact, collision, load, friction or strength solver.

## Rolling supports

The front rolling support inner race follows the sun; the output-side inner race follows the carrier. Both outer races are fixed. Each support has independent inner and outer races, a cage, and ten ball occurrences. Let `R` be ball-centre pitch radius, `r` ball radius, and `wi`, `wo` the inner/outer race angular speeds. Zero contact angle and ideal no-slip contact give:

`wc = ((R-r) * wi + (R+r) * wo) / (2R)`

`wb = (-(R-r) * wi + (R+r) * wo) / (2r)`

`wb` is absolute ball spin in the housing frame, not the commonly tabulated spin relative to the cage. The ball centre orbits at `wc`, while the same ball occurrence rotates about its own centre at `wb`. Independent tests check the inner and outer contact velocities, including moving outer-race inputs to avoid accidentally hard-coding only the fixed-ring special case.

Four sun turns close the gear train, but need not close every identified cage and ball phase. The presentation must cover those internals before an editorial loop reset; mechanics does not change bearing ratios to force visual closure. The rear motor journal bushing is a plain support with a fixed body, not an additional rolling-bearing simulation.

## Verification boundary

`node examples/robot-joint/build-joint.mjs` writes the GLB, scene contract, index, provenance and build report. Input fingerprints include the reused planetary geometry and spec, so changing those invalidates the generated revision. The asset has no timestamps or random geometry. Rebuilding from the same files produces the same bytes.

`node --test examples/robot-joint/tests/mechanics.test.mjs` checks actual asset identity/tree, valid triangles and normals, source hashes, rotated vertex bounds, bores and winding apertures, motor gap, bolt-head clearance, source-rest preservation, gear phase and ideal bearing velocities. These numerical checks are separate from browser framing, actual video review and subjective listening.

Explosion is an editorial translation of real occurrences. It does not prove a collision-free maintenance sequence. Shaft fits, winding insulation, bearing tolerances, lubrication, fatigue, structural rigidity, electromagnetic performance and production mounting remain unverified.
