# Contributing to Mechanism Studio

Start with the [README](README.md), [skill guide](docs/skill-guide.md) and [module catalog](docs/modules.md). The current scope is inspectable mechanical explanation with explicit source evidence. A good contribution improves one observable capability and documents its limits.

## Local development

Use Node.js 20.10 or newer. Run `npm ci`, then `npm run preview`. Use `npm test` for project checks and `npm run release:check` before committing. Optional native tools have separate setup instructions in `tools/`; do not assume another contributor has a local Blender, OCCT or speech configuration.

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
