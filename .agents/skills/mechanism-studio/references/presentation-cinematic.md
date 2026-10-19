# Optional Cinematic presentation

Read this profile when the user requests a cinematic, technology-film or dramatic product-reveal treatment. It coordinates the existing camera, appearance, choreography and audio contracts; it is not another installed skill or a global renderer setting. **White-background fine-line Atlas remains the default.** Preserve that edition and create a separate Cinematic entry, timeline and output when requested.

Style and pace are independent. For a requested short cinematic social film, start with **Showcase · Fast**, around 18–24 seconds, unless the user supplies another duration. A longer Cinematic explanation may use Detailed or Explain. Select fewer clear observations before accelerating everything. Neither 24 seconds nor 120 BPM is a universal requirement.

## Preserve the mechanism

Reuse actual part/occurrence IDs, geometry revisions and the supported mechanism adapter. Presentation may alter lighting, camera and display separation; it does not change dimensions, tooth ratios, mating evidence or source placement. Magnify a detail through the camera, never by enlarging, duplicating or replacing the selected part. Photorealistic shading and editorial sound do not certify material grades, tooth contact, torque or collision-free disassembly.

Record the chosen style, pace, deliverable aspect ratio, output resolution, preserved edition and source assumptions in the brief. Pass the same clock and revisions through [module orchestration](module-orchestration.md).

## Camera and composition

- Plan a clear visual progression: recognizable whole, purposeful reveal, causal detail and restored whole. A close-up must establish where its components came from. Keep the decisive engagement or other result readable rather than obscuring it with the largest camera move.
- Perspective is appropriate for this profile. Author fixed poses against conservative motion/explosion envelopes, including intermediate extraction and still-visible context. Reserve title and caption space for the final aspect ratio. Moving geometry must not drive per-frame fitting, focus hunting or camera shake.
- For a continuous film, author a seekable path with at least **C1 continuity**: position, look target and field of view/scale have continuous first derivatives. A Hermite path is one implementation. Sample the same absolute time for preview and export; the interactive director's captured-start transitions remain appropriate when returning from exploration.
- For a looping film, match endpoint position, target and lens, and match their endpoint velocities; settling both ends to zero is one option. Deliberate editorial cuts are allowed, but classify them as cuts rather than calling them smooth transitions. Inspect the first frame directly at its planned pose.
- Alternate approach, observation and return. A small arc or controlled push can provide energy without constant orbit. Settle near-part labels during reading; any name leaders remain short and bound to actual projected parts. Use fewer labels rather than remote HUD callouts.

The [Camera Direction contract](modules/camera-direction.md) still owns framing and recovery. Finite poses and continuity tests do not establish that the model fits or that a contact region is visible; inspect real rendered views at the delivery dimensions.

## Materials, light and typography

Use a restrained dark studio setting with readable PBR surfaces when that matches the request. Distinguish steel, polished edges, bronze and graphite through a small set of occurrence-bound appearance roles. Physical material descriptions remain sourced facts or explicitly authored visual choices.

- Prefer broad, soft key/reflection shapes, a restrained rim and enough fill to reveal geometry. A warm/cool separation may help, but cyan glow must not wash out tooth faces or become a substitute for lighting. Check both the whole assembly and tight detail views.
- Procedural studio environments and subtle machining grain avoid unnecessary asset dependencies. Grain is stable in object/world coordinates, filtered or reduced at smaller projected scales, with no per-frame randomness. Low roughness, fine grooves and narrow highlights need motion review: a crisp still can shimmer badly in a film.
- Preserve neutral contrast before adding a small power-path/process accent. Bind that accent to the actual adapter state and IDs; restore the current base appearance when it ends. An emissive accent communicates a declared path, not measured heat or load.
- Override Atlas typography **only for this edition**: large, concise English sans-serif titles, one short observation beneath, and a quiet identity/credit area. Reserve space rather than overlaying dense boxes on useful mechanism detail. The default Atlas serif styling remains unchanged elsewhere.
- Design text for its displayed video size. Shorten copy and enlarge essential labels before adding more graphics. Check the encoded film at phone-sized display widths at authored speed; website CSS sizes alone do not validate film typography.

Apply the [Materials & Lighting contract](modules/materials-lighting.md) for source-safe bindings, color management, resource terms and restoration. Do not assume the existing orthographic feature-line renderer also supports a perspective PBR edition; use an adapter that implements the chosen treatment.

## Motion and music pacing

Use one deterministic, seekable time domain for mechanical poses, display offsets, camera, captions, process cues and audio. If reusing an existing story through a time remap, preserve its causal order and derive real action-event times through that same remap. Retiming changes the delivery evidence, not the mechanical equations.

Speed ramps are editorial tools. Preserve readable periodic motion and important engagement windows; speeding an entire gear train can produce apparent reversal. At the actual encoded frame rate, check the fastest visible repeating teeth/splines: half a pitch per frame is an alias boundary, not a quality target. Leave margin and review rendered motion. Prefer accelerating stationary assembly/reveal passages or removing repeated explanation before rushing a causal close-up.

When music is selected, arrange original code synthesis for this edition: a restrained bass pulse, open sustained tones/plucks and sparse separation, settle or engagement accents are useful options. Choose tempo and density for the story, not a prescribed BPM. Bind accents to visible action starts/results and real part/group IDs, not merely shot changes or every screw. Keep headroom and avoid a constant wall of impacts. No narration is required.

Use the same media clock during audible playback and explicit frame timestamps offline. Keep each soundtrack's synthesis parameters, seed/revision, duration and hash; measure the final mix and listen before claiming subjective review. Follow [audio delivery](audio-delivery.md) for provider choices and licensed samples when requested.

## Direct film composition and evidence

For an exported film, prefer deterministic rendering of the model and graphics into fixed-size render buffers, followed by video encoding. The surrounding window, tab resizing, desktop scaling and wall-clock render time must not define the film. Keep preview controls outside the composed frame. Await each frame's model/graphics completion and preserve the exact ordered frame sequence; never drop frames to maintain real-time playback.

Bind the final output to the actual timeline, camera, renderer, font/layout and score revisions. Before a full export, inspect an opening and a moving/detail frame. Then verify complete sequence, resolution, FPS, duration, decode, audio timing and loop seam. A static identity-strip comparison can detect incomplete or unstable composition, but cannot prove that moving geometry is flicker-free. Watch the encoded full loop, review dense/moving details and phone-sized text, and listen to the muxed score. State which checks actually ran, using [delivery evidence](delivery-evidence.md).

The [gearbox Cinematic edition](../../../../examples/gearbox/cinematic/README.md) is the executable reference: a 24-second film using an independent perspective/PBR adapter, C1 camera, original mechanism time remap, action-linked synthesized score and direct WebGL + Canvas composition. Its duration, 120 BPM score, camera coordinates, fonts and export region belong to that example. Copying a style name does not add its adapter to another page, and there is no universal `cinematic` URL flag or automatic two-edition generator.
