# Retained WOLF engineering source

WOLF V1.2 actuator by Anthrobotics and contributors, pinned to commit
`776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea`.

[Original repository](https://github.com/Anthrobotics/wolf-actuator/tree/776a5654bf2e6fdefbad1ce0f4d88dcaaf1e6dea).
The upstream README, LICENSE and V1.1 assembly guide are preserved byte for byte.
The V1.2 upstream README explicitly continues to use that guide.

- Original STEP: `assembly.step`, 88,565,658 bytes.
- SHA-256: `b352183e1bd0d55c403a6f406c3b2886a3b1b374b47cf32bcb69d4277d252e35`.
- Git blob: `1919efd133341adfe588ea555362467ab053b4c0`.
- Source format: native-metre AP242, 184 explicit metre geometry contexts.
- Source graph: 184 definitions, 252 NAUO use relationships, 253 placed occurrences
  including the root, 245 leaf occurrences and 8 assembly occurrences.
- Source and CAD-derived model license: CC-BY-SA-4.0. Preserve [NOTICE.md](NOTICE.md)
  and [LICENSE](LICENSE), including upstream's RFX / Robin Fröjd acknowledgement.

## Actual imported scope

The actual source includes twelve individually named planets, a sun gear, two
internal ring gears, front/back plates, encoder components, two nested bearing
assemblies and an 86-component motor subassembly. Generic upstream labels
`Part N`, `cc` and `magnet` stay unchanged; appearance is not a basis for
inventing engineering identity.

The STEP is mixed: analytic gear/housing bodies coexist with **69 source
triangulated bearing definitions**, each used twice (138 placed occurrences).
Those faces have no analytic surface. The importer retains their original
vertex/index digests, definitions and occurrence identities, and supplies actual
triangle bounds. Their analytic B-rep bounds remain null; the audit therefore
reports **limited analytic geometry coverage**. The complete source identity,
placement conversion and display face-coverage checks pass. No part is silently
dropped and no analytic CAD surface is reconstructed from these meshes.

OCCT normalizes the original metres into millimetres; matrices and vertices are
then mapped to glTF metres/+Y once. Actual display envelope is about 0.202 m in
diameter and 0.067 m axially. These triangle-derived extents are a scale check,
not exact B-rep measurement.

## Reproduce locally

Use the project's existing pinned XCAF runtime. From the Mechanism Studio root:

```powershell
npm run import:cad -- --example examples/wolf-actuator
node examples/wolf-actuator/build-scene-index.mjs
npm run audit:cad -- --example examples/wolf-actuator
node --test examples/wolf-actuator/tests/source.test.mjs examples/wolf-actuator/tests/asset.test.mjs
```

The original source exceeds the current public release file-size budget. It is
retained locally without changing bytes or raising that budget; a future public
source packaging/fetch decision must preserve the fixed URL, digest and license.

`provenance.json` and `download-records.json` bind each original file to its
pinned URL and checksum. The engineering graph, GLB, display contract and report
live in `../assets/`; actual import/audit and regression evidence lives in
ignored `../output/`. The source metadata/probe JSON records are diagnostic
extractions, not a general STEP protocol conformance check or a mate solver.

Showcase explosion, color, labels, camera and sound are separately authored
presentation behavior. They do not establish physical disassembly, gear-contact
motion, motor control, loads or safety certification.
