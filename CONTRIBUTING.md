# Contributing to Mechanism Studio

Start with the [README](README.md), [skill guide](docs/skill-guide.md) and [module catalog](docs/modules.md). The current scope is inspectable mechanical explanation with explicit source evidence. A good contribution improves one observable capability and documents its limits.

The current release line is **v0.4.1-alpha.1 (public alpha)**. Interfaces and authoring contracts can change; provide a migration note when a change affects existing examples.

## Local development

Use Node.js 20.10 or newer and npm. For a first viewing run, follow the [planetary quick start](README.md#try-it-locally); included GLBs and score synthesis need no Python or native CAD runtime. `npm run preview` starts the gallery after `npm ci`.

The full `npm test` suite **requires Python 3** for the MJCF parser. It selects `MECHANISM_PYTHON` when set, then an existing project-local CAD Python, then `python` on Windows or `python3` elsewhere. The first run downloads the pinned source meshes and checks their hashes; subsequent runs can reuse verified local files. Run `npm run release:check` before committing.

FFmpeg and FFprobe on PATH enable video encoding and optional media integration tests; those integration tests skip explicitly when the tools are absent. Optional native CAD or Blender rebuilds have separate setup instructions in `tools/`; do not assume another contributor has a local Blender, OCCT or speech configuration. Do not install global tools as an implicit part of running an example.

Keep controlled output and temporary fixtures inside ignored `output/`, `.cache/` or `.test-output/` directories. Do not change global skills, account permissions or machine configuration as part of an example. Directory checks are application boundaries, not an operating-system sandbox.

## Adding an example

1. Record the input brief: supplied facts, visible observations, assumptions and unknowns.
2. Establish units, coordinate frames, source definition/occurrence identity and geometry revision before planning motion or observation changes.
3. Use the existing viewer and the appropriate Inspect, Explain or Showcase route. Read the explosion, camera and appearance contracts for the modules you need.
4. Keep mechanical state separate from display explosion, cutaways, visibility and colours. Validate rest-pose restoration, time seeking and single ownership of motion.
5. Add meaningful model/source checks and inspect actual rendered views, label placement, transitions, loop closure and sound. An automated waveform check is not a listening review.
6. Document the local route, reproduction commands, source licenses and known limitations in the example README; add it to the catalog.

For source-based examples, retain original licensed bytes, fixed revision, hashes, attribution, modification notice and preferred source when required. Include third-party assets only when redistribution is authorized. Generated display offsets do not establish a collision-free dismantling sequence, and a source tree does not establish joints.

## Issues and pull requests

Include reproduction steps, expected and actual behaviour, relevant example and source revision, and the checks you ran. Describe whether a problem is in engineering source identity, presentation or a model assumption. Use a minimal non-private fixture. Do not include service keys, proprietary CAD, personal browser screenshots or local configuration paths.

Original code contributions are under the repository's MIT license. Third-party assets continue under their recorded licenses; contributing them does not convert them to MIT. New dependencies and adapted assets need a notice in `THIRD_PARTY_NOTICES.md` and an entry in `docs/licensing.md`.
