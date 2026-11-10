# Hermes · agent-led film production

Skill ID: **`hyperrizz:production`**. Three tools, one live pane. Read the artistic,
runtime, media and verification references as needed; this integration carries the
full production skill, including the advanced Hermagotchi-derived machinery.

## Default behavior

1. Infer the brief, research the subject and choose a specific visual identity.
2. `hyperrizz_project(op="create", title="…", template="starter")` creates a managed
   project and starts its first build. `broadcast` is available for work that actually
   calls for its aesthetic. Both are engineering starting points: replace their
   sample design. The host's post-tool hook binds creation to the initiating chat.
3. Read/edit files with `hyperrizz_project` or the normal terminal/file tools at the
   returned project path. Import user-provided media into `assets/`; preserve its
   provenance. Keep source, generated builds and exports separate.
4. Start `hyperrizz_produce(op="build", project="…")`. It prepares assets, builds,
   lints, runs the framework check and publishes an immutable preview revision.
   Failed builds leave the last working preview available. Inspect the returned
   job using `op="job"`; a queued/running job is not a completed deliverable. These
   plugin jobs have durable status rather than shell completion notifications.
5. Inspect the live composition and appropriate exact-time stills. The user can
   play, scrub, step frames, audition audio, switch revisions and leave feedback.
6. Read `hyperrizz_review(op="notes")`, make the requested changes, build, verify
   and then resolve each addressed note. The note's revision may be older than the
   current source; reconcile rather than blindly replaying an old edit.
7. For delivery, `hyperrizz_produce(op="render")` runs framework/seek checks, the
   bounded render wrapper and encoded-media verification, including the frame-0
   money-shot check. Read its terminal job result and return the verified path. A user asking for a complete film need not
   click an approval button. A user asking for review-only should get a live preview.

Do not ask the user to install npm dependencies, start servers or render frames
manually when the plugin can do it. Missing system prerequisites are actionable
errors. Keep running toward the requested outcome, repairing failed jobs as needed.

## Tool contracts

| Tool | Operations |
| --- | --- |
| `hyperrizz_project` | `list`, `create`, `status`, `files`, `read`, `write`, `restore`, `reconcile` |
| `hyperrizz_review` | `open`, `notes`, `note`, `resolve`, `editor`, `checkpoint`, `close_editor` |
| `hyperrizz_produce` | `build`, `check`, `render`, `job`, `cancel` |

All return JSON strings. `ok:false` has a recoverable `code`, `error`, and often a
`fix`. `write` requires the SHA returned by `read`; a new file uses `"new"`. Source
text is limited to 512 KB per read/write. `status` includes source freshness, jobs,
notes, revisions, editor state and the latest verified export. Job status includes
a bounded log tail. Do not expose a candidate output as a verified export.

`review open` takes an exact session ID. The normal creation hook supplies session
binding automatically; do not invent an ID or guess one from another conversation.
The user can also choose a project from the pane's selector. Other sessions do not
inherit that selection. The pane preserves its manual view choice while tools run.

## Full editor and source reconciliation

“Full editor” starts the **actual pinned HyperFrames Studio**, in an owned local
browser. The pane forwards click, drag, scroll, keyboard and paste through the
authenticated Hermes backend. There is one screenshot path and no exposed browser
debug port. Audition sound in Review: the Studio image relay does not carry audio.

Studio edits an isolated copy of the reviewed build. “Keep edits & review” flushes
pending requests, closes the editor and checkpoints changes as a new revision.
An idle/disconnected editor expires after two minutes; its working copy survives
and can be reopened. Reopen or checkpoint it before continuing source edits.

If `edited_build` is set, do not rebuild over it:

1. Read the changed `.build/index.html`, CSS or runtime files and compare to the
   source modules. Preserve the Studio revision.
2. Translate the manual changes into the source modules/settings.
3. Call `hyperrizz_project(op="reconcile", revision=<current Studio revision>)`.
   It requires an actual source change, clears the rebuild interlock and preserves
   the editor snapshot. Build and inspect the new result before resolving feedback.
4. If the user wants to revert instead, `restore` creates a new revision from the
   selected old one and backs up all unbuilt source edits first.

Native Studio edits to canvas/shader scenes have the capabilities of HyperFrames
itself: canvas pixels are not independently editable text/vector DOM layers. Use
source modules for those changes. Timeline/duration edits also need consistent
source settings before they can satisfy the final frame-count verifier.

## Storage, networking and recovery

Projects live under profile-scoped `plugin_data_dir("hyperrizz")`, not the installed
checkout. SQLite persists notes, bindings, revisions and jobs across plugin updates.
One background production job or full editor owns the profile's production lease.
On Linux it runs at nice 19 on two cores; the render wrapper keeps its additional
shared render lock and bounded FFmpeg settings. Cancellation stops the owned child
process group and preserves previous preview/export files.

The review player runs natively in an opaque guest frame. Film bytes are loaded
through `ctx.rest`, in 512 KB chunks. No raw host authentication is exposed to guest
code. Local assets only; package budget is 32 MiB raw / 48 MiB assembled. For larger
projects use review proxies or Full editor. No remote asset fetch is silently made.
Runtime project code and build scripts are trusted local code, not an OS sandbox.

First build installs the exact locked npm dependencies and provisions Chromium.
The plugin suppresses HyperFrames telemetry and gives children a minimal environment
with a private runtime home. It reads no model credentials. The user runs their
usual Hermes agent/model; the plugin does not create another hidden agent runtime.
