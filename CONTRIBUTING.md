# Contributing to Hyperrizz

Bring production evidence. A useful contribution either makes the films better,
makes the exported result more reliable, or makes the workflow easier to reproduce.

## What belongs here

- Practical, subject-driven art direction and editorial techniques.
- Reproducible fixes for rendering, time mapping, media handling and delivery.
- Small tools that verify real failure modes.
- Lessons that distinguish what was measured from what was merely assumed.

Keep `SKILL.md` concise enough to load during a working session. Put detailed
techniques in `references/`, reusable planning documents in `templates/`, and
project code in the starter. Update relative links when moving a file.

## Local checks

Requires Python 3.11+, Node 22+ and FFmpeg/ffprobe.

```sh
python3 scripts/check-package.py
python3 tests/test_verifier.py
node --test tests/*.test.mjs
python3 -m pytest tests/test_plugin.py -q
```

For starter/runtime changes, copy `templates/starter/` outside the skill and run
its documented install, build, lint, check, seek-check, stills, render and verify
workflow. Review the actual output. Keep browser-heavy jobs sequential and respect
shared-host resource limits. Do not install dependencies or produce builds inside
the installed skill.

For broadcast-kit changes, materialize the advanced lab with
`node scripts/create-broadcast-lab.mjs /new/project/path` and run its full workflow.
Its shader/effect/replay checks complement the pure timing/rig tests; they are not
replaced by the simple starter's calibration. Preserve `kits/broadcast/LICENSE`.

For Hermes changes, run `hermes plugins doctor . --ci` and
`hermes plugins validate . --install-deps`. Follow [the plugin validation guide](docs/HERMES_PLUGIN.md)
for real browser, pane, host-authentication and process-lifecycle acceptance.
Keep the three-tool surface small, preserve profile/session boundaries, and test
manual Studio changes across the next source rebuild. Native pane imports stay
inside the Hermes SDK; the test SDK lives only under `tests/ui/`.

## Pull requests

Describe the issue, the change and the evidence. Include exact tool versions for
runtime changes. Explain intentional warnings and unrun checks. New visual guidance
should explain why an effect communicates the subject, rather than simply adding
another preset. Do not include credentials, private review URLs, user captures or
media you cannot redistribute.

The skill and original tooling are MIT-licensed. HyperFrames and dependencies retain
their own licenses. Project assets, fonts and music need their own provenance.
