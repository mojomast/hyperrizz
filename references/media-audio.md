# Media truth, sharpness, timing and sound

## Provenance first

Keep an asset manifest: local path, original URL/commit, checksum, dimensions/FPS,
licensing/attribution, capture environment and any transformations. Preserve font
licenses verbatim. Read the actual product license; do not assume every repository
is MIT. Separate supplied media, recaptured app evidence and editorial illustration.

Release-note research should retain important conditions: features that are off by
default, opt-in updates, platform support, or migration requirements. A conceptual
window is not a screenshot; a fictional price must not look like a quoted price.
Keep “independent release film” distinct from official producer attribution.

When media is missing, continue research, layout and labelled proof work. Never
silently substitute unrelated footage, synthesized narration or fictional behavior
for specifically required evidence. Report the missing asset and its exact slot.
Missing inputs do not justify modifying a live user's setup to obtain a shot.

## Screen evidence

- Use the real app where a feature demonstration is promised.
- Record whether it is a signed-in host, isolated SDK fixture, standalone app,
  or native UI driven by a controlled clock. These establish different things.
- Retain original pixels/theme and important context, attribution and status.
- Crop content-dense areas: code, chat, library, revisions, output; avoid empty panes.
- Capture at device scale 2 or 3 when a close-up needs more real pixels. Merely
  resizing an old screenshot cannot restore detail.
- Compare destination crop dimensions with the source crop **in physical pixels**.
  UI close-up scale relative to a full-window fit is not the same as pixel upscaling.
- For dense UI, 1.6–2.5× relative close-ups held at least 1.5s worked in SCORE SHEET;
  adapt to actual text length, aspect and brief. A fast climax can be an intentional
  exception after the feature has already been made legible.

Pixel art has a different rule: nearest-neighbor **integer** enlargement is often
correct. Snap sprites/cosmetics to their native grid; use source rig anchors,
per-frame offsets and documented z-order. Do not blur/interpolate sprite frames.

Invalid-edit evidence requires more than a screenshot of “Playing.” Check the
actual rejected edit, preserved last-good source and output after previous sample
tails. A nonzero graph measurement is not physical-speaker or perceptual-quality
verification. Save/revision labels must come from real writes with current revision
preconditions; use disposable capture state when possible.

## Cached video frames

When frame-accurate canvas compositing is needed, decode local video once into a
project-owned frame sequence at the composition FPS. Preserve resolution. Example:

```sh
nice -n 19 ffmpeg -hide_banner -nostdin -threads 2 -filter_threads 2 \
  -i inputs/source.mp4 -ss SOURCE_OFFSET -t DURATION \
  -vf fps=60 -an -q:v 2 -threads 2 .cache/source-frames/%05d.jpg
```

Replace placeholders deliberately. Choose PNG/lossless or sufficiently high JPEG
quality for UI detail; inspect actual results. `fps=60` duplicates/drops original
frames; it does not turn 25fps motion into authentic 60fps capture. Do not imply it
does. File numbering starts at 1; keep manifest indexing consistent. Clamp the final
frame, assert all planned frames exist and use a bounded decode cache.

Document speed changes with an explicit mapping. A quarter-speed replay maps
`source = sourceStart + localTime * 0.25`; captions/audio need deliberate treatment.
Keep original footage/audio mapped to the same source offset when showing sync.

## Musical time

For tempo `B` in 4/4:

```text
beatSeconds = 60 / B
barSeconds = 240 / B
cutFrame = round(absoluteBeat * 60 / B * fps)
time = frame / fps
sourceTime = excerptStart + time * playbackRate
```

Compute every absolute boundary independently; subtract adjacent frame boundaries
for scene lengths. Do not round each bar and accumulate the error. At 126 BPM,
21 bars equal exactly 40 seconds; scene cuts still require frame quantization.
Check internal titles, crop changes, accents and montage cuts, not just scene starts.

Tempo alone does not establish a downbeat. Prefer supplied metadata, then verify
against source attacks and phrase/harmonic evidence. Fit multiple kicks rather
than one transient. Keep sparse intros and full arrangements in a coherent excerpt.

SCORE SHEET's Main section entered on the already-running cycle 6 (C), not a newly
reset A-minor phrase. Replayed native highlights had to use film time × BPM/240.
Do not generalize that formula without checking the source offset and actual
pattern reset semantics. Clock control can make a native capture deterministic;
it does not turn it into live host evidence.

If a motif rotates 60° per beat, implement that independently of its arm count.
Eight-arm geometry can still turn by 60°. Specify phase, entrance and final rest.

## Audio arrangement and mastering

Choose the soundtrack according to the brief: supplied recording, licensed asset,
original composition, VO-led mix or explicitly silent proof. Record which it is.
A simple generated loop is not automatically a finished score. Give an original
score sections, harmonic/rhythmic development, edit-aligned accents and an ending.
Avoid unrelated kick timing under cuts claimed to be beat-locked.

For fixed VO, preserve the original cue timing and pronunciation. Land text near
meaningful phrase boundaries. Complete prompts before demonstrated actions when
the locked edit expects that causal order. Do not time-stretch narration merely
to accommodate decorative animation.

Set an audio target suitable to the delivery. Earlier music-led work targeted
about −14 LUFS integrated / ≤−1 dBTP; VO-led work may use a different brief. Apply
short click-preventing entrance fades and an intentional exit fade **inside** the
picture duration. Preserve arrangement dynamics. Measure, apply gain/limiting or
a suitable two-pass loudness process, then measure again. Compensate limiter/filter
latency. Oversampling and headroom help control true peaks; the exact limiter from
a previous track is not a universal preset.

```sh
nice -n 19 ffmpeg -hide_banner -nostdin -threads 2 -filter_threads 2 \
  -i out/master.mp4 -map 0:a:0 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json \
  -threads 2 -f null -
```

Read **`input_i` and `input_tp`** to measure the encoded input, not the normalized
output fields. AAC encoding may raise peaks: SCORE SHEET's PCM was −1.72 dBTP while
its encoded master measured −1.16 dBTP. Check both master and separately encoded
preview. A lossless master passing a ceiling does not guarantee either AAC passes.

For waveforms/steps, derive peak/RMS windows from real PCM with known offsets and
sample rate. Seeded random bars may be decoration, but cannot be described as
audio-derived. Keep analysis data small; do not decode audio per rendered frame.
