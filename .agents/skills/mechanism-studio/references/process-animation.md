# Explanatory process animation

Use when flow, fuel, heat, energy or contact events carry the explanation. Do not add decorative particles to every assembly. Reuse [shared/animation](../../../../shared/animation/README.md).

## Choose the missing layer

| Layer | Question | Engine example |
| --- | --- | --- |
| Structure/observation | Where are components and connections? | Assembly, view, cutaway, explosion |
| Mechanical motion | What drives what; which phases/constraints? | Slider-crank, valves, spool ownership |
| Working process | How does material/energy produce output? | Intake, spark, combustion, exhaust |
| Tour | What should the reader examine now? | Relevant view/hold/caption/audio |

“Explain how an engine works” may need combustion/flow as well as moving metal. “Inspect this STEP” does not authorize guessing injection or motion from appearance.

## Process contract

In an example process.mjs or equivalent, declare:

- Meaning: process type/substance/energy, sources and assumptions; distinguish port injection from direct injection.
- Time: mechanical phase or shared process clock, period/units, pause/resume and manual seek behavior.
- Regions: stable region IDs, associated parts, anchors/space/units and allowed volume. Gas follows piston/chamber bounds, not metal volume.
- Channels: intake/fuel/spark/combustion/exhaust signals, their model source, onset/end/envelope/direction.
- Display: legend, scale, cutaway/explosion visibility, sparse markers/reduced motion; illustrative speeds/windows/flames are teaching parameters.
- Traceability: computed quantities, visual encoding and unimplemented physical quantities.

Use a pure function process=f(mechanicalState, processClock, displaySettings). Same inputs yield the same result. The renderer applies signals, not a second mechanical formula. Never fire from Date.now, per-frame random births or another RAF clock.

Only CAD geometry requires additional explicit semantic annotations: fixed/moving IDs, supported axes/pivots/directions, inlets/outlets, regions/units and each claim's evidence. Missing fields deliver known structure plus an unresolved list, not automatic process recovery. Stopping physical operation and pausing observation are different states.

Qualitative pressure/temperature uses a legend and assumptions without fabricated Pa/K readouts. Quantitative output requires an applicable model, materials/fluids, boundaries, calibration and errors. Current effects supply no such solver.

## Different engines, different semantics

**Idealized inline-four:** use the existing 720° model and firing order. Separate brief spark, ensuing combustion propagation and full power stroke. Display windows are not hardware calibration. Port-fuel illustration agrees with intake-valve opening; no through-valve stream at zero lift. Chamber gas volume follows piston top and chamber roof; traces indicate direction.

**Two-spool turbofan:** normal combustor burning is continuous, not reignited every shaft revolution. Core flow passes compressor/combustor/turbine; bypass avoids the core. This model has no afterburner: exhaust uses restrained hot-flow traces, not a continuous flame column. Pause keeps combustion state while freezing marker progress. Actual start/shutdown needs its own state machine.

Retained engineering references: [FAA reciprocating-engine chapter](https://www.faa.gov/sites/faa.gov/files/12_amtp_ch10_0.pdf), [FAA ignition chapter](https://www.faa.gov/sites/faa.gov/files/06_amtp_ch4.pdf), [NASA afterburning turbojet explanation](https://www.grc.nasa.gov/www/k-12/airplane/Animation/turbtyp/etaf.html). Authored display windows/particle speeds are not those sources' real-engine calibration.

## Runtime and acceptance

Shared path arrows/pulses own no clock/render loop. Example chamber/annulus effects stay outside viewer.parts/meshes and carry no mechanical part_id, so selection/count/bounds ownership remains intact. Geometry uses the declared glTF metres. Keep depthTest; cutaway/explosion either hides process graphics or follows a documented associated transform. White line art remains primary, with sparse explained process colors.

Check full-cycle stage order/event count/boundaries, repeated phase and pause/forward/back seek, no gas inside metal/below piston, correct stream/valve/inlet/outlet relation, no changed readouts from observation/effect toggles, and correct restoration. Inspect actual intake/spark/combustion/exhaust frames, continuous play, narrow screens and reduced motion. Visible particles prove only a display exists; report synchronization and simplifications, never inferred CFD/pressure/temperature/efficiency.
