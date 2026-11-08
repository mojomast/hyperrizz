"""Opt-in real-process cancellation/failure acceptance, using an existing test install."""
import json
import os
from pathlib import Path
import shutil
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hyperrizz_plugin.store import Store
from hyperrizz_plugin.service import make_project, snapshot, dispatch, job_status

store = Store(Path(sys.argv[1]))
assert str(store.root).startswith('/tmp/opencode/'), 'Use isolated acceptance data'
installed = store.path(sys.argv[2])
id = make_project(store, 'Cancellation acceptance fixture', 'starter')
root = store.path(id)
(root / 'node_modules').symlink_to(installed / 'node_modules', target_is_directory=True)
shutil.copytree(store.revision_path(sys.argv[2]) / 'build', root / '.build')
snapshot(store, id)
script = root / 'scripts/build.mjs'
script.write_text('''import fs from 'node:fs'; import {spawn} from 'node:child_process';
fs.mkdirSync('.cache',{recursive:true});fs.mkdirSync('out',{recursive:true});
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{env:{PATH:'/usr/bin:/bin'}});
fs.writeFileSync('.cache/child-pid',String(child.pid));
fs.writeFileSync('out/render.lock',JSON.stringify({pid:process.pid,project:process.cwd()}));
setInterval(()=>{},1000);
''')
job = dispatch('hyperrizz_produce', {'op': 'build', 'project': id}, store)
assert job['ok'], job
deadline = time.monotonic() + 20
while not (root / '.cache/child-pid').is_file():
    assert time.monotonic() < deadline, job_status(store, job['job'])
    time.sleep(.1)
child = int((root / '.cache/child-pid').read_text())
assert dispatch('hyperrizz_produce', {'op': 'cancel', 'job': job['job']}, store)['ok']
def wait(id):
    end = time.monotonic() + 20
    while time.monotonic() < end:
        value = job_status(store, id)
        if value['status'] not in ('running', 'queued'):
            return value
        time.sleep(.1)
    raise RuntimeError('worker did not terminate')
result = wait(job['job'])
assert result['status'] == 'cancelled', result
try:
    os.kill(child, 0)
    assert Path(f'/proc/{child}/stat').read_text().rsplit(')', 1)[1].split()[0] == 'Z'
except ProcessLookupError:
    pass
assert not (root / 'out/render.lock').exists(), 'Cancelled worker left its owned render lock'
script.write_text('throw Error("Intentional failed-build acceptance fixture");')
failed = dispatch('hyperrizz_produce', {'op': 'build', 'project': id}, store)
assert wait(failed['job'])['status'] == 'failed'
assert store.project(id)['revision'] == 1
assert (store.revision_path(id) / 'build/index.html').is_file()
report = {'ok': True, 'cancelledProcessGroup': True, 'deadOwnedLockReleased': True,
          'failedBuildPreservedPreview': True}
(store.root / 'lifecycle-test.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
