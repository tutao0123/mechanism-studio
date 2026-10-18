# Sun / planet macro target audit

This is a source-geometry and sightline recommendation for the new macro. It does not validate the final browser framing, encoded video, tooth contact forces or complete 3D clearance.

## Bound occurrences and axial row

- Sun: `occ-b352183e1bd0-root-953098-767` (`sun-gear`), 96 source teeth.
- Recommended planet: `occ-b352183e1bd0-root-953098-774` (`planet-4`), 24 teeth in the larger middle row. Its source center is `[-0.03117699921131134, 0.01100000087171793, 0.05400014854967594]` metres.
- Alternative: `occ-b352183e1bd0-root-953098-769` (`planet-10`). Both are actual, distinct retained source occurrences.
- World axis remains `[0,-1,0]`; preserve all source tooth phases and the existing v2 mechanical adapter. The middle planet row between world Y≈0 and 0.022 m meshes the sun and central output rings. The narrower end rows mesh the fixed plates. The macro must not describe the foreground end row as the sun-contact row.

The center distance is approximately 0.062354 m. Using the measured 96:24 count ratio, the **ideal pitch-region target** is 0.8 times the planet's radial center, with a chosen axial section such as world Y=0.004 m. This is a camera anchor derived from ideal pitch geometry, not a measured physical contact point. At source rest its location is approximately `[-0.0249415994, 0.004, 0.0432001188]` m. Rotate the radial part only by the existing orbit angle `8/21 * sunAngle`; do not follow the planet's body spin or an arbitrary tooth vertex. This follows the mesh region smoothly while both actual gear bodies continue moving.

## Occlusion diagnostic

The existing view direction is normalized `[0.25,-0.95,0.35]`, whose lateral azimuth is approximately 54.46°. Planet 4's center sweeps from 120° to 154.29° during the forward motion, approximately tangent to that lateral view. Planet 1 is on the near radial side and its narrower end row obscures more of the intended middle-row interface.

`mesh-sightlines.mjs` reads the unchanged GLB and casts 77 rays through a 6×10 mm patch at the ideal pitch region for three input phases. Only the actual sun and candidate planet participate, so results do not include other rings/plates. Counts of first hits on the middle axial rows are:

| Planet | Input 0.3 rad | Input 0.8 rad | Input π/2 rad |
| --- | ---: | ---: | ---: |
| 4 | 16 / 77 | 22 / 77 | 17 / 77 |
| 10 | 12 / 77 | 18 / 77 | 16 / 77 |
| 1 | 4 / 77 | 4 / 77 | 4 / 77 |

These sparse ray counts are a candidate-selection diagnostic, **not** a pixel visibility score or a claim that all useful teeth are unobscured. The positive/negative Y classification also does not distinguish every chamfer from a tooth flank. Actual screenshots and playback must decide the final readability. Fade plates, output rings and unused planets as observation-only context before a tight crop; do not move teeth apart, duplicate the selected planet or change its mesh scale. If the original oblique view remains unclear, a small smooth approach toward the axial direction is preferable to falsifying the assembled tooth geometry.

Use the existing [gear evidence](../../tour/research-v2/gear-evidence.md) and [independent phase/clearance audit](../../tour/research-v2/audit-transmission.md) for count, ratio and contact limitations. This note adds a camera anchor and sightline diagnostic only.

## Reproduce

```sh
node examples/wolf-actuator/tour-v3/research/mesh-sightlines.mjs
```

Original diagnostic code is MIT. Retained source geometry and geometric observations preserve WOLF's CC BY-SA 4.0 attribution; source bytes remain unchanged.
