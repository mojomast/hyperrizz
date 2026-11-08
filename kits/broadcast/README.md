# Broadcast kit

Reusable techniques adapted from Hermagotchi Television, with explicit clocks,
native-grid math and independent controls. Copy this complete directory into a
film; preserve its MIT attribution. The kit is optional: a broadcast treatment
should be chosen because it serves the film, not applied to every production.

| Module | Contract |
| --- | --- |
| `crt.js` | `createCRT(canvas, sourceCanvas, {fps, seed})` → `draw({frame, intensity, burst, collapse})`, `dispose()` |
| `vhs.glsl.js` | Stateless tracking jitter, dropouts, head-switching noise, rolling hum and tuning noise |
| `sprites.js` | `drawSprite(...)` for grid-safe strips/rigs/layers; pure `layerPlacement(...)` |
| `timing.js` | Source-frame/rate/inpoint map, stepped frames, tuning and collapse envelopes |
| `frames.js` | Awaited, bounded `FrameCache` with frame-range checking and cancellation |
| `osd.js` | Output-frame-derived channel, timecode and REC blink |

## Compositing contract

Draw the complete current image into a 2D source canvas, including real footage,
sprites, type and OSD. Pass that canvas through one WebGL2 treatment into the visible
canvas. The shader includes curvature, RGB bleed, neighboring-pixel highlight bloom,
spatial ghosting, scanlines, RGB phosphor mask, vignette and the tape model. It samples
the **current source texture only**; no previous-frame feedback is involved.

Call `draw` inside an awaited HyperFrames frame-source callback after every required
image has decoded. The input is an integer **output frame**; the shader derives time
using the declared output FPS. Resolution-dependent sampling comes from source
dimensions, not a baked-in 1920×1080 assumption. Software WebGL is supported in the
tested browser; WebGL2 absence, shader compile/link failure and lost context fail
explicitly instead of silently delivering a clean or black film.

`intensity` scales wear, not the editorial cuts. `burst` controls tuning static and
`collapse` controls power-off separately. All zero bypasses processing. `dispose()`
is idempotent and releases textures, buffers, shaders and programs.

## Pixel-rig contract

Sprites use horizontal source strips. `clip` specifies `native`, `frames`, `slots`,
`fps` and optional integer `deltas`. A short strip can hold its final frame for the
remaining slots. No tweening or fractional pixel enlargement occurs. Whole-rig
mirroring transforms both the character and every accessory consistently.

Anchors use `[0..1, 0..1]` native-grid coordinates; overrides merge over the rig.
Each layer has `id`, `anchor`, `offset` in native pixels, `scale`, `z`, and optionally
`followFrame: false`. Ground anchors never inherit character bob. Layer dimensions
and positions are quantized on the native grid before integer enlargement. Negative
z draws behind the body; nonnegative z draws in front. Keep real asset manifests
authoritative and validate any conversion from original artwork pixels.

## Source clock and frame cache

`sourceFrame(localTime, {fps, frames, offset, rate})` maps output-local seconds into
the original source frame index, clamped to available media. OSD stays on output time.
Use a separate piecewise segment for replay, rather than slowing the whole film.

`FrameCache` loads `00001.jpg`-style local paths through `assetUrl`. It memoizes decode
promises and keeps a bounded insertion/LRU map. A rejected decode is evicted and
can be retried. `get()` must be awaited. Cancellation prevents a late frame being
used, but does not pretend to abort an already-started browser image decode. A
disposed cache rejects new work. The runtime serializes normal frame-source draws.

See [provenance](NOTICE.md) and the Hyperrizz advanced-production reference for
asset slots, audio cue tracks, claim discipline and integration tests.
