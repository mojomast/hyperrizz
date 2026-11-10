# Changelog

## 2.1.0

Every delivered film opens on a money shot. Frame 0 is a finished hero at full
brightness, with the title or hook already readable, so the MP4 works as a
thumbnail on X, Discord, GitHub and social feeds.

- The starter and the broadcast lab hold the chosen scene's settled frame from
  the first output frame. An explicit `hero: true` outranks every other shot.
  Otherwise the strongest scene wins by role and weight. A later hero is a short
  picture-only cold open.
- Audio stays on the composition clock. Scene durations do not change and no
  frames are inserted.
- Turn it off with `moneyShot: false` or `HYPERRIZZ_MONEY_SHOT=0` (`false`,
  `off`, or `no`). `moneyShot: true` forces it on. Omitting the option leaves
  the default on.
- `verify-media.py` extracts frame 0 and rejects a near-black or blank opening
  that does not show a hero or title. `--money-shot off` skips that check when
  the film opts out.

## 2.0.1

Hackathon catalog readiness for the Hermes plugin.

## 2.0.0

Agent-led Hermes film studio: live review pane, frame notes, and on-demand Studio.
