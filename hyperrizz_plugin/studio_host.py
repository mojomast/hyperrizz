"""Hold the production lease for the full lifetime of the editor process."""
from pathlib import Path
import fcntl
import subprocess
import signal
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hyperrizz_plugin.process import child_env, executable, stop_group


def main():
    def interrupted(*args):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    root = Path(sys.argv[1])
    with open(root / "production.lock", "a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        proc = subprocess.Popen([executable("node"), str(Path(__file__).with_name("studio.mjs")), sys.argv[2]],
                                env=child_env(root), start_new_session=True)
        try:
            return proc.wait()
        finally:
            stop_group(proc)


if __name__ == "__main__":
    sys.exit(main())
