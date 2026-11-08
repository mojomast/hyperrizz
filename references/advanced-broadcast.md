# Advanced broadcast production: the Hermagotchi techniques

Use this reference for multi-scene genre treatments, shader compositing, pixel art,
character customization, replay, source slots and synthesized broadcast effects.
The companion [kit](../kits/broadcast/README.md) and
[runnable lab](../templates/broadcast-lab/README.md) turn these lessons into code.

## Design multiple genres inside one identity

Hermagotchi used test bars, a weather map, home-video footage, an infomercial, fight
night, public access and an educational plate. The channel system created a reason
to change composition, presenter, motion and pacing. A global CRT pass tied those
genres together; it did not replace scene design. Use a cast/asset coverage table
so a large roster and cosmetic collection are deliberately shown, not accidentally
omitted. Keep each scene a separate module and each repeated visual system a helper.

## Whole-frame treatment, not CSS decoration

The robust pipeline is **await assets → draw clean scene → draw OSD → upload current
canvas texture → WebGL2 pass → await export capture**. This makes sprites, footage
and type inhabit the same image. Review the clean source too: noise cannot rescue
bad hierarchy, unreadable copy or a false claim.

The kit demonstrates:

- Barrel curvature with explicit outside-image black and a safe content inset.
- RGB/channel separation and a source-resolution-aware pixel kernel.
- Highlight bloom from neighboring current-frame samples.
- Spatial echo/ghosting from an offset of the same frame.
- Scanlines and RGB phosphor sampling.
- Vignette, tape tracking, line dropout, head-switching noise and rolling hum.
- A short, separate channel-change static envelope.
- Horizontal collapse to a line/dot and finally black.

No temporal accumulation is needed. Hash the frame index and spatial cell with a
fixed seed; do not advance a random generator on each seek. Avoid framebuffer
feedback for ghosting unless you can deterministically reconstruct all its history.
GLSL sine hashing is stable in a fixed browser/GPU environment, not a promise of
bit-identical output across GPU vendors. Record the renderer and test there.

Expose intensity 0–1. Compare 0, authored and maximum. A control must change pixels,
and clean bypass should preserve source orientation and colour. Tuning and power-off
can remain separate editorial controls, so explicitly disable them for a truly
clean comparison. Compile/link errors and context loss must be visible failures.
Dispose every allocated resource, including shader objects.

## Native-grid sprites and cosmetic rigs

Use the source manifest, not eyeballed hat positions. Hermagotchi's source artwork
was normalized into 32px runtime sprites; artwork offsets needed conversion to
that grid. The generic kit uses native-pixel offsets explicitly so a hidden `/16`
conversion is not accidentally applied to another game's manifest.

1. Identify native cell size, strip frame count and intended animation FPS.
2. Step frames from absolute time. A three-frame animation can use four authored
   slots `[0,1,2,2]` by holding the last source frame; do not interpolate a fourth.
3. Merge base rig anchors and species overrides.
4. Add per-frame anchor deltas to body-attached layers. Ground/aura layers may stay
   fixed; make that policy explicit.
5. Quantize layer position/size to the native grid, then enlarge by an integer.
6. Sort layers around the body using actual z-order and mirror the complete rig.
7. Verify every intended species, palette, state and selected cosmetic is covered.

Test edge frames, flipped characters, negative z, frame-bobbing accessories and
missing assets. Check the downsampled preview separately: integer placement in the
master does not imply native-grid pixels survive a later 720p resize unchanged.

## Replay and telestrators

Keep **output time**, **scene-local time**, **source media time**, and **sprite
animation time** distinct. A replay segment can map `source = 0.5 + replayLocal*.25`
while the film timecode, presenter and animated annotations advance normally.
Step the source's cached frames; do not accidentally apply the 0.25 factor twice.
Hold the correct final frame, rather than requesting a nonexistent last filename.

Draw rings/arrows with time-derived stroke progress. If an arena, HP bar or KO is
an illustration, label it visibly. A replay of authentic product footage and an
animated fight demonstration have different evidentiary status.

Decode source video once with bounded FFmpeg threads. Use immutable local frame
paths, bounded decoded-image caches and returned render promises. Test backward
seeks after eviction, quarter-speed frame indices and abort/missing-frame failures.

## Replaceable production slots

For films awaiting media, use a named slot manifest: ID, expected image/video/audio
type, source path, dimensions, scene, inpoint/rate, duration and provenance status.
Missing input should fail or display a deliberately labelled proof slate according
to the delivery mode. It must not silently masquerade as a screenshot.

Keep one-time asset import separate from normal build. The original import utility
generated default copy and silent dummies; rerunning it over final user media would
have overwritten production inputs. Build should prepare derived files only, with
hash keys and precisely owned cleanup paths. Do not delete a generic media folder.

Preserve verbatim NPC quotes with source context/index. Real catalog prices come
from source data, not creative copy. Capture slots and synthetic illustrations can
coexist, provided their identity is visible and the review report states what is
still required. Preserve original licenses for imported artwork and fonts.

## Broadcast audio is its own layer

Create station idents, tuning cuts, UI pips, bells and power-off cues against the
same edit map. Offline seeded synthesis is deterministic; per-frame random audio
generation is unnecessary. Apply attack/release envelopes to avoid clicks and leave
mix headroom. Keep VO, music and effects as independently adjustable tracks with
stable media IDs. Silent dummies are placeholders, not finished narration/music.

The lab supplies original sparse effects, not a full musical score. Verify encoded
presence, duration and peak. Choose an integrated-loudness target for a complete mix
when appropriate; do not indiscriminately normalize every isolated effect to −14.
Listen where possible and state if subjective review has not been performed.

## Required advanced checks

- Representative stills for every genre and the densest accessory/text layout.
- Transitions at cut ±1 frame and windows covering tuning/replay/power-off.
- Exact repeated, reverse and shuffled shader pixels in the chosen environment.
- Different time and intensity produce different output; clean bypass matches source.
- Asset/quote/catalog/cast coverage and source hashes where product media is used.
- Correct 1×/¼× frame map, cache bounds, eviction/reload and cancellation behavior.
- Final master/preview decode, duration, audio measurements and combined media budget.
- Inspect the encoded effect-heavy preview: noise compresses poorly and may destroy
  small text before the master shows trouble.

The lab is an advanced regression specimen. Carry its engineering into a new
identity, rather than turning every new video into Hermagotchi Television.
