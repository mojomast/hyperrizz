# Lessons from the productions

These are project-specific observations, not proof that every later film inherits
the same validation. The film review documents were read when authoring this skill.

## Eye Of Hermes — cartographer's field instrument

**Keep:** A coherent survey-plate identity: Fraunces + IBM Plex Mono, bone/ink paper,
orange drafting marks, a travelling survey head, true coordinates and generous
margins around map evidence. Varied information can belong to one visual world
without adding a different filter to every shot.

**Technical lessons:** The locked 13-scene edit and VO cues stayed fixed. Prompts
completed at least 0.20s before map actions. Fourteen browser frames matched after
shuffled seeks; removing transform-layer promotion fixed text rasterization drift.
DOM text received real contrast checks, unlike the canvas-only films. Some warnings
were intentional clipping/reading heuristics, not reasons to rewrite a locked cut.

**Status lesson:** The delivered artifact was a silent design proof because original
GEV captures and Ash narration were missing. A polished proof must retain that
label; no fabricated footage or substitute narration should silently fill the gap.

## Hermagotchi Television — broadcast as an organizing principle

**Keep:** Channels had genuinely different genres—weather, home video, shopping,
arena, public access and educational film—inside one broadcast identity. A global
effect-intensity control allowed clean/treated comparisons. Source pixel assets,
native-grid placement and catalog rig anchors gave the art credibility.

**Technical lessons:** Frame-source callbacks awaited cached video decode; the
quarter-speed replay had its own source-time map. Shader uniforms/seeded static
were time-derived. Seek tests checked both exact repeated pixels and that time and
the intensity toggle actually changed output. Source checksums, all ten species,
thirty selected cosmetics and four verbatim quotes were asserted.

**Status lesson:** The 92s submission scaffold had synthesized broadcast effects,
but final narration, music choices and authentic capture slots were outstanding.
Illustrated HP/KO, ratings and missing media were labelled. The under-90s submission
guide discrepancy was explicitly recorded. “Rendered” did not mean “all production
inputs complete.”

## poptart — SCORE SHEET

**Keep:** Subject-derived visual logic: ruled score rails, heavy type, the banner's
actual #A3E635, eight-arm asterisk turning 60° per beat, and PCM-derived waveforms.
Feature captures retained native UI, highlights and real invalid-edit/revision states.

**Technical lessons:** The 126 BPM metadata plus attack/harmonic evidence established
the actual excerpt and phase. Twenty-one bars were exactly 40 seconds. Main entered
on running cycle 6, so restarting highlight phase at Main was wrong. Fifty-five
kicks fitted the grid with about 0.316ms standard deviation; cuts were within 7.143ms.
DSF3 captures provided sharp close-ups without enlarging source pixels. The old
25fps MP4 picture remained honest even when cached on a 60fps timeline.

The final master measured −14.06 LUFS / −1.16 dBTP; the preview −14.08 / −1.14.
These are measurements of that final encode, not a universal mastering recipe.
Twenty-nine reverse/reordered seek samples passed. Final colour refinements needed
a new encode, not just refreshed stills. Candidate files preserved live review links
until replacement. Two-core affinity constrained internal encoder threads.

**Caveat:** The native deterministic capture was isolated product evidence, not a
new signed-in Hermes run. Nonzero audio after sample tails was measured; physical
speaker quality was not established.

## Hermes v0.23.0 — The Hearth Release

**Keep:** The release's own hearth metaphor led to warm cream/ember/ink, arches and
a central flame. Copy came from the actual release notes. Webapp off-by-default and
plugin auto-update opt-in language survived. The fictional cost was marked
illustrative; “Nous Research presents” was corrected to avoid implied endorsement.

**Engineering lessons:** A missing timed-audio ID caused a lint error that explicitly
predicted silent export; adding the ID fixed it. Framework checks passed. The
45-second 1080p30 H.264/AAC master was fully decoded and the live link checked.
Repeated tool interruptions showed the need for durable checkpoints and read-before-
retry, rather than empty tool calls or repeated promises.

**Improve next time:** Most feature shots reused left headline/right illustration,
with brief entrances and little story-driven action afterward. A common palette and
nine scenes alone do not establish the requested effect variety. A rewind claim
deserves visible reversal/forking; gateway unity deserves animated convergence.
The generated soundtrack was a simple loop, without documented final loudness or
listening review. Do not claim it was mastered or artistically validated. Use more
varied composition/rhythm, an arranged score, encoded audio measurements and full
playback review before presenting the next film as fully finished.

## General synthesis

Reuse deterministic rendering, provenance, budgets and QC. Do not reuse a prior
film's visual identity wholesale. Treat stills as one review instrument; the user's
actual deliverable is the moving, audible file. Preserve limitations as precisely
as successes, and finish the remaining delivery work after asynchronous jobs end.
