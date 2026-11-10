# Art direction and editorial motion

## Find a system, not a collection of decorations

Start from the subject. “Score sheet” came from live-coded music, an atlas survey
plate from a mapping tool, broadcast channels from virtual pets, and an arch/fire
from the Hearth release. The metaphor should govern typography, geometry, cuts,
information hierarchy and sound. It should survive a single still.

Specify five decisions before coding:

1. **Material/world:** paper instrument, tiled kiln, signal relay, theatre, etc.
2. **Type roles:** display, supporting prose, technical annotation; local fonts.
3. **Palette roles:** background, foreground, active accent, secondary, error.
4. **Motif behavior:** what it does and how it carries the narrative across cuts.
5. **Motion grammar:** 3–5 verbs plus easing, settle and hold rules.

Sample exact brand colours/geometry from legitimate assets when matching a brand.
Do not confuse a suggested accent with the supplied banner's actual colour. Keep
font licenses intact. Do not declare Inter + mono to be every project's identity.

## A practical shot table

For each shot, record start/end frame, main claim, evidence source, composition,
entry action, main event, readable hold, transition, audio cue and review time.
Start with the intended emotional/readability arc rather than equal-duration cards.
Feature copy should be understandable before a cut; dense product details need
more time than an emotional title. A title entering for 0.6s then freezing for 4.4s
may be appropriate once, but repeated nine times does not fulfill “varied effects.”

Useful composition changes:

- Full-bleed typographic opening → content rail → macro detail → diagram.
- A connected topology becomes a room arrangement or window grid.
- A dense catalog expands into a field, then isolates one item.
- A timeline genuinely rewinds, forks and resolves into a new branch.
- A matching silhouette crosses a cut; a hero motif returns in a changed state.

For a short multi-scene promo requesting variety, a useful planning target is
at least three distinct composition types and three meaningful motion families.
This is a design aid, not a reason to cram effects into a quiet film.

## The money shot is frame 0

Design the thumbnail before the entrance. Frame 0 has to work as a still: hero
motif fully revealed, title or hook readable, at full brightness. Pick that
moment with `"hero": true` or let role and weight choose it, then set `settleFrame`
to the local frame where the entrance has finished. The picture holds there from
the start of the export. Playback then continues on the real clock.

A fade up from black, an empty first frame, or a title that is still drawing is
not an opening. Audio entrance fades stay inside the picture; they do not move
the soundtrack later to make room for the hold. Sign-offs and textless plates are
weak thumbnails. The hook scene is the one that should win.

## Match effect to meaning

| Story beat | Useful effect | Failure mode |
| --- | --- | --- |
| Reveal a workspace | Architectural aperture / unfolding plane | Generic card scaling |
| One shared session | Paths converge; one queue becomes legible | Random pulsing nodes |
| Rewind/fork | Visible temporal reversal and branching | Just writing “REWIND” |
| Active music tokens | Native highlights, beat-locked crops | Invented highlights / wrong phase |
| Growing catalog | Tiled expansion then focused selection | Unreadable scrolling names |
| Cost/approval | Price and running total resolve before decision | Invented unlabelled pricing |
| Broadcast narrative | Tuned cuts, graphic genres, calibrated CRT | Same noise over every scene |
| Map evidence | Survey sweep in the margins | Covering attribution or terrain |

Give every treatment an intensity budget. Texture should remain below legibility;
the 1.8% static grain in earlier paper films was a specific choice, not a universal
limit. Glow and shaders are tools, not automatic quality. Design the clean frame
first, then compare effect on/off at delivery size. Prefer source-time procedural
motion over recursive framebuffer trails when deterministic export matters.

## Text, accents and safe areas

- Put one main statement on a card. Preserve useful opt-in/version qualifiers.
- Use large feature text, concise supporting copy and generous margins.
- Verify the longest actual copy in the real bundled font.
- If the brief says one emphasized word, colour one word, not the whole phrase.
- Use baseline/grid consistency without repeating the same composition forever.
- Avoid animation that moves important numbers or changes true values for flair.
- On small previews, annotation can become texture; essential facts cannot.
- Keep branded UI's own theme; don't recolour its tokens to satisfy the film palette.

## Review the moving film

A contact sheet establishes hierarchy and shot variety; it cannot prove pacing,
transition quality, synchronization or musical interest. Inspect starts, settled
states, cut ±1 frame and short transition windows. Then watch the encoded film.
Evaluate “did the shot communicate?” rather than “did it animate?”

When borrowing implementation from an earlier production, explicitly replace its
branding, content, typography and effect grammar. Keep the engineering; redesign
the film.
