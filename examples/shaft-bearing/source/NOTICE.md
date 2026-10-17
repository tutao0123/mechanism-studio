# Third-party CAD source

Galileo 2 Extruder is an upstream mechanical design by JaredC01 and the Galileo 2 contributors. It is used here as a real STEP assembly inspection specimen. Mechanism Studio is not the author of this extruder, and no endorsement is implied.

The original STEP is retained byte-for-byte as assembly.step. Its upstream file name is Galileo 2 Extruder.step; the fixed source revision, download URL, hash and upstream native Fusion source URL are recorded in provenance.json. The source also contains an X carriage and a dummy toolhead PCB.

The upstream repository provides the GNU General Public License version 3 in LICENSE. That complete, unchanged license text is retained locally as LICENSE.md; no additional or-later grant is inferred. The original editable Fusion source is also included as `Galileo 2 Extruder.f3d`, from the same fixed revision. Its 21,384,519 bytes and SHA-256 are recorded in `provenance.json`. The original STEP, native Fusion file and derived display assets remain GPL-3.0-only, separate from the MIT-licensed Mechanism Studio runtime.

The source accompanying the display derivative consists of the original native Fusion design, original STEP, pinned provenance and the project import scripts in `tools/cad/`. The mesh conversion and identity manifests change representation, units and display coordinates; they do not modify the source design. Preserve this notice, `LICENSE.md`, provenance and the accompanying source when redistributing the display derivative. The browser displays the prebuilt GLB and does not edit the native Fusion document.

The original assembly and any derived display are not manufacturing approval, joint constraints, collision verification or physical testing.
