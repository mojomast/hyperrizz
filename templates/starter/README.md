# HyperFrames engineering calibration

Copy this **whole directory** to a new project directory before use. Do not write
builds, caches, dependencies or renders into the installed skill. The tiny two-shot
clip exercises the pipeline; it is not a production design to reuse unchanged.

Requirements: Node 22+, npm, Python **3.11+**, FFmpeg/ffprobe and the Chromium that
HyperFrames provisions. No Python packages are needed. Linux has the full bundled
nice/affinity controls; verify encoder limits separately on other platforms.

## First run

```sh
npm ci
npm run build
npm run lint
npm run check
npm run seek-check
npm run stills
npm run render
```

The default is a **silent 2-second, 640×360, 30fps calibration**. The scene changes
at frame 30. `render` produces a candidate master and 320×180 preview, verifies
both, then replaces `out/master.mp4` and `previews/preview.mp4`. It uses local
HyperFrames 0.9.23, draft encoding, two workers and two-core affinity on Linux.
For a real master select a supported final quality tier from installed CLI help.

`npm run verify` rechecks published files and compares the build fingerprint.
Always rebuild after editing source before using that freshness check. The build
fingerprint describes the generated composition; it cannot detect unbuilt edits.
Do not edit/rebuild while a render is using that composition.

Frame 0 is the money shot. The opening scene is marked `"hero": true` and held at
`settleFrame` 18, where the title is already on screen and the calibration square
sits in a finished position. Frames after that hold continue the real motion.
The check compares those later frames, and it expects frame 0 to match the settle
frame. Audio, when you add it, stays at `data-start="0"`. Set `moneyShot` to
`false`, or export `HYPERRIZZ_MONEY_SHOT=0` (`false`, `off`, or `no`) before
build, to keep the authored first frame instead. `moneyShot: true` forces the hold
on. The verifier measures frame 0 unless that switch is off.

The silent clip produces an expected no-audio informational notice in checks. For a film
with sound, put the finished WAV in `assets/` and set `settings.audio` to its relative
path (e.g. `assets/master.wav`). The generated timed audio element has a stable ID.
Optional `targetLufs` and `maxTruePeak` values enforce encoded audio targets. The
verifier measures audio if present even without target assertions.

## Adapt into a film

- Set actual dimensions/FPS/scene frames, preview size/budget and audio.
- Replace the calibration scene modules and update the runtime's scene imports.
- Add bundled, licensed fonts and explicit `document.fonts.load()` calls.
- Replace all copy and palette values; design from the subject.
- Use one source instance per timed host, keeping initialization/render awaited.
- Add the project's real assets, source clock and provenance assertions.
- Update still times and the motion-sensitive seek interval after changing the edit.
- Add visual, audio and factual review using the parent skill's templates.

The seek test emulates frame-source registration and visibility, then calls the
actual renderer. It does not replace integration checks or an actual encode. Chrome
can be selected with `CHROME_BIN`; the root/container fallback disables its sandbox
only for this local authored fixture. Avoid it for untrusted pages.

## Reusable media verifier

```sh
python3 scripts/verify-media.py out/master.mp4 \
  --width 1920 --height 1080 --fps 60 --duration 40 \
  --audio required --target-lufs -14 --lufs-tolerance 0.6 \
  --max-true-peak -1 --report out/verification.json
```

Use the expected values for the actual film. `--audio forbidden` is explicit for
silent work; `--audio optional` relaxes presence, not requested loudness constraints.
`--max-bytes` checks the actual output. Frame 0 is checked for a finished opening:
mean luma must be above 16 and luma standard deviation at least 8, so a near-black
or blank thumbnail fails. `--money-shot off` skips that check. `--min-luma` and
`--min-luma-stdev` change the floors. Full decode failure or an unmet assertion
returns nonzero. This script does not claim perceptual or product-behavior review.

## Locks and cleanup

The render owns `out/render.lock` plus a shared host lock under `/tmp/opencode`
when that directory exists (otherwise the OS temp directory). Override the latter
with `HYPERFRAMES_RENDER_LOCK` only to point at the host's established shared lock.
The wrapper removes only locks it acquired. Never remove an occupied lock until its
owner and command are confirmed stopped. Other programs must cooperate with the
same lock; it cannot stop a separately invoked renderer from running.

No render script deletes frame caches. `.build`, `out`, `previews` and any `.cache`
here belong to the copied project. Preserve final output before reclaiming them.
