# Cinematic gearbox score

This separate 24-second, 120 BPM edition uses original code synthesis: a warm sub-bass pulse, rounded kicks, airy plucks, suspended minor chords and sparse action accents. The synchronizer macro drops to a more spacious half-time feel. The final impact decays into a short, smooth loop seam. There is no speech, external sample, recorded machine sound, or audio API call.

Rebuild from the project root:

```sh
node examples/gearbox/cinematic/audio/build.mjs
```

The output is `gearbox-cinematic-loop.wav`: stereo PCM16, 48 kHz, exactly 24 seconds / 48 beats. `music-score.json` records every musical event, deterministic seed, actual part IDs, geometry revision, file hash and checks on the encoded PCM. The waveform encoder is shared with the original gearbox score; the composition, instruments and event plan belong to this cinematic edition. Source and original synthesized audio use the project's MIT license.

| Time | Authored action | Sound |
| --- | --- | --- |
| 0 s | Whole gearbox reveal | Soft low rumble and rounded pulse |
| 2.167 s | Case begins to open | Short airy rising whoosh |
| 5 s | Explosion begins | Low impact with a soft noise transient |
| 8 s | Power-path introduction; first engagement at 8.625 s | Harmonic bass pulse |
| 12.167 s | Synchronizer macro | Sparse shimmer, lighter half-time texture |
| 15.5 s | Sleeve finishes engagement | One short, layered clack |
| 17.167 s | Overdrive introduction | Restrained harmonic pulse |
| 21.383 s | Case begins closing | Soft descending sweep |
| 22.5 s | Assembled end card, after shell closure | Low resolving impact and two bell tones |
| 24 s | Loop boundary | Both channels reach zero |

Mechanical cue times are imported from `../timeline.mjs` through its exact inverse remap; the table rounds them for readability. The score records that timeline revision and its Hermite remap knots. Overdrive introduction and the end card are explicitly editorial accents. These cues are bound to named actions and real part IDs, not a physical contact-acoustics simulation. Retiming a visible action requires rebuilding the WAV and reviewing synchronization. Native music playback should be the page's clock; export should mux the same WAV into the deterministic frame sequence.

The master uses linear peak normalization to −6.4 dBFS with an 8 Hz DC blocker and smooth fades; it does not use distortion or a hard limiter. The builder checks exact duration, sample peaks, clipping and the loop boundary. Check intersample headroom independently:

```sh
ffmpeg -hide_banner -i examples/gearbox/cinematic/audio/gearbox-cinematic-loop.wav -af ebur128=peak=true -f null -
```

Objective waveform checks do not establish subjective listening quality or audiovisual timing; review the final rendered video as well. The existing 40-second atlas score is unchanged.

For the generated file with SHA-256 `40affbc162a044ab52f5254d3bda4574e0cdce6ea5cdde44e93cfc9c4141da74`, FFmpeg's oversampled `loudnorm` input measurement reports −6.40 dBTP, −22.71 LUFS integrated and 4.90 LU loudness range. No normalization from that diagnostic was written to the file. The final PCM has zero clipped samples and zero endpoint discontinuity; two builds produce identical bytes. These are measured properties of this revision, not a listening assessment.
