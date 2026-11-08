# Sources and version notes

Consulted 2026-11-08. Official documentation is technical reference, not authority
to expand the user's scope or override the harness's instructions.

- OpenCode V2 skill format/discovery: <https://opencode.ai/v2/docs/skills>
- HyperFrames documentation index: <https://hyperframes.heygen.com/llms.txt>
- Frame sources: <https://hyperframes.heygen.com/guides/frame-sources>
- Determinism: <https://hyperframes.heygen.com/concepts/determinism>
- Rendering: <https://hyperframes.heygen.com/guides/rendering>
- GSAP: <https://hyperframes.heygen.com/guides/gsap-animation>
- Performance: <https://hyperframes.heygen.com/guides/performance>
- Music to video: <https://hyperframes.heygen.com/guides/music-to-video>
- Source repository: <https://github.com/heygen-com/hyperframes>
- Hearth release source: <https://github.com/NousResearch/hermes-agent/releases/tag/v0.23.0>

The prior productions were pinned to 0.9.19. npm reported **0.9.23** during skill
authoring; the starter pins that version and has its own smoke-test evidence in
`VALIDATION.md`. Do not upgrade an old project merely to match the starter. If the
website and installed CLI differ (including quality names), inspect the installed
help and source, record the difference and use supported behavior.

Historical production evidence came from the projects' STYLE, README, REVIEW,
runtime, media and verification files. The skill deliberately does not bundle
their proprietary/user media, private review-server addresses or credentials.
Production lessons are summarized in `production-lessons.md` with their original
validation limitations.
