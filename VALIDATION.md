# Hyperrizz validation — 2026-11-08

## Money shot · v2.1.0

Frame 0 of a default export is the settled hero. Selection, the picture hold,
the cold open and the audio-clock invariant are covered by `tests/money-shot.test.mjs`.
`tests/test_verifier.py` is **8/8**: it rejects a near-black frame 0 and a flat
frame, and it accepts a cream-on-ink title card. `--money-shot off` accepts an
intentional black opening.

Measured from a copy of the starter, HyperFrames **0.9.23**, 2026-11-10:

- Seek check: **10 reverse + 10 shuffled** exact matches. Frame 0 matches the
  settle frame. Motion after the hold changes pixels.
- Silent master: **640×360 / 30fps / 60 frames / 2.000s**. Frame 0 mean luma
  **28.9**, luma stdev **33.5** (limits 16 and 8). Encoded frames 0, 5 and 18
  match; frame 23 has moved. The hook “Seek any frame.” is on screen and the
  amber square is at the settled position.
- The same edit with a tone that starts at sample 0: video and audio
  `start_time` **0.000**, both durations **2.000s**, still 60 frames. RMS in the
  first 50ms matches RMS at 600ms, so the hold did not delay the soundtrack.
- Broadcast lab effect check: **21 reverse + 21 shuffled** matches. Frame 0 is
  `scene-signal` at local frame **108**, with the finished ident line present.
  `shiftsAudio` is false and `insertedFrames` is 0. The 16s lab was not
  re-encoded for this note; the picture decision was checked in the same renderer
  the export uses.

## Hermes plugin · v2.0.1

The plugin report is [docs/HERMES_PLUGIN.md](docs/HERMES_PLUGIN.md), with
[machine-readable evidence](docs/examples/hermes-plugin-evidence.json). It covers
real Hermes doctor/validate and isolated-host authentication/transport checks,
17 Python behavior contracts, the native player and pane browser harness,
actual full-Studio edit/save/checkpoint, process cancellation and failed-build
recovery, plus a verified 16-second integration export. Native Desktop and a
provider-backed model conversation are distinguished from the SDK test harness.

## Advanced broadcast expansion · v1.1.0

The optional Hermagotchi-derived kit and 16-second broadcast lab were built,
checked and rendered. **21 reverse + 21 shuffled shader samples** matched; clean
bypass, effect controls, quarter-speed replay, cache bounds and cancellation checks
passed. Both encoded files fully decoded. Five timing/rig tests and three safe
materialization tests passed. The six software-WebGL readback warnings and remaining
review limitations are documented in [the advanced report](docs/BROADCAST_LAB.md).
Its preview, contact sheet and verification JSON are committed with the example.

## Repository packaging

- Renamed the public skill to **Hyperrizz**, with `hyperrizz` as its installation ID.
- Added a custom SVG README header, installation/usage documentation, MIT license,
  contribution guide and package/verifier CI workflow.
- `python3 scripts/check-package.py`: passed local links, JSON/Python/JavaScript
  syntax, SVG structure, skill metadata and exact starter dependency pins.
- `python3 tests/test_verifier.py`: **7/7 passed** from the repository copy.
- The starter implementation and dependency pins retain the tested baseline below.
- The CI workflow covers package integrity and verifier tests; it does not claim
  to run the full browser/render smoke test on each push.

## Installed skill

- OpenCode V2 discovered and successfully loaded the `hyperframes` ID from the
  active XDG global skill directory.
- All relative Markdown links resolved, JSON files parsed, and Python/JavaScript
  syntax checks passed across the 31-file package. No build/dependency artifacts
  were installed inside the skill. Gitleaks directory scan found no leaks.
- The prior product repository remained clean; production assets were not copied
  into the skill. Only the new skill and isolated scratch fixtures were authored.

## Starter integration smoke test

Tested from a copy outside the installed skill, with Node 22.19.0, HyperFrames
**0.9.23**, esbuild 0.25.12, puppeteer-core 25.16.0, local Chromium and FFmpeg.

- `npm ci --ignore-scripts`: passed using the bundled dependency lockfile.
- `npm run build`: passed; two scenes, **60 frames / 2.000s**.
- A repeated build produced an identical build fingerprint.
- `npm run lint`: **0 errors, 0 warnings** after fixing numeric-leading DOM IDs.
- `npm run check`: passed, **0 errors/warnings**; expected `audio_none` information
  for the explicitly silent fixture. Canvas text had **0/0** DOM contrast checks.
- `npm run seek-check`: **8 exact-pixel reverse matches + 8 shuffled matches**,
  including the cut and adjacent frames; known motion changed pixels; no page errors.
- `npm run stills`: passed; both scene frames visually inspected in the contact sheet.
- `npm run render`: passed under the wrapper's two-worker/two-core Linux limits.
  Candidate master and preview passed full decode/metadata/size checks before rename.
- Master: H.264, **640×360 / 30fps / 60 frames / 2.000s**, **20,554 bytes**, no audio.
- The preview measured **320×180 / 30fps / 60 frames / 2.000s**, **8,679 bytes**,
  passing its 1,000,000-byte budget. `npm run verify` rechecked both published files
  and the matching build fingerprint successfully.
- Occupied project and shared-host locks both rejected rendering, preserved foreign
  lock contents and preserved the existing master. The wrapper released only its
  own lock when acquisition of the shared lock failed.

## Media-verifier regression tests

`python3 tests/test_verifier.py`: **7/7 passed**, using small real H.264/AAC fixtures.

1. Valid audio file, decoded frames, checksum, measured loudness and matching targets.
2. Missing required audio rejected.
3. Unexpected audio rejected; explicit silent output accepted.
4. Incorrect dimensions, FPS, duration and file-size budget rejected.
5. Out-of-range loudness/true peak and missing measurable audio rejected.
6. Truncated/corrupt media rejected.
7. A report path cannot overwrite the media being verified.

## Scope

These tests verify the bundled engineering tools, not the artistic quality of an
unwritten future film. The calibration uses system sans-serif, no product footage,
no shaders and no music. Its regression audio is a generated sine fixture, not a
listening/mastering endorsement. The starter's test hook emulates host visibility;
the separate framework check and actual encode cover integration. Non-Linux limits,
cross-machine pixel identity, optional asset pipelines and live product behavior
were not tested here.

The installed dependency audit reported two transitive development-tool advisories
(one moderate, one high); this work did not apply unrelated forced dependency
upgrades or claim a vulnerability-free toolchain.
