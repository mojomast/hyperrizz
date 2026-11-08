"""Full HyperFrames Studio is an owned, idle-expiring sidecar, reached via host REST."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.error

from .store import Problem, atomic, digest
from .process import child_env, limited, stop_group


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Studio:
    def __init__(self, store, id):
        self.store, self.id = store, id
        self.root = store.path(id)
        self.folder = store.root / "editors" / id
        self.meta = self.folder / "session.json"

    def request(self, route, body=None, timeout=15):
        if not self.meta.is_file():
            raise Problem("editor_closed", "Open Full editor first.")
        meta = json.loads(self.meta.read_text())
        port = meta.get("port")
        if type(port) is not int or not 1024 <= port <= 65535:
            raise Problem("editor_closed", "Invalid editor session.")
        req = urllib.request.Request(f"http://127.0.0.1:{port}/{route}",
                                     data=json.dumps(body or {}).encode(),
                                     headers={"X-Hyperrizz-Key": meta["token"], "Content-Type": "application/json"})
        client = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        try:
            with client.open(req, timeout=timeout) as response:
                raw = response.read(524289)
            if len(raw) > 524288:
                raise Problem("relay_budget", "Editor response exceeded 512 KiB.")
            result = json.loads(raw)
            if not result.get("ok"):
                raise Problem("editor_error", result.get("error", "Studio operation failed."))
            return result
        except urllib.error.HTTPError as e:
            try:
                detail = json.loads(e.read(16384)).get("error", f"Studio returned HTTP {e.code}")
            except (ValueError, AttributeError):
                detail = f"Studio returned HTTP {e.code}"
            raise Problem("editor_request_failed", detail, "The editor working copy is preserved.") from e
        except OSError as e:
            raise Problem("editor_disconnected", "Studio has stopped or the session expired.", "Reopen Full editor; its working files are preserved.") from e

    def status(self):
        stopped = {"running": False, "recoverable": (self.folder / "composition/index.html").is_file()}
        if not self.meta.is_file():
            return stopped
        try:
            return self.request("status", timeout=1)
        except Problem:
            return stopped

    def start(self):
        if self.status().get("running"):
            return {"running": True}
        self.store.revision_path(self.id)
        self.folder.mkdir(parents=True, exist_ok=True)
        working = self.folder / "composition"
        # Preserve an unsaved editor after a crash or disconnect.
        if not working.exists():
            shutil.copytree(self.store.revision_path(self.id) / "build", working)
        self.meta.unlink(missing_ok=True)
        config = {"token": secrets.token_urlsafe(32), "project": str(self.root),
                  "folder": str(self.folder), "title": self.store.project(self.id)["title"]}
        conf = self.folder / "private.json"
        atomic(conf, json.dumps(config))
        conf.chmod(0o600)
        script = Path(__file__).with_name("studio_host.py")
        with (self.folder / "studio.log").open("ab") as log:
            proc = subprocess.Popen(limited([sys.executable, str(script), str(self.store.root), str(conf)]),
                                    env=child_env(self.store.root), stdout=log, stderr=log, start_new_session=True)
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                raise Problem("editor_start_failed", "Studio could not start.", f"Read {self.folder / 'studio.log'}; close any active production job first.")
            if self.meta.is_file() and self.status().get("running"):
                return {"running": True, "width": 1280, "height": 800, "audio": "Use the native review player to audition sound."}
            time.sleep(0.2)
        stop_group(proc)
        raise Problem("editor_timeout", "Studio did not become ready.", f"Read {self.folder / 'studio.log'}.")

    def checkpoint(self):
        from .service import snapshot
        working = self.folder / "composition"
        if not (working / "index.html").is_file():
            raise Problem("editor_closed", "There is no Studio working copy to checkpoint.")
        if self.status().get("running"):
            self.request("flush")
        old = self.store.revision_path(self.id) / "build"
        def tree(folder):
            return {p.relative_to(folder).as_posix(): digest(p) for p in folder.rglob("*")
                    if p.is_file() and not any(v.startswith(".") for v in p.relative_to(folder).parts) and p.name != "build.json"}
        if tree(old) == tree(working):
            return {"revision": self.store.project(self.id)["revision"], "changed": False}
        # Import only regular confined content, never follow a Studio-created symlink.
        if any(p.is_symlink() for p in working.rglob("*")):
            raise Problem("unsafe_asset", "Editor working copy contains a symlink.")
        shutil.rmtree(self.root / ".build", ignore_errors=True)
        shutil.copytree(working, self.root / ".build", ignore=shutil.ignore_patterns(".hyperframes", ".cache"))
        revision = snapshot(self.store, self.id, "studio")
        return {"revision": revision, "changed": True, "source_reconciliation_required": True}

    def close(self):
        if self.status().get("running"):
            self.request("flush")
            self.request("close")
            deadline = time.monotonic() + 15
            while self.meta.is_file() and time.monotonic() < deadline:
                time.sleep(0.1)
            if self.meta.is_file():
                raise Problem("editor_closing", "Studio is still closing; working files are preserved.")
        saved = self.checkpoint() if (self.folder / "composition/index.html").is_file() else {}
        # A saved editor can be recreated from the immutable revision.
        shutil.rmtree(self.folder / "composition", ignore_errors=True)
        return {"running": False, **saved}
