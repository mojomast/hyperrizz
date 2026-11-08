"""Detached bounded job runner. Survives a pane disconnect; cancellation is durable."""
from pathlib import Path
import fcntl
import json
import os
import shutil
import subprocess
import signal
import sys
import time

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hyperrizz_plugin.store import Store, Problem, atomic, fingerprint
from hyperrizz_plugin.process import child_env, executable, limited, stop_group, clear_dead_render_locks
from hyperrizz_plugin.service import snapshot


def run(store, idjob):
    with store.db() as db:
        job = dict(db.execute("SELECT * FROM jobs WHERE id=?", (idjob,)).fetchone())
        db.execute("UPDATE jobs SET status='running',pid=? WHERE id=?", (os.getpid(), idjob))
    root = store.path(job["project"])
    proc = None
    lock = None

    def cancelled():
        with store.db() as db:
            return db.execute("SELECT cancel FROM jobs WHERE id=?", (idjob,)).fetchone()[0]

    def command(stage, args, timeout=600):
        nonlocal proc
        if cancelled():
            raise Problem("cancelled", "Job cancelled by the user.")
        with store.db() as db:
            db.execute("UPDATE jobs SET stage=? WHERE id=?", (stage, idjob))
        print(f"\n[{stage}]", flush=True)
        proc = subprocess.Popen(limited(args), cwd=root, env=child_env(store.root), start_new_session=True)
        deadline = time.monotonic() + timeout
        while proc.poll() is None:
            if cancelled() or time.monotonic() > deadline:
                stop_group(proc)
                raise Problem("cancelled" if cancelled() else "timeout", f"{stage} stopped.")
            time.sleep(0.2)
        if proc.returncode:
            raise Problem("command_failed", f"{stage} exited {proc.returncode}.", "Inspect the job log and repair the source.")

    try:
        before = fingerprint(root)
        # One job or Studio browser per profile; framework render also owns shared lock.
        lock = open(store.root / "production.lock", "a+")
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Problem("host_busy", "Another production job or Studio owns this profile.", "Close Studio or let the current job finish, then retry.")
        if not (root / "node_modules/hyperframes/package.json").is_file():
            command("install pinned dependencies", [executable("npm"), "ci", "--no-audit", "--no-fund"], 300)
        hf = str(root / "node_modules/.bin/hyperframes")
        if job["op"] == "build":
            if (root / "scripts/prepare.mjs").is_file():
                command("prepare derived assets", [executable("node"), "scripts/prepare.mjs"])
            before = fingerprint(root)
            command("build live project", [executable("node"), "scripts/build.mjs"])
            command("lint", [hf, "lint", ".build"])
            command("framework check", [hf, "check", ".build"], 600)
            if fingerprint(root) != before:
                raise Problem("source_changed", "Source changed while the build was running; previous preview retained.")
            revision = snapshot(store, job["project"])
            result = {"revision": revision, "preview_ready": True}
        else:
            build_before = fingerprint(root / ".build")
            command("framework check", [hf, "check", ".build"], 600)
            command("seek determinism", [executable("npm"), "run", "seek-check"], 600)
            if fingerprint(root) != before or fingerprint(root / ".build") != build_before:
                raise Problem("source_changed", "Source or build changed during checks.")
            result = {"checked": True, "revision": store.project(job["project"])["revision"]}
            if job["op"] == "render":
                command("render and verify candidate", [executable("npm"), "run", "render"], 7200)
                if fingerprint(root) != before or fingerprint(root / ".build") != build_before:
                    raise Problem("source_changed", "Source changed during export; export was not published.")
                revision = store.project(job["project"])["revision"]
                out = store.root / "exports" / job["project"]
                out.mkdir(parents=True, exist_ok=True)
                dest = out / f"r{revision}-{idjob}.mp4"
                shutil.copy2(root / "out/master.mp4", dest)
                report = json.loads((root / "out/master-verification.json").read_text())
                result.update(path=str(dest), verification=report)
                atomic(out / "export.json", json.dumps(result, indent=2))
        with store.db() as db:
            db.execute("UPDATE jobs SET status='succeeded',stage='complete',result=?,finished=? WHERE id=?",
                       (json.dumps(result), time.time(), idjob))
    except BaseException as e:
        if proc and proc.poll() is None:
            stop_group(proc)
        code = getattr(e, "code", "worker_failed")
        print(f"{code}: {e}", flush=True)
        with store.db() as db:
            db.execute("UPDATE jobs SET status=?,stage=?,result=?,finished=? WHERE id=?",
                       ("cancelled" if code == "cancelled" else "failed", str(e),
                        json.dumps({"code": code, "error": str(e)}), time.time(), idjob))
    finally:
        clear_dead_render_locks(root)
        if lock:
            lock.close()


if __name__ == "__main__":
    def interrupted(*args):
        raise Problem("cancelled", "Worker was stopped; its child processes are being closed.")
    signal.signal(signal.SIGTERM, interrupted)
    run(Store(Path(sys.argv[1])), sys.argv[2])
