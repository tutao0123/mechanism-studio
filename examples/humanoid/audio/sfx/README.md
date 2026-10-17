# Kenney sound-effect subset

Five CC0 effects from **Interface Sounds 1.0**, created by Kenney. The original pack is at [kenney.nl](https://kenney.nl/assets/interface-sounds); the WAV packaging is [Calinou/kenney-interface-sounds](https://github.com/Calinou/kenney-interface-sounds/tree/4596a49eaf5a533948d49a47467f606bcdea70ff).

The source commit is `4596a49eaf5a533948d49a47467f606bcdea70ff`. Each local WAV is an unchanged download of `addons/kenney_interface_sounds/<filename>` at that commit. The upstream packaging converted Ogg to WAV; no further conversion, normalization or trimming was applied to these copies.

| File | Measured duration | Suggested editorial cue |
| --- | ---: | --- |
| `maximize_003.wav` | 0.211882 s | A major group begins separation |
| `minimize_003.wav` | 0.222041 s | A group starts returning |
| `click_003.wav` | 0.018866 s | A part seats; use sparingly |
| `tick_002.wav` | 0.023220 s | One close detail or focus cue |
| `confirmation_001.wav` | 0.294603 s | The final assembly is restored |

All are 44.1 kHz mono PCM16 WAV. Each passed FFprobe inspection and a complete FFmpeg decode with errors treated as fatal. This is an objective integrity check, not a claim that subjective listening was performed.

[`LICENSE.Kenney.txt`](LICENSE.Kenney.txt) is the upstream license file, retained byte-for-byte. The effects are **CC0-1.0**, not reissued under MIT. Kenney does not require credit; Mechanism Studio keeps it for traceability. [`provenance.json`](provenance.json) records source URLs, Git blob IDs, SHA-256 hashes and measured audio properties.

The cue mapping is a production suggestion. Mix gain, filtering, fades and exact action times belong in the example's score and derived mix manifest. These stylized interface sounds are not recordings or verified acoustics of the robot.
