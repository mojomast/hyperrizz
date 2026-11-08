"""Durable, profile-scoped state shared by tools, job workers and pane routes."""
from contextlib import contextmanager
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid


class Problem(Exception):
    def __init__(self, code, message, fix=""):
        super().__init__(message)
        self.code, self.fix = code, fix


def uid(prefix):
    return prefix + uuid.uuid4().hex[:16]


def digest(path):
    if not path.is_file():
        return "new"
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def confined(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative or "\x00" in relative:
        raise Problem("invalid_path", "Use a project-relative path.")
    p = Path(relative)
    if p.is_absolute() or ".." in p.parts:
        raise Problem("invalid_path", "Path escapes the project.")
    resolved = (root / p).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise Problem("invalid_path", "Symlink escapes the project.")
    return resolved


def atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


SKIP = {"node_modules", ".build", ".cache", ".git", ".hyperframes", "out", "previews", "__pycache__"}


def source_files(root):
    def walk(folder):
        for p in sorted(folder.iterdir()):
            if p.name in SKIP:
                continue
            if p.is_symlink():
                raise Problem("unsafe_source", f"Source symlinks are not supported: {p.name}")
            if p.is_dir():
                yield from walk(p)
            elif p.is_file():
                yield p
    yield from walk(root)


def fingerprint(root):
    h = hashlib.sha256()
    for p in source_files(root):
        h.update(p.relative_to(root).as_posix().encode())
        h.update(bytes.fromhex(digest(p)))
    return h.hexdigest()


class Store:
    def __init__(self, root=None):
        if root is None:
            from plugins.plugin_storage import plugin_data_dir
            root = plugin_data_dir("hyperrizz")
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.dbpath = self.root / "studio.sqlite3"
        with self.db() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, title TEXT NOT NULL,
              created REAL, revision INTEGER DEFAULT 0, source_sha TEXT DEFAULT '',
              edited_build INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS revisions(project TEXT, number INTEGER, created REAL,
              source_sha TEXT, kind TEXT, PRIMARY KEY(project, number));
            CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY, project TEXT, revision INTEGER,
              frame INTEGER, text TEXT, resolved INTEGER DEFAULT 0, created REAL);
            CREATE TABLE IF NOT EXISTS bindings(session TEXT PRIMARY KEY, project TEXT);
            CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, project TEXT, op TEXT,
              status TEXT, stage TEXT, pid INTEGER, created REAL, finished REAL,
              result TEXT DEFAULT '{}', cancel INTEGER DEFAULT 0);
            """)

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.dbpath, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @contextmanager
    def transaction(self):
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            yield db

    @contextmanager
    def edit_lock(self, id):
        self.project(id)
        folder = self.root / "locks"
        folder.mkdir(exist_ok=True)
        with (folder / (id + ".lock")).open("a+") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Problem("busy", "Another edit owns this project.", "Retry after the current operation finishes.")
            yield

    def project(self, id):
        if not isinstance(id, str) or not re.fullmatch(r"p[a-f0-9]{16}", id):
            raise Problem("project_required", "Choose a project ID from hyperrizz_project list.")
        with self.db() as db:
            row = db.execute("SELECT * FROM projects WHERE id=?", (id,)).fetchone()
        if row is None:
            raise Problem("not_found", "Project does not exist in this profile.")
        return dict(row)

    def path(self, id):
        self.project(id)
        return self.root / "projects" / id

    def revision_path(self, id, revision=None):
        p = self.project(id)
        revision = p["revision"] if revision is None else revision
        if type(revision) is not int or revision < 1:
            raise Problem("not_built", "The live preview is being prepared.", "Inspect the build job.")
        with self.db() as db:
            exists = db.execute("SELECT 1 FROM revisions WHERE project=? AND number=?", (id, revision)).fetchone()
        if not exists:
            raise Problem("not_found", "Revision does not exist.")
        return self.root / "revisions" / id / str(revision)

    def active(self, id):
        with self.db() as db:
            rows = db.execute("SELECT * FROM jobs WHERE project=? AND status IN ('queued','running')", (id,)).fetchall()
        for row in rows:
            if row["pid"]:
                try:
                    os.kill(row["pid"], 0)
                except ProcessLookupError:
                    with self.db() as db:
                        db.execute("UPDATE jobs SET status='interrupted',finished=? WHERE id=?", (time.time(), row["id"]))
                    continue
            return dict(row)
        return None

    def idle(self, id):
        if self.active(id):
            raise Problem("busy", "This project has an active job.", "Wait for it or cancel it before editing.")
