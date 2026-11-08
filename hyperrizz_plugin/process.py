"""Only owned processes, fixed commands and an explicit non-secret environment."""
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import json
import tempfile

from .store import Problem


def executable(name):
    path = shutil.which(name)
    if not path:
        raise Problem("missing_dependency", f"{name} is required.", "Install Node 22+, Python 3.11+ and FFmpeg, then retry.")
    return path


def child_env(root):
    home = root / "runtime-home"
    home.mkdir(parents=True, exist_ok=True)
    npmrc = home / "npmrc"
    npmrc.touch(exist_ok=True)
    paths = [str(Path(sys.executable).parent), "/usr/local/bin", "/usr/bin", "/bin"]
    node = shutil.which("node")
    if node:
        paths.insert(0, str(Path(node).parent))
    return {"PATH": os.pathsep.join(dict.fromkeys(paths)), "HOME": str(home),
            "LANG": "C.UTF-8", "PYTHONUNBUFFERED": "1", "NO_COLOR": "1", "DO_NOT_TRACK": "1",
            "NPM_CONFIG_USERCONFIG": str(npmrc), "NPM_CONFIG_CACHE": str(home / "npm-cache"),
            "OMP_NUM_THREADS": "2", "OPENBLAS_NUM_THREADS": "2"}


def limited(args):
    if sys.platform == "linux":
        cpus = sorted(os.sched_getaffinity(0))[:2]
        return [executable("nice"), "-n", "19", executable("taskset"), "-c", ",".join(map(str, cpus)), *args]
    return args


def stop_group(proc):
    if proc.poll() is not None:
        return
    os.killpg(proc.pid, signal.SIGTERM)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait(timeout=5)


def clear_dead_render_locks(project):
    """Only release dead locks naming this exact project; never another film's lock."""
    shared = Path('/tmp/opencode') if Path('/tmp/opencode').is_dir() else Path(tempfile.gettempdir())
    for file in [project / 'out/render.lock', shared / 'hyperframes-production-render.lock']:
        try:
            raw = file.read_bytes()
            owner = json.loads(raw)
            if owner.get('project') != str(project) or type(owner.get('pid')) is not int:
                continue
            pid = owner['pid']
            if pid < 1:
                continue
            alive = True
            try:
                os.kill(pid, 0)
                stat = Path(f'/proc/{pid}/stat')
                if stat.is_file() and stat.read_text().rsplit(')', 1)[1].split()[0] == 'Z':
                    alive = False
            except ProcessLookupError:
                alive = False
            if not alive and file.read_bytes() == raw:
                file.unlink()
        except (OSError, ValueError, KeyError, IndexError):
            continue
