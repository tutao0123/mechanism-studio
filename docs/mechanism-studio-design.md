# Authoring workflow

Mechanism Studio 0.4 separates planning, mechanical/source evidence and display
implementation. Read the [skill guide](skill-guide.md) for practical usage and the
[module catalog](modules.md) for exact boundaries.

## Begin with the input

Text, images and CAD can be combined. Record supplied facts, visible observations,
authored assumptions and unknowns before proposing geometry. A teaching design
may be authored from text. A photograph may suggest visible shape and appearance;
it does not reveal hidden hardware, native part identity, tolerances or mates.
Retained CAD/URDF bytes provide engineering identity only where mapping is verified.

## Select the route

Use Inspect for source assemblies and static evidence. Use Explain for an
interactive teaching model and lesson. Use Showcase for a short public edit with
independent timing, normally 30–40 seconds. Sound remains a choice: code music for
the present short examples, optional Doubao for requested narration, and silence
for ordinary source inspection.

## Coordinate the specialist modules

Model/import work establishes actual IDs, units, axes, rest placements and a
geometry revision. Explosion establishes display groups, offset ranges, order,
parent compensation and restoration. Appearance establishes reversible materials
and colour meaning. Camera direction uses the resulting motion/visibility
envelopes, then annotation timing reserves settled reading time. Changes in
geometry or displacement invalidate dependent framing/placement evidence.

The brief and per-module plans remain documented handoffs. The
[executable presentation subset](../.agents/skills/mechanism-studio/references/executable-presentation.md)
binds display offsets, orthographic shots, labels and accents/opacity to the real
scene index and common clock. Explicit adapters implement mechanics and other
presentation behavior. Older handoff JSON is not automatically executable, and
the skill does not install or invoke autonomous specialist agents by itself.

## Validate the delivered experience

Check mechanical/source invariants and actual GLB data first. Then inspect normal,
failed, pause, seek, restoration and loop states in the real page. Verify framing,
detail/whole cuts, near-part names and narrow-screen layout. Check actual media
duration and cue alignment; automated audio checks do not establish listening
quality. Use the same model/time arrangement for previews and captured frames.

Keep evidence and controlled output local. Release only reviewed code/assets with
provenance and license scope. Original implementation is MIT; third-party models
and their adapted visual derivatives retain their own licenses. Provider MP3s,
personal-path Blender exports, screenshots and caches are not public release
assets. See [licensing](licensing.md) and [release checks](release-audit.md).
