# Hyperrizz · Advanced broadcast lab

**16 seconds · 960×540 · 60fps · original broadcast sound cues.**

This is the runnable effects/rig/replay example materialized by
`node scripts/create-broadcast-lab.mjs /new/project/path` in the Hyperrizz repository.
It builds on the engineering starter and includes the reusable `broadcast/` kit.

## Run

Requires Node 22+, Python 3.11+, FFmpeg/ffprobe and HyperFrames Chromium. No extra
Python packages or remote media are needed.

```sh
npm ci
npm run build
npm run lint
npm run check
npm run seek-check
npm run stills
npm run render
npm run verify
```

Outputs: `out/master.mp4`, `previews/preview.mp4`, `previews/keyframes/`, and the
verification JSON files in `out/`. Render uses the starter's two-worker/two-core
Linux wrapper, shared/project locks and candidate-first publishing. Run browser
checks and rendering sequentially. Use a supported final quality tier for a real
production; this diagnostic lab deliberately uses the starter's draft encoder.

## What you see

| Film time | Treatment |
| --- | --- |
| 0–4s | Finished ident from frame 0 (title, rule, all three labels), then the live cut; full-frame CRT/VHS. Soundtrack stays on the clock |
| 4–8s | Tuning burst, mirrored pixel character, back/head/front layers, native frame anchors, ticker |
| 8–12s | Cached synthetic video: 1× playback, then ¼-speed replay from a separate source inpoint; telestrator |
| 12–16s | Dressed character lineup, perspective rules, repo CTA, CRT line/dot power-off |

The test signal, three-frame sprite, accessories and sound cues are generated
fixtures, labelled **SYNTHETIC TEST SIGNAL / NOT GAMEPLAY**. No Hermagotchi product
art, clips or actual game behavior are claimed. The code's derivation and original
MIT attribution are in `broadcast/NOTICE.md` and `broadcast/LICENSE`.

## Controls and time maps

- Money shot: `scene-signal` is `"hero": true` and `settleFrame` is 108 (1.8s),
  when the ident, rule and all three labels are already on screen. Frame 0 holds
  that picture. CRT and the soundtrack keep the real output clock, so audio is
  not delayed and the export stays 960 frames. `moneyShot: false` or
  `HYPERRIZZ_MONEY_SHOT=0` restores the step-reveal from an empty rule.
- `settings.effectIntensity`: 0 removes CRT/VHS wear; 0.7 is the authored treatment;
  1 strengthens it. Tuning and power-off are separate editorial controls.
- `settings.seed`: stable stateless noise seed. Noise uses the output frame index.
- `draw({frame, intensity, burst, collapse})`: zero all three effect controls for
  an exact source-pixel bypass on the tested software renderer.
- The replay scene uses output-local time 0–2s at 1×. At local 2s it cuts back to
  source 0.5s and advances at 0.25×. OSD/film time continues forward.
- Native sprite frames are stepped at 6fps: a three-frame strip uses slots
  `[0, 1, 2, 2]`. The frame delta moves head/chest items; the ground layer stays fixed.
- Rig offsets are **native pixels** and anchors normalized to the native grid.
  Import the correct units from your own asset manifest instead of guessing.

## Checks beyond the basic starter

`npm run seek-check` exercises 21 selected output frames in forward, reverse and
shuffled order, including cuts ±1 frame, replay transitions and power-off. It also
checks 0/0.7/1 intensity differences, exact clean-pass orientation/pixels, independent
tuning/collapse controls, quarter-speed source indices, bounded frame cache,
re-decode after eviction, invalid-frame rejection, cancellation and browser errors.

These samples are tied to this lab's edit; update them if you change its timing.
Pixel identity is tested in the same renderer environment, not across all GPUs.
The audio verifier measures the actual AAC export and enforces ≤−1dBTP. There is no
integrated-loudness target for these sparse sound-effect cues. This is not a
full score, narrated film or subjective listening-quality certification.

## Generated media and adaptation

`scripts/prepare.mjs` produces a 4-second FFmpeg testsrc2 clip, decodes 240 immutable
60fps JPEGs, and generates `assets/broadcast.wav`. The checksum manifest is included
in the build fingerprint. It reuses a complete matching fixture cache; regeneration
deletes **only** this generator's `assets/replay-frames/` directory.

Replace the fixture preparation step when adapting to real footage. Do not put user
captures in its owned directory. Build into a separate project, preserve imported
media and licensing, and add the real source/claim checks. Read the kit API notes
before reusing the shader, rigs or frame cache in another style.
