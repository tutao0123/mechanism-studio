# Architecture

Mechanism Studio has three layers: a project-local authoring skill, reusable
runtime libraries, and example-specific models/adapters. The skill plans work;
JavaScript and optional Python/Blender tools implement it. The skill is not a
background service or a generic JSON-plan execution engine.

```mermaid
flowchart LR
  I[Text / image / CAD brief] --> S[Mechanism Studio skill]
  S --> E[Explosion / camera / appearance plans]
  C[Retained STEP / URDF or authored geometry] --> A[Source index + GLB + scene contract]
  A --> V[Shared viewer]
  M[Example motion / process adapter] --> V
  E --> D[Explicit example adapters]
  D --> T[One presentation timeline]
  T --> V
  T --> L[Near-part labels + sound]
  A --> Q[Source and asset evidence checks]
```

## Authoring boundary

There is one discoverable [skill entry](../.agents/skills/mechanism-studio/SKILL.md)
and three specialist contracts: explosion, camera direction and materials/lighting.
The [skill guide](skill-guide.md) and [module catalog](modules.md) describe each
input/output, dependency, validation step and actual implementation helper.
Inputs first become a brief separating supplied facts, visible observations,
design assumptions and unknowns. A plan is tagged by its actual evidence, not by
the visual polish of the result. Image reconstruction does not create native CAD
identity or reveal hidden mates.

Inspect retains source identity and observation controls. Explain adds a teaching
model and lesson. Showcase composes a short, timed presentation. These choices
select an authoring route, not new runtime URL parameters.

## Runtime libraries

| Library | Owns | Does not own |
| --- | --- | --- |
| [viewer](../shared/viewer/README.md) | GLB loading, semantic IDs, wrappers, picking, line art, cameras, display explosion | Mechanism formulas, engineering source truth |
| [assets](../shared/assets/README.md) | Bounds, units, identity, hierarchy, rest poses and motion ownership validation | CAD solving or manufacturing certification |
| [CAD](../shared/cad/README.md) | Definitions/occurrences, source graph and placement evidence, independent observation state | Recovered mates, exact B-rep measurement |
| [animation](../shared/animation/README.md) | Flow/event display primitives driven by a caller's phase/time | An independent clock or combustion/fluid solver |
| [voice](../shared/voice/README.md) | Lesson identity, explicit Doubao generation, manifests and checked playback | Mechanism decisions or speech-service rights |
| [appearance](../shared/appearance/README.md) | Source-ID-bound colour cues and independent owned material layers | Geometry/source mutation or physical material simulation |
| [study](../shared/study/README.md) | Music transport, stable shot transitions, near-part annotations, capture update path | Generic music composition, source joint inference |

The retained `showcase/` shell handles the earlier English story adapters. The
music studies use `shared/study/`; the newer robot kinetic adapter supplies source
joints and a separate score. These are maintained implementations, not one
universal presentation configuration.

## Identity, coordinates and motion

Native source definitions and occurrences stay distinct. Repeated screws share a
definition but retain separate parent/local/world placements and selectable IDs.
Authored teaching models use explicit authored identities. Models never invent a
native source occurrence just to label a rendered helper.

The viewer separates source rest nodes, model-owned working poses and independent
display wrappers. GLB rest transforms are already present and must not be applied
twice. A display explosion compensates for parent displacement instead of adding
the same inherited translation twice. Visibility, cutaway, selection and colour
changes do not rewrite source geometry or the mechanism's working state.

Engineering metadata records actual units and source placement. The XCAF route
normalizes verified metre/millimetre source contexts to millimetres, then converts
to metre-based display coordinates once. Every adapter must state its basis and
units; a visually correct camera cannot establish an engineering transform.

The source-backed SO-ARM rig writes absolute poses to the model layer, keeps rest
nodes unchanged and returns working joints to zero before editorial separation.
Its motion remains kinematic. Engine spray, flame and flow follow model phase and
have no mechanical identity or extra animation clock.

## Presentation and sound

One display clock drives a silent preview; after sound activation native media
time drives model, shot, labels and colour cues. Pause/seek/restart must reproduce
the same state. Fixed, sampled geometry envelopes frame whole assemblies; visible
membership changes between macro and whole views use deliberate cuts. Names wait
for settling, appear near real parts in sequence, persist in the same scene and
fade as a group at the next scene. See the maintained style/pacing references.

Original code-generated music and synthesis source ship in Git. Provider MP3s do
not; the public source contains lessons, timing/manifests and optional generation
code. Existing local MP3 and `.blend` outputs remain untouched but ignored.
See [release packaging](release-audit.md) and [licensing](licensing.md).

## CAD evidence and limits

KFL08 preserves the first import's incomplete source/display mapping. Galileo 2
uses XCAF for exact retained definition/occurrence mapping, with recorded
single-face meshing retries. WOLF extends the specimens to native-metre AP242
input and explicitly source-triangulated bearing definitions. Their imports and
evidence limits are separate; success on these samples is not arbitrary STEP
coverage. The root audit CLI cross-checks retained bytes, source metadata,
placements, reports and real GLB geometry without independently solving joints.

Exact solid measurement, mate solving, collision-free disassembly and parametric
feature editing are not implemented. Read [CAD roadmap](cad-roadmap.md) and
[import tooling](../tools/cad/README.md) for the current supported subset.

## Repository boundary

`npm ci` supplies locked dependencies. Preview servers bind to localhost and
allow explicit viewing assets; credentials, tools, source scripts, caches and
private output are not web routes. The optional Blender MCP bridge keeps four
lock-specific operations and does not execute arbitrary Python or auto-connect.
All project-controlled changes and caches stay inside this repository. These
checks do not constitute an operating-system sandbox or grant external posting
authority.
