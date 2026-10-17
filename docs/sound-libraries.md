# Sound effects for mechanical stories

Reviewed on 2026-10-18. The humanoid example uses five small CC0 sounds from Kenney, alongside an original code-generated score. Sound effects are editorial cues synchronized with the story; they are not recordings of the displayed robot or the output of a physical simulation.

## Sources and licenses

| Source | What it provides | License and repository policy |
| --- | --- | --- |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | 100 short interface effects; a useful restrained vocabulary for separation, seating and focus | CC0. Five WAV files are included in the humanoid example. Credit is optional, but provenance and creator credit are retained. |
| [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | 70 effects with a more electronic character | CC0. An option for later stories; no files from this pack are included. |
| [jsfxr](https://github.com/chr15m/jsfxr) | JavaScript synthesis from editable parameters | The project uses the [Unlicense](https://github.com/chr15m/jsfxr/blob/master/UNLICENSE), not MIT. A generator rather than a recorded-sample collection. Not installed or bundled here. |
| [jfxr](https://github.com/ttencate/jfxr#license) | Browser editor and a synthesis library | The README states BSD-3-Clause for code and unrestricted use of sounds the user creates. Before vendoring code, retain the actual license and notices for the chosen version. Not installed or bundled here. |
| [Freesound](https://freesound.org/help/faq/#licenses) | A broad collection of individual recordings | Licenses vary by sound: CC0, CC BY and CC BY-NC. Choose and document each file separately; there is no blanket license for the collection. No files are included. |

The [Sonniss GDC bundle](https://sonniss.com/gdc-bundle-license/) is a useful production resource but is not an open-source sample library. Its current license permits synchronized project use while restricting redistribution of the sounds as assets, including in templates and SDKs. It is therefore excluded from this reusable repository.

## Included CC0 subset

Files, the upstream license and a machine-readable provenance record are in [`examples/humanoid/audio/sfx`](../examples/humanoid/audio/sfx/README.md). They come from the [Calinou packaging of Kenney Interface Sounds](https://github.com/Calinou/kenney-interface-sounds/tree/4596a49eaf5a533948d49a47467f606bcdea70ff), pinned to a commit. The mirror converted the original Ogg files to WAV. Mechanism Studio retains the downloaded WAV bytes unchanged; any leveling or filtering happens in the derived mix.

## Default authoring policy

Prefer original deterministic synthesis or a small CC0 subset. Track creator, source URL, exact revision, source bytes, license, processing and the final mix digest. CC BY needs its attribution and change notice carried into the delivered work. Do not import NC or redistribution-restricted samples into the default reusable library.

Bind a cue to a named animation event, on the same timeline as the score. Use a soft envelope and low level, leave reading pauses, and avoid a sound for every label or screw. Preserve the original files and record mix changes separately. Check the final peak, loudness, loop seam, pause, seek and restart behavior; listen before claiming a listening review.

The repository's MIT license covers its original implementation and documentation. It does not rename third-party audio licenses or imply authorship of those sounds.
