# Allegro and Robotiq integration — 19 October 2026

The [Allegro hand](../examples/allegro-hand/README.md) and
[Robotiq gripper](../examples/robotiq-gripper/README.md) each provide a
35.56-second English loop with source-based joint motion, link separation,
a local detail and reassembly. Viewing assets and pinned source bytes are
included; original music is reproducible locally. Source geometry retains
model-specific BSD-2-Clause terms. Original adaptation code and music use MIT.

## Compatibility with the shared study runtime

Both example servers now reuse `shared/study/preview-server.mjs`. They serve
the newly introduced style and spec-label dependencies through the common
explicit runtime list, retaining their own asset/source allowlists and default
ports 4185 and 4186. They also participate in the page dependency graph and
HTTP runtime checks. No global server, skill or permission is installed.

The integration check on 19 October passed **631 tests, with zero failures or
skips** in the author's working checkout, including 21 focused server/example
checks. The project test suite runs in GitHub's Node 22 / 24 workflow on push;
that workflow's live result is separate from this local result. The final
staged release scan checks the exact Git index for private files, high-confidence
credential patterns, source notices and package size before publication.

## Reading the earlier delivery records

Each example's `validation.md` and `delivery.json` retain the **18 October**
authoring review. Desktop and narrow-screen inspection, playback and the
original runtime fingerprints belong to that version. After the upstream
style/spec-label refactor and this server/documentation integration, several
fingerprints intentionally differ. Running the delivery checker on those
historical records therefore does not verify the current package. Their
digests and review dates are not rewritten merely to turn the checker green.

The source geometry, mechanical adapters, story, camera plans and original
music are unchanged by this integration. The current automated suite verifies
their invariants and dependency delivery; it does not establish a new complete
visual or listening review. No new film export is claimed. Human listening,
encoded-video readability, contact/force simulation, and manufacturing-level
internal components remain outside this release's verified scope.

Use the [example guide](../examples/README.md) for exact startup/rebuild commands
and [license notices](../THIRD_PARTY_NOTICES.md) when redistributing the models.
