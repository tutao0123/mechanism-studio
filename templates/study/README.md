# A plan-backed study

This is a wiring template, not a rendered example. Keep new work in its own
`examples/<name>/` directory. For runnable references use the
[gearbox](../../examples/gearbox/example.mjs),
[Robotiq gripper](../../examples/robotiq-gripper/example.mjs) and
[planetary reducer](../../examples/planetary-gears/example.mjs). The template is
part of the v0.4.1-alpha.1 public alpha; its contracts may evolve.

1. Prepare a licensed asset, provenance, scene contract and scene index with
   stable occurrence IDs, source transforms, bounds and a geometry revision.
2. Make `presentation.mjs` export `createPresentation(index)`. Compile the JSON
   plan with `compilePresentationPlan(plan, index)` and adapt its world offsets
   to the actual source-parent transforms. Attach verified `workingPoses(state)`
   separately. A plan never invents a joint or rewrites source geometry.
3. Copy `example.mjs` here into your example. Supply its factory and real source
   metadata. Adapt the explicit local resource URLs to your server routes.
4. Start it from `app.mjs`:

   ```js
   import { startStudyExample } from '/shared/study/example.mjs';
   import { defineExample } from './example.mjs';
   import { createPresentation } from './presentation.mjs';

   await startStudyExample(defineExample({
     id: 'my-mechanism', title: 'A mechanism, revealed.',
     sourceName: 'Actual source and license', creditLabel: 'Actual attribution',
     createPresentation,
   }));
   ```

5. Use the study CSS/import map from an existing `index.html`, and the shared
   read-only preview server with an explicit list of your example's resources.
   Do not serve arbitrary project files. Reuse the shared runtime file list.
6. Build the score at exactly the plan's BPM and duration, then verify source
   identities, absolute-time seeks, reassembly, portrait framing, labels and a
   full loop. The current report CLI registers **gearbox**,
   **robotiq-gripper** and **planetary-gears**; another example needs an explicit registry entry or can
   call `inspectPresentation()` from its own test.

The page exposes `window.mechanismStudy`: await `.ready`, then call `.play()`,
`.pause()`, `.seek(seconds)`, `.reset()` or `.snapshot()`. `?capture=1` adds
monotonic frame sampling through `.capture`; use the existing direct-frame
compositor and video encoder when delivering a film.

See the [runtime API and plan schema](../../shared/study/README.md) and the
[skill workflow](../../.agents/skills/mechanism-studio/references/executable-presentation.md).
Keep browser and exported-video inspection separate from numerical checks.
