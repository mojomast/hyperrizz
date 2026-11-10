# QA, delivery and interrupted-work recovery

## Evidence ladder

Keep these distinct in the review report:

1. **Build:** source bundles and assets exist.
2. **Framework:** lint/check ran and their errors/warnings were examined.
3. **Determinism:** renderer matches at repeated/reordered times; animation changes.
4. **Visual stills:** specific frames were actually inspected at useful sizes.
5. **Encoded media:** actual MP4 probe, decode, dimensions, FPS, frames, duration,
   audio presence/loudness and size measured.
6. **Realtime viewing/listening:** encoded film watched/auditioned where supported.
7. **Product behavior:** only what was really exercised in the recorded environment.

Passing a lower level is not evidence of a higher one. In particular, a nonempty
audio stream does not establish audible quality; a framework check does not validate
canvas typography; a release note does not prove behavior in the local installation.

## Pre-render checks

- Source/copy/settings and referenced media match the intended revision.
- No unfinished copy except intentional, visibly marked proof slots.
- Real claims, prices and asset coverage match their manifest/source.
- Timeline starts at zero, has finite contiguous coverage, and ends intentionally.
- Video source-frame coverage and declared offsets/rates are coherent.
- Stable media IDs, local fonts loaded and no runtime errors.
- Exact-time stills cover every scene, longest text and dense/effect-heavy moments.
- Cut −1 / 0 / +1 frames and short windows show intended transitions.
- Random/reverse seeking matches and a known motion interval differs.

Use a contact sheet to judge visual variety, then open dense frames full size.
Check caption/UI separation, longest labels, genuine pixel sharpness, accent rules,
credits, crop bounds and final hold. A logo plus a slogan is not a usable CTA if the
viewer cannot find the project; include the required repository/site/maker details.

## Encoded checks

Use the starter's `scripts/verify-media.py --help`. It supports expected dimensions,
FPS, duration, audio policy, byte budget and optional LUFS/true-peak assertions.
It counts decoded video frames, runs a full decode and records the file checksum.
It does not judge taste, provenance, dynamics, pronunciation or perceived quality.

By default it also extracts frame 0, scales it to 160 pixels wide, and measures
luma. Mean luma at or below 16 fails as near-black. Luma standard deviation below
8 fails as a blank frame with no readable hero or title. `--min-luma` and
`--min-luma-stdev` override those floors. `--money-shot off` skips the check when
the film sets `moneyShot: false` or `HYPERRIZZ_MONEY_SHOT=0|false|off|no`. A
passing measurement shows the opening is not black or empty. It does not replace
looking at the still to confirm the right hero and a readable hook. The starter's
`verify()` passes `--money-shot off` only when that switch is off, so a normal
`npm run render` / `npm run verify` enforces the thumbnail.

Frame duration is quantized: `round(seconds * fps) / fps`. The EOH 112.318s edit
yielded 3,370 frames / 112.333333s at 30fps. AAC packet padding can make the container
slightly longer than video (92.010s container vs 92.000s video in Hermagotchi). Verify
the intended picture frames and sane A/V duration, not a brittle exact container
string. Investigate substantial drift, missing last frames or tail truncation.

Extract review frames from the final encoded MP4, not only the composition. Lossy
MP4 pixels will not equal PNG snapshots byte-for-byte; compare content, timing and
quality. Watch the film to catch a whole scene frozen despite valid snapshots.

## Preview size

Use H.264 / yuv420p / AAC / faststart for ordinary MP4 review. CRF alone is not a
size guarantee. Estimate the available bitrate, reserving audio and overhead:

```text
video_bits_per_second ≈ byte_budget * 8 / seconds - audio_bits_per_second - overhead
```

Use capped rates or two-pass average bitrate when the cap is strict, then assert
the actual size. Distinguish **video-only budget** from **combined preview+stills**
budget. Do not carry a previous job's 25MB/40MB constraint into a new brief blindly.
Texture and temporal noise can dramatically increase bitrate requirements.

Render a candidate master and preview. Verify both before publishing. Rename each
candidate on the same filesystem so links do not expose a half-written MP4. Two
renames are individually atomic, not a transaction; for strict paired publication,
publish a versioned directory and switch its pointer. Keep old review files until
the new candidate passes. A source/copy tweak invalidates the rendered artifact.

## Resuming after interruption

Read `STATUS.md`, current source files, output timestamps/fingerprints and job
records. Identify whether the last tool actually wrote its files: a transport error
or empty call is not successful work. Read before reapplying a patch. Continue the
earliest incomplete phase rather than starting over or weakening the deliverable.

Record background command ID, log path and expected completion action. Do not
start a replacement while the original may still be running. Respect the harness's
completion notifications; no repeated polling/sleep loops. Keep commentary to real
discoveries, tradeoffs and blockers; do not stream internal thoughts or empty tool
calls. When a render finishes, continue verification and delivery automatically.

## Sharing

Serve only final outputs or a small share directory. On a requested Tailscale
review, discover `tailscale ip -4`, inspect the chosen listener port, bind to that
exact interface and record the server job. Do not hardcode an old private address.
Use loopback for local-only preview. Test each shared link's HTTP status, type and
size. Link text should describe the actual current output, including draft/proof
status. Avoid private IPs or host paths in committed public documentation.

If a source PR is requested: stage only the scoped project, run an available secret
scanner, check whitespace/scope, preserve upstream licenses, push the requested
branch and open the PR against the actual base. Do not assume `main` exists. Leave
review-only PRs unmerged. A user asking for a video alone does not request a public
upload, new repository, commit or PR.

## Completion message

Lead with the playable MP4. Include preview/contact sheet, measured specs, source
location and material unfinished inputs or review gaps. Do not call a silent proof
a final audiovisual film. State what was checked in one compact paragraph; put
detailed evidence in `REVIEW.md` / `TEST_REPORT.md`.
