# Workflow origins and implementation boundaries

Early Mechanism Studio workflow text adapted ideas from Anatomy: mechanism-first
explanation, one model for motion/readouts, and review of actual rendered views.
Attribution and the original MIT notice remain in [origins](origins.md) and
[third-party notices](../THIRD_PARTY_NOTICES.md). Independent maintenance does not
erase that history.

The current runtime uses this repository's own viewer, model adapters, source
identity pipeline, scene contracts and optional tools. It does not need a sibling
Anatomy checkout or its drawing library. Its distinctive focus is inspectable
mechanical/source evidence coupled with a reusable presentation workflow.

| Mechanism Studio area | Current implementation |
| --- | --- |
| Authoring | One main skill, three specialist contracts, text/image/CAD intake and explicit Inspect/Explain/Showcase routes |
| Shared code | Seven runtime libraries with example-specific mechanism models and clear motion/display ownership |
| Teaching | Authored lock, inline-four, turbofan and quadruped; process effects tied to model phase |
| Engineering sources | Licensed STEP/URDF specimens, pinned bytes, definitions/occurrences, placements and source-bound selection |
| Presentation | Original code music, source joint motion in the robot adapter, near-part retained names, deliberate macro/whole cuts, loop restoration |
| Reuse | MIT original code, separate model licensing, documented source packages and public-file checks |

This is not a claim that all diagrams are better or that 3D, explosion or shared
models were first introduced here. Source fidelity, mechanical correctness,
clear explanation and rendering quality require separate evaluation.

MCP is a tool connection. The existing lock-specific bridge does not automatically
improve geometry or supply a CAD kernel. Exact B-rep measurement, mates and
collision-checked disassembly remain on the [roadmap](cad-roadmap.md).
