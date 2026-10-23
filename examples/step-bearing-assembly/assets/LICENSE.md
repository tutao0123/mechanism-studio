# Display asset license

`assembly.glb`, `assembly-manifest.json`, `scene-contract.json` and
`import-report.json` derive from the Open-source Leader Arm by Matheshwaran
Pitchai and contributors. They retain the upstream **Apache-2.0** terms.

- [Full license](../source/LICENSE.txt)
- [Attribution and modification notice](../source/NOTICE.md)
- [Pinned source and SHA-256](../source/provenance.json)

Mechanism Studio generated the display tessellation and retained metadata using
its XCAF importer. Geometry and source part identities were not replaced. The
display conversion changes coordinate basis and units for glTF; it does not
add recovered joint constraints or certify precision.

The surrounding Mechanism Studio interface, test code and authored documentation
use the project's MIT license. That does not relicense these third-party assets.
