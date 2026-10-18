# Independent final integration review — WOLF tour v2

Scope: read-only review of `tour-v2/story.mjs`, `framing.mjs`, `kinematics.mjs`, `gearing.mjs`, `bearings.mjs`, `app.mjs`, README and the integration tests. No additional full test run, new browser inspection or encoded-video review was performed by this reviewer.

## Outcome

No blocking mechanical integration issue was identified in the reviewed implementation.

- The gear adapter uses the independently derived source ratios: orbit `8/21`, absolute planet spin `−44/21`, output `−2/63` of sun angle. Planet transforms preserve original tooth phases and compose orbit with spin around each original planet center.
- The combined adapter checks disjoint mechanical ownership: 62 gear/input/output leaves and 138 bearing leaves. It copies only the bearing adapter's owned channels, so its identity reset map cannot erase the gear poses.
- In the gearing passage, **both bearings** receive the actual gear output angle on their outer race. Their inner races remain fixed. The two gearbox support rings receive the same output angle through the gear owner. There is no independently guessed bearing speed during this passage.
- In the isolated bearing passage, bearing A receives a separate reversible 60° outer-race input while the gearbox angle is zero. Bearing B returns to identity. This is a magnified functional demonstration with its own input, not the same instantaneous gearbox operating condition as the earlier passage.
- The ideal bearing equations include cage precession as well as spin about the alternating tilted roller axes. With `h = r cos(alpha)`, their two-contact constraints give `c = ((R+h)o + (R-h)i)/(2R)` and relative roller spin `(R²-h²)(o-i)/(2Rr)`. The transform `orbit × local roller spin` correctly carries each tilted axis with the cage.
- During the gear operation, mesh members first return to their source meshing placements. Motion returns to exact zero before the fade and renewed explosion. The isolated bearing stays internally assembled during rotation, then returns to source phase before its local teardown.
- Original source nodes remain unchanged; working deltas are converted through actual parent frames. The display offset channel remains separate. No physical carrier, new bearing half, fake mate or dynamic contact model is introduced.
- Camera fitting includes transformed gear bounds; integration tests inspect actual combined motion bounds and display offsets. Moving mechanism passages suppress near-part labels instead of anchoring them to stale rest positions.

## Presentation clarification

The 88–104 beat bearing passage should explicitly be called an **independently driven isolated bearing view** in its caption or README. Otherwise a reader could mistake its +60° outer-race demonstration for a continuation of the earlier gearbox output, which is derived from the sun and is much smaller. The current runtime coupling itself is correct.

The source-derived 31.5:1 versus published 34:1 discrepancy, ideal no-slip assumption, ignored 10 μm clearance, mesh-derived axes, and lack of recovered mates/contact forces/dynamics are correctly disclosed. Keep those limitations with the exported example; this review adds no engineering certification.
