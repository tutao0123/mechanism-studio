# Historical lock comparison

This folder is retained development history, **not an unfinished new assembly**.
`anatomy.html` is the early, self-contained Chinese Anatomy-style lock diagram
used during the comparison stage. It is not the maintained Mechanism Studio
viewer and requires no sibling Anatomy checkout. Keep its embedded source
attribution and the repository's [Anatomy notice](../../THIRD_PARTY_NOTICES.md#anatomy).

For the current interactive lock, use [`prototype-3d/`](../../prototype-3d/README.md):

```sh
npm ci
npm run preview
```

Open [the five-pin lock](http://127.0.0.1:4179/prototype-3d/?palette=line-light).
The `examples/lock-comparison/` compatibility entry redirects there; the old
`anatomy.html` remains archived on disk and is not exposed by the preview server.
For implemented models and real source assemblies, use the
[example guide](../README.md) or [status audit](../../docs/examples-status.md).
