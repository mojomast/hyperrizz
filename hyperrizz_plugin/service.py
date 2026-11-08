"""The same production operations power agent tools and authenticated pane routes."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

from .process import child_env, limited
from .store import Store, Problem, atomic, confined, digest, fingerprint, source_files, uid

PACKAGE = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".js", ".mjs", ".json", ".html", ".css", ".md", ".py", ".svg", ".txt"}


def bind_tool_result(tool_name=None, args=None, result=None, session_id=None, **kwargs):
    """Observe only our own successful calls, using the host-supplied session ID."""
    if tool_name not in {"hyperrizz_project", "hyperrizz_review", "hyperrizz_produce"} or not session_id:
        return
    try:
        value = json.loads(result) if isinstance(result, str) else result
        if not isinstance(value, dict) or not value.get("ok"):
            return
        id = value.get("project") or (args or {}).get("project")
        if not id:
            return
        store = Store()
        store.project(id)
        with store.db() as db:
            # Creation belongs to the initiating chat. Other calls never steal a
            # pane the user explicitly selected for this conversation.
            sql = "INSERT OR REPLACE" if tool_name == "hyperrizz_project" and (args or {}).get("op") == "create" else "INSERT OR IGNORE"
            db.execute(f"{sql} INTO bindings VALUES(?,?)", (session_id, id))
    except (ValueError, TypeError, Problem):
        return


def copy_source(src, dst):
    for file in source_files(src):
        target = dst / file.relative_to(src)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)


def make_project(store, title, template):
    if not isinstance(title, str) or not 1 <= len(title.strip()) <= 140:
        raise Problem("invalid_title", "Give the project a title of 1–140 characters.")
    if template not in {"starter", "broadcast"}:
        raise Problem("invalid_template", "Choose starter or broadcast.")
    id = uid("p")
    target = store.root / "projects" / id
    shutil.copytree(PACKAGE / "templates/starter", target)
    if template == "broadcast":
        shutil.rmtree(target / "scenes")
        shutil.copytree(PACKAGE / "templates/broadcast-lab", target, dirs_exist_ok=True)
        shutil.copytree(PACKAGE / "kits/broadcast", target / "broadcast")
        pkg = json.loads((target / "package.json").read_text())
        pkg["scripts"].update(build="node scripts/prepare.mjs && node scripts/build.mjs",
                              **{"seek-check": "node scripts/effect-check.mjs"})
        atomic(target / "package.json", json.dumps(pkg, indent=2))
    with store.db() as db:
        db.execute("INSERT INTO projects(id,title,created) VALUES(?,?,?)", (id, title.strip(), time.time()))
    return id


def editor_alive(store, id):
    from .studio import Studio
    return Studio(store, id).status().get("running", False)


def editable(store, id):
    store.idle(id)
    from .studio import Studio
    state = Studio(store, id).status()
    if state.get("running"):
        raise Problem("editor_open", "The user is editing in Studio.", "Checkpoint and close Studio before changing source.")
    if state.get("recoverable"):
        raise Problem("editor_recovery", "Studio has a recoverable working copy.", "Reopen Studio or call close_editor to preserve its changes before editing source.")


def snapshot(store, id, kind="build"):
    root = store.path(id)
    sha = fingerprint(root)
    with store.transaction() as db:
        revision = db.execute("SELECT revision FROM projects WHERE id=?", (id,)).fetchone()[0] + 1
        dest = store.root / "revisions" / id / str(revision)
        # All preview reads refer to published revisions, never a half-written build.
        try:
            copy_source(root, dest / "source")
            shutil.copytree(root / ".build", dest / "build", ignore=shutil.ignore_patterns(".hyperframes", ".cache"))
            db.execute("INSERT INTO revisions VALUES(?,?,?,?,?)", (id, revision, time.time(), sha, kind))
            db.execute("UPDATE projects SET revision=?,source_sha=?,edited_build=? WHERE id=?",
                       (revision, sha, int(kind == "studio"), id))
        except BaseException:
            shutil.rmtree(dest, ignore_errors=True)
            raise
    return revision


def status(store, id):
    p = store.project(id)
    root = store.path(id)
    with store.db() as db:
        p["notes"] = [dict(r) for r in db.execute("SELECT * FROM notes WHERE project=? ORDER BY created", (id,))]
        p["revisions"] = [dict(r) for r in db.execute("SELECT * FROM revisions WHERE project=? ORDER BY number DESC", (id,))]
        p["jobs"] = [dict(r) for r in db.execute("SELECT * FROM jobs WHERE project=? ORDER BY created DESC LIMIT 8", (id,))]
    p.update(path=str(root), dirty=fingerprint(root) != p["source_sha"], active_job=store.active(id))
    settings_path = store.revision_path(id) / "source/settings.json" if p["revision"] else root / "settings.json"
    p["settings"] = json.loads(settings_path.read_text())
    from .studio import Studio
    p["editor"] = Studio(store, id).status()
    export = store.root / "exports" / id / "export.json"
    if export.is_file():
        p["export"] = json.loads(export.read_text())
        p["export"]["current"] = p["export"]["revision"] == p["revision"] and not p["dirty"]
    return p


def start_job(store, id, op):
    store.project(id)
    editable(store, id)
    if op not in {"build", "check", "render"}:
        raise Problem("invalid_operation", "Unknown production job.")
    if op == "build" and store.project(id)["edited_build"]:
        raise Problem("studio_changes", "This revision contains Studio edits to the built composition.",
                      "Read its build files and reconcile them into source, or restore a source revision before rebuilding.")
    if op != "build" and fingerprint(store.path(id)) != store.project(id)["source_sha"]:
        raise Problem("stale_build", "Source differs from the reviewed build.", "Build and review the current source first.")
    if op != "build" and fingerprint(store.path(id) / ".build") != fingerprint(store.revision_path(id) / "build"):
        raise Problem("stale_build", "The working build differs from the reviewed revision.", "Rebuild source or recover the Studio checkpoint before rendering.")
    idjob = uid("j")
    log = store.root / "jobs" / (idjob + ".log")
    log.parent.mkdir(exist_ok=True)
    with store.transaction() as db:
        if db.execute("SELECT 1 FROM jobs WHERE project=? AND status IN ('queued','running')", (id,)).fetchone():
            raise Problem("busy", "A job already owns this project.")
        db.execute("INSERT INTO jobs(id,project,op,status,stage,created) VALUES(?,?,?,'queued','starting',?)",
                   (idjob, id, op, time.time()))
    try:
        with log.open("ab") as output:
            proc = subprocess.Popen(limited([sys.executable, str(PACKAGE / "hyperrizz_plugin/worker.py"),
                                             str(store.root), idjob]), env=child_env(store.root),
                                    stdout=output, stderr=output, start_new_session=True)
        with store.db() as db:
            db.execute("UPDATE jobs SET pid=? WHERE id=?", (proc.pid, idjob))
    except Exception:
        with store.db() as db:
            db.execute("UPDATE jobs SET status='failed',stage='launch failed' WHERE id=?", (idjob,))
        raise
    return {"job": idjob, "project": id, "status": "queued", "log": str(log)}


def job_status(store, id):
    with store.db() as db:
        row = db.execute("SELECT * FROM jobs WHERE id=?", (id,)).fetchone()
    if row is None:
        raise Problem("not_found", "Job not found.")
    store.active(row["project"])
    with store.db() as db:
        result = dict(db.execute("SELECT * FROM jobs WHERE id=?", (id,)).fetchone())
    log = store.root / "jobs" / (id + ".log")
    if log.is_file():
        with log.open("rb") as f:
            f.seek(max(0, log.stat().st_size - 6000))
            result["log_tail"] = f.read().decode("utf8", errors="replace")
    result["result"] = json.loads(result["result"])
    return result


def add_note(store, id, frame, text, revision=None):
    p = store.project(id)
    rev = p["revision"] if revision is None else revision
    snapshot_path = store.revision_path(id, rev)
    settings = json.loads((snapshot_path / "source/settings.json").read_text())
    frames = sum(s["frames"] for s in settings["scenes"])
    if type(frame) is not int or not 0 <= frame < frames:
        raise Problem("invalid_frame", f"Frame must be between 0 and {frames - 1}.")
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 4000:
        raise Problem("invalid_note", "Write a note of 1–4000 characters.")
    note = uid("n")
    with store.db() as db:
        db.execute("INSERT INTO notes(id,project,revision,frame,text,created) VALUES(?,?,?,?,?,?)",
                   (note, id, rev, frame, text.strip(), time.time()))
    return {"note_id": note, "revision": rev, "frame": frame}


def dispatch(name, args, store=None):
    try:
        store = store or Store()
        edits = {"hyperrizz_project": {"write", "restore", "reconcile"},
                 "hyperrizz_review": {"editor", "checkpoint", "close_editor"},
                 "hyperrizz_produce": {"build", "check", "render"}}
        if args.get("op") in edits.get(name, set()):
            with store.edit_lock(args.get("project")):
                result = operate(store, name, args)
        else:
            result = operate(store, name, args)
        return {"ok": True, **result}
    except Problem as e:
        return {"ok": False, "code": e.code, "error": str(e), "fix": e.fix}
    except (ValueError, TypeError, KeyError) as e:
        return {"ok": False, "code": "invalid_request", "error": str(e)}
    except Exception as e:
        return {"ok": False, "code": "operation_failed", "error": f"{type(e).__name__}: {e}",
                "fix": "Inspect project status and the last job log; the previous preview remains available."}


def operate(store, name, a):
    op, id = a.get("op"), a.get("project")
    if name == "hyperrizz_project":
        if op == "list":
            with store.db() as db:
                return {"projects": [dict(r) for r in db.execute("SELECT * FROM projects ORDER BY created DESC")]}
        if op == "create":
            id = make_project(store, a.get("title", "Untitled film"), a.get("template", "starter"))
            return {"project": id, "path": str(store.path(id)), **start_job(store, id, "build")}
        root = store.path(id)
        if op == "status":
            return status(store, id)
        if op == "files":
            return {"files": [p.relative_to(root).as_posix() for p in source_files(root)]}
        if op == "reconcile":
            editable(store, id)
            p = store.project(id)
            if a.get("revision") != p["revision"] or not p["edited_build"]:
                raise Problem("revision_conflict", "Reconcile the current Studio revision explicitly.")
            if fingerprint(root) == p["source_sha"]:
                raise Problem("source_unchanged", "No source changes were made to reconcile the Studio edit.")
            with store.db() as db:
                db.execute("UPDATE projects SET edited_build=0 WHERE id=?", (id,))
            return {"project": id, "needs_build": True, "preserved_studio_revision": p["revision"]}
        if op in {"read", "write"}:
            file = confined(root, a.get("path"))
            parts = file.relative_to(root).parts
            if any(p in {"node_modules", ".git", ".cache", "out", "previews"} for p in parts) or (op == "write" and ".build" in parts):
                raise Problem("managed_path", "Edit source files; build and output directories are managed.")
            if file.suffix not in TEXT_SUFFIXES:
                raise Problem("not_text", "This operation supports source text files.")
            if op == "read":
                if file.is_file() and file.stat().st_size > 512_000:
                    raise Problem("too_large", "File exceeds the source-read limit.")
                return {"path": a["path"], "sha": digest(file), "content": file.read_text() if file.is_file() else ""}
            editable(store, id)
            text = a.get("content")
            if not isinstance(text, str) or len(text.encode()) > 512_000:
                raise Problem("too_large", "Source writes must be text under 512 KB.")
            with store.transaction():
                if a.get("expected_sha") != digest(file):
                    raise Problem("write_conflict", "The file changed since it was read.", "Read it again and reconcile the changes.")
                atomic(file, text)
            return {"path": a["path"], "sha": digest(file), "needs_build": True}
        if op == "restore":
            editable(store, id)
            source = store.revision_path(id, a.get("revision"))
            # Preserve unbuilt edits as a recoverable directory; do not silently delete.
            backup = store.root / "backups" / id / uid("b")
            copy_source(root, backup)
            for file in list(source_files(root)):
                file.unlink()
            copy_source(source / "source", root)
            shutil.rmtree(root / ".build", ignore_errors=True)
            shutil.copytree(source / "build", root / ".build")
            with store.db() as db:
                kind = db.execute("SELECT kind FROM revisions WHERE project=? AND number=?", (id, a["revision"])).fetchone()[0]
            revision = snapshot(store, id, kind)
            return {"revision": revision, "backup": str(backup)}
    elif name == "hyperrizz_review":
        store.project(id)
        if op == "open":
            session = a.get("session_id")
            if not isinstance(session, str) or not 1 <= len(session) <= 200:
                raise Problem("session_required", "Pass the exact Hermes chat session ID, or select this project in the pane.")
            with store.db() as db:
                db.execute("INSERT OR REPLACE INTO bindings VALUES(?,?)", (session, id))
            return {"project": id, "session_id": session, "revision": store.project(id)["revision"], "view": "review"}
        if op == "notes":
            return {"notes": status(store, id)["notes"]}
        if op == "note":
            return add_note(store, id, a.get("frame"), a.get("text"), a.get("revision"))
        if op == "resolve":
            with store.db() as db:
                changed = db.execute("UPDATE notes SET resolved=1 WHERE id=? AND project=?", (a.get("note_id"), id)).rowcount
            if not changed:
                raise Problem("not_found", "Note not found in this project.")
            return {"resolved": a["note_id"]}
        from .studio import Studio
        studio = Studio(store, id)
        if op == "editor":
            store.idle(id)
            return studio.start()
        if op == "checkpoint":
            store.idle(id)
            return studio.checkpoint()
        if op == "close_editor":
            store.idle(id)
            return studio.close()
    elif name == "hyperrizz_produce":
        if op in {"build", "check", "render"}:
            return start_job(store, id, op)
        if op == "job":
            return job_status(store, a.get("job"))
        if op == "cancel":
            job = job_status(store, a.get("job"))
            with store.db() as db:
                db.execute("UPDATE jobs SET cancel=1 WHERE id=? AND status IN ('queued','running')", (job["id"],))
            return {"job": job["id"], "cancellation_requested": True}
    raise Problem("unknown_operation", f"Unsupported operation: {name}/{op}")
