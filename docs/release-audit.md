# Release security and packaging

Mechanism Studio is published from this directory as an independent repository.
Its original code and documentation use MIT; upstream models retain the licenses
listed in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). A passing security
check does not relicense an asset or replace that source review.

## What enters Git

The public tree includes source code, the project-local skill, its module
references, tests, editable procedural builders and inputs, runtime GLB assets,
original music synthesis code with score hashes, and licensed upstream model
descriptions (URDF/MJCF) with their licenses and provenance. Upstream STL
meshes are referenced by pinned commit URL and SHA-256 in
`scripts/upstream-sources.json` and downloaded with `npm run fetch:sources`; every included
model license permits that, and none requires shipping corresponding source. Dependencies are installed from the lockfile with `npm ci`;
machine-specific runtimes and downloaded checkouts are not vendored.

The following stay local and are ignored without deleting them:

- Credentials, environment files other than blank `.env.example` templates,
  per-machine tool settings, caches, Python environments and installed packages.
- Raw browser screenshots, account/session captures, capture frames, reports
  under `output/`, and rendered social/video deliveries.
- Locally generated `.blend` scenes, which contained embedded machine paths.
  The public procedural Python builders, input specifications and GLBs remain
  available. Regenerate an editable scene locally when needed.
- Provider-generated MP3 narration. The release retains lesson text, manifests,
  measured timing and synthesis scripts, but does not assume the provider's
  output and voice rights can be sublicensed under MIT. Existing local audio is
  preserved. Original code-generated score WAVs are rebuilt locally from their
  retained synthesis code and hash manifests with `npm run build:audio`; only
  the five Kenney CC0 effects are kept as WAV files.

The lock preview PNG received metadata-only cleanup: ancillary EXIF/text chunks
were removed while the compressed `IDAT` image data and 1400 × 1000 dimensions
remained unchanged. Other model and source bytes were not rebuilt for privacy.

## Reproduce the checks

```sh
npm ci
npm test
npm run release:check
git add <reviewed paths>
npm run release:check -- --staged
```

The default check audits the exact union of Git's tracked files and untracked,
nonignored candidates. It does not recursively upload a folder. After staging,
`--staged` reads the index blobs themselves, so a clean working copy cannot hide
an unsafe staged version. No command above commits, creates a remote or pushes.

Both modes write the local, ignored `output/release-check.json`. It contains
paths, byte lengths and SHA-256 digests, plus path-only findings. Matched
credential values are never printed or saved. The gate checks:

- Known credential formats, private-key headers, authenticated URLs, literal
  credential assignments and nonempty npm authentication settings. Template
  files are scanned too; only explicit placeholder values are accepted.
- Personal-machine and credential-store paths, including strings embedded in
  binary data; private file classes still fail when force-added to Git.
- Symlinks, submodules and files resolving outside the repository.
- CAD provenance that explicitly forbids redistribution or lacks permission
  for a user-provided source.
- Reviewed file types and repository size budgets: **95 MiB per file** and
  **300 MiB total**, below GitHub's individual file limit. Generated study
  score WAVs are not shipped: `npm run build:audio` rebuilds each one and checks
  it against the byte length and SHA-256 in its `music-score.json`. Upstream
  robot meshes are fetched, not shipped.

Tests exercise redacted findings, forced private entries, unsafe `.env.example`
content, ignored files, staged/working-copy divergence, optional complete media
sets and unauthorized CAD provenance. Missing optional narration is allowed;
a partially missing local set still fails, and complete local sets retain their
byte/hash verification. Lesson, identity and timing checks always run.

## Scope of the result

This is a deterministic preflight, not a guarantee that arbitrary secrets,
compressed metadata or every legal issue can be detected automatically.
Third-party/native archives require provenance and license review. Curated
public illustrations require a visual privacy check before copying them into
`docs/media/`; ignored account screenshots must not be copied there wholesale.
When files change, rerun the checks on the final staged tree before pushing.
