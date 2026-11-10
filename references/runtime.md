# Deterministic runtime and resource control

## Version discipline

For a new project, run `npm view hyperframes version`, inspect relevant release/docs
changes and pin the chosen version exactly. Existing 0.9.19 projects remain valid
historical evidence. On 2026-11-08 npm reported 0.9.23. Never call either version
“latest” without a new check. CLI quality names have changed; consult the installed
`hyperframes render --help` instead of copying an unsupported `standard` preset.

Use local dependencies and a lockfile. Prefer the local binary or `npx --no-install`
after installation, so a render cannot silently download a different version.

## Project shape

```text
film/
  package.json, package-lock.json
  index.html, style.css
  copy.json, palette.json, settings.json
  scenes/                 # one module per editorial scene
  shared/                 # draw helpers / deterministic runtime
  scripts/                # build / render / seek-check / verify
  assets/                 # fonts + licenses, approved media
  .cache/                 # derived frames, PCM analysis; owned by this project
  .build/                 # regenerated composition, never the editing source
  out/                    # candidates, masters, QA evidence
  previews/               # budgeted MP4, selected stills, contact sheet
  STYLE.md, ASSETS.md, REVIEW.md, STATUS.md
```

Derived cache keys should include source checksums, settings, and the generating
script version/content. A present frame directory is not proof it matches the edit.
Use relative symlinks to avoid duplicating large project-owned caches where the
toolchain supports them; keep target ownership and cleanup explicit.

## Frame sources

Timed hosts use stable IDs and composition metadata. The root specifies dimensions,
FPS, finite duration and `data-no-timeline` if no timeline is registered. Register
before initialization completes; no dummy GSAP timeline is necessary.

```js
const ready = initializeAssetsAndFonts();
const unregister = window.__hyperframes.registerFrameSource({
  element: document.getElementById('scene-01'),
  ready,
  async render(sourceTime, signal) {
    await ready;
    if (signal?.aborted) return;
    const frame = Math.round(sourceTime * fps);
    const image = await loadKnownLocalFrame(frame);
    if (signal?.aborted) return;
    drawCompleteFrame(frame / fps, image);
  },
  dispose() { releaseOwnedResources(); },
});
```

The callback receives **source time**, which includes playback inpoint/rate semantics.
For a host with no offset/rate edit it is scene-local time. Add the planned scene
start only when global film time is needed. Avoid applying offsets twice. With
`sourceRange`, inspect the installed contract and clamp to the last valid source
frame. Overlapping scenes need separate source instances.

`ready` preloads fonts/static assets. Long immutable local frame sequences may be
decoded on demand with a bounded promise/image cache, provided `render` awaits
completion. This is not license for live remote fetches during export. Validate
coverage before rendering; fail on absent media instead of silently painting black.

On every seek, establish the entire output state. For canvas, reset transform,
alpha/composite mode and clear/paint the full frame. For text, compute the substring
from time in both directions. For shaders, set time/seed/intensity uniforms from
the frame index; never rely on a previous frame having rendered. Dispose resources
and honor cancellation; abort cannot interrupt already-running synchronous code.

## GSAP / DOM

Use paused registered timelines following the official contract. Explicitly set
start/end states; avoid cumulative tweens. Use wrappers for independent transforms.
Do not run an independent RAF, CSS animation clock, media `play()` loop or timers.
Keep text in DOM/SVG when independent Studio edits or DOM accessibility/contrast
checks matter; a canvas is not automatically editable as individual text layers.

## Money shot

The picture clock and the composition clock are separate for the opening hold.
`selectMoneyShot` reads `settings.scenes`: an explicit `hero: true` wins, otherwise
role and weight score the thumbnail. `pictureForFrame` then draws the settled
local frame during the hold. Output frame numbers, scene durations and the audio
element's `data-start="0"` stay put. A cold open is an overlay of a later scene's
settled picture for a short prefix of scene 0; it does not insert frames.

Build injects `window.__HYPERRIZZ_MONEY_SHOT__="0"` only when the switch is off,
so the browser bundle matches the Node plan. Write `.build/money-shot.json` with
that plan. Seek tests must sample motion after the hold: frames inside the hold
are the same settled picture on purpose. Compare frame 0 with the settle frame
when the treatment itself does not change pixels every frame.

## Determinism test

Expose a test hook calling the **same renderer** used by the frame source. Hash
screenshots or canvas PNG pixels at representative times, including each cut at
−1 / 0 / +1 frame. Repeat reverse and in a fixed shuffled order, ideally also a
cold browser run for stronger reproducibility. Assert no browser errors.

Include a known animated interval and, if present, an effect-intensity toggle that
must change pixels. Static frames passing equal-time comparison prove very little.
GPU/browser/font/environment changes can alter rasterization; record those inputs.
EOH required removing transform-layer promotion to eliminate a real text-pixel
inconsistency. Investigate the cause before introducing tolerance.

The bundled starter seek check stubs only registration and drives the production
render callback. It tests author determinism, not HyperFrames integration by itself;
run framework checks and an actual render too.

## Bounded execution

- One render at a time. Keep browser capture, framework checks and render serial.
- Default to two workers, `nice -n 19`, and two-core `taskset` affinity on Linux.
- Derive affinity from allowed CPUs, not an assumption that cores 0 and 1 exist.
- HyperFrames may derive encoder threads from available parallelism. Affinity
  limits that independently of `--workers 2`; recheck on a new release/platform.
- FFmpeg: decoder `-threads 2` before `-i`; encoder `-threads 2` on the output;
  use `-filter_threads 2` and `-filter_complex_threads 2` for relevant filter graphs.
- Bound native-library threads for heavy NumPy/BLAS tasks if used.
- Use a per-project lock and a shared-host render lock; do not remove a stale lock
  until the recorded owner is confirmed stopped. PID reuse is possible.
- If two workers fail or exhaust memory, retry one worker after diagnosing the
  actual error. Do not launch a second job while the first is still alive.

Keep logs and job IDs. Long commands can run asynchronously, but wait for their
completion notifications rather than repeatedly inspecting progress. After an
interruption, inspect files/status before resending patches or duplicating renders.

## Known traps

| Symptom | Check |
| --- | --- |
| Silent export | Timed `<audio>` has ID, correct duration/track/src, real nonzero PCM |
| 45s initialization stall | Missing `data-no-timeline` or unregistered timeline |
| Preview okay, export black/stale | Unawaited decode, unsupported codec, frame source ready/render |
| Reverse seek wrong | Accumulated state, typing not cleared, stateful randomness |
| Main highlights wrong chord | Phase restarted at Main instead of preserving source clock |
| Resource spike despite two workers | Internal encoder threads / duplicate browser jobs |
| Link works but old visuals | Stills/build newer than published MP4; rerender and verify |
| Check says no contrast problems | Canvas has zero audited text elements |
| Thumbnail is black, blank, or mid-fade | Money shot off, `settleFrame` before the hero is finished, or frame 0 was not inspected on the encoded file |

Keep the first actionable failure; the final “render failed” line alone is not
diagnostic. Use `doctor`, lint, local CLI help and the version-matched docs.
