# Planetary gear set — input brief

## Request and route

The user asked to synthesize a planetary gear set, use Mechanism Studio to disassemble it, expand the component detail, and then verify and add shaft-coupled bearing ball/cage motion. The input is a **text design brief**. There is no supplied STEP assembly, photograph or hidden manufacturing BOM to reconstruct. Choose **Showcase**: “More than gears,” one 36-second English looping study, with the existing white fine-line Atlas treatment and original code music. Keep all files within Mechanism Studio.

## Engineering basis and authored choices

The project authors a 24-tooth sun, three 24-tooth planets and a 72-tooth internal ring, with 2 mm module and 20° pressure angle. The ring is fixed, sun is input and carrier is output. The 48 mm planet-centre radius, 120° spacing and ideal 4:1 reduction follow from these declared values. Tooth-spacing conditions, tooth/gap phase and the ideal rigid-motion derivation are recorded in [mechanics-evidence.md](mechanics-evidence.md).

This numerical design, all 80 part occurrences and the mesh geometry are original project work. General gear relationships are referenced as engineering knowledge; no third-party CAD, drawing or mesh is redistributed. Asset provenance records the generator and source-byte fingerprints. The project's MIT license applies to this original example and score.

Authoring assumptions include rigid sun/input and carrier/output connections, carrier-mounted pins/fasteners, journal bushings visually attached to the planets, ring/housing restraint and bearing/seal seating. Visible journal clearances are presentation choices, not validated fits. Seal and race profiles are modeled; seal deformation, root fillets, screw threads, lubrication, retaining fits, strength, load sharing and manufacturing tolerances remain simplified or unmodeled.

## Delivered depth and identities

The available and intended depth are the same: **80 actual occurrences using 29 geometry definitions**. The original 21 remain: two central gears, three planets, two carrier spiders, three pins, three plain bushings, three washers, three socket screws and two shafts/hubs. The 59 additions are one housing, two endplates, two gaskets, twelve housing screws, twelve washers, two shaft seals, two clips, and two 13-component support bearings. Each support bearing has an inner race, outer race, cage and ten independently identified balls.

Every occurrence has a stable `pg:` ID, actual source parent, immutable rest translation and separate model/display ownership. Shared geometry definitions do not merge repeated occurrences. All original IDs and rest placements are preserved. A recorded v2 correction shortens the output-hub flange by 1 mm to remove its previous rear-carrier overlap while retaining the shaft/bore dimensions.

The planet journals remain **plain bushings**; the shaft supports have explicitly authored **ball-bearing internals**. Both use prescribed ideal rolling with fixed outer races, zero contact angle and no slip. Input inner-race motion follows the sun; output inner-race motion follows the carrier. Balls orbit with their cage pockets while their own orientation integrates the distinct sphere-spin component. Version 3 shifts the race-groove centres to nominal contacts at `R ± r`; the 60 μm groove curvature relief is not treated as a uniform radial gap. The motion remains held during internal separation and label reading; the selected bearing is seated again before it rolls. This is an authored component set, not imported CAD with recovered mates or a model of an existing commercial reducer.

## Shared presentation and module handoff

| Interval | Intent | Main owners |
| --- | --- | --- |
| 0–3.6 s | Establish the enclosed reducer and ideal motion | Ideal motion adapter; camera; enclosure appearance |
| 3.6–8.4 s | Lift enclosure fasteners, endplates and seals | Assembly & Explode; action sound |
| 8.4–13.2 s | Reveal transmission, shaft supports and retained names | Assembly & Explode; camera; annotations |
| 13.2–15 s | Establish one actual sun/planet pair | Camera; context appearance |
| 15–19.2 s | Read the labels, then inspect spin versus orbit | Mating Close-up; ideal motion adapter |
| 19.2–21 s | Approach the actual input support bearing | Camera; context appearance |
| 21–27.6 s | Separate and read 13 components, reseat, then show coupled ball/cage motion | Assembly & Explode; camera; annotations; ideal bearing adapter |
| 27.6–32.4 s | Restore transmission, enclosure and fasteners | Assembly & Explode; seating sound |
| 32.4–36 s | Finish the gear loop; conceal the nonclosing bearing poses inside the housing | Ideal motion adapter; appearance; shared transport |

The immutable executable plan in `../presentation.mjs` binds offsets, fixed-envelope orthographic cameras, label windows and opacity to the actual geometry revision. Labels appear sequentially near their parts, stay within the scene and fade before local motion resumes. The selected sun/planet pair receives the same display translation; neither its source mesh scale nor relative spacing is changed. The front-bearing close-up separates the actual races, cage and ten ball occurrences without duplicating or enlarging their geometry. Its internal offsets return to zero before rotation; the shared extraction offset then keeps the seated bearing together. Four sun turns close the gear poses, but not the cages or ball material orientations, so those parts are concealed during the loop reset.

Mechanics remain in `../kinematics.mjs`; the story's angle schedule and all sound cue bindings share `../choreography.mjs`. The 100 BPM original score spans the same 60 beats / 36 seconds. Camera or annotation events do not create independent sound timers.

The working bearing shot temporarily lowers the outer race's display opacity. After names fade, one 0.7-second seating recenter transitions from the opened detail to a precomputed seated-bearing envelope; direction is retained and the camera holds throughout rolling. It never reframes from live part bounds. Thin orientation lines and dots in `../bearing-cues.mjs` inherit actual ball, inner-race and cage poses, including their model and display transforms. These are visual motion cues, not extra part identities or altered contact surfaces.

## Evidence and boundaries

Acceptance includes the actual 80-part GLB/contract/ID mapping, source hashes and vertex bounds; genuine passages, race grooves and sampled ball/cage/race clearance; ideal gear equations and phase relationships; bearing cage speed and independent transformed-point velocity checks; sampled tooth-section clearance; exact display reassembly, gear-pose loop recovery and bearing-reset concealment; deterministic seeks; and numerical score/transport identity. Ideal no-slip motion and sampled bearing geometry do not solve slip, contact response or cage loads. Real browser reading and full-loop review are separate from automated results.

An exploded offset is an observation choice. The generated sequence does not establish a collision-free maintenance procedure, force transmission or a solved production assembly. Web delivery, video encoding, public posting and GitHub publication are distinct outcomes; only the local model and looping study are requested here.
