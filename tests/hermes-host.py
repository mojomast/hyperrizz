"""Run with a Hermes checkout on PYTHONPATH and an isolated HERMES_HOME.

Exercises the real Hermes ASGI auth/discovery/profile gate, not a fake ctx.
Private host-test fixtures stay here; production code uses public APIs only.
"""
import json
import shutil
from pathlib import Path
import sys
from starlette.testclient import TestClient
from hermes_constants import get_hermes_home
from hermes_cli import web_server
from hermes_cli.config import load_config, save_config

home = get_hermes_home()
assert str(home).startswith('/tmp/opencode/'), 'Use an isolated test home'
source = Path(__file__).resolve().parents[1]
plugins = home / 'plugins'
plugins.mkdir(parents=True, exist_ok=True)
link = plugins / 'hyperrizz'
if not link.exists():
    link.symlink_to(source, target_is_directory=True)
config = load_config()
isolation = sys.argv[1] if len(sys.argv) > 1 else 'host'
config['plugins'] = {'enabled': ['hyperrizz'], 'isolation': isolation}
save_config(config)
fixture = None
if len(sys.argv) > 3:
    # Seed a previously rendered film to exercise large payloads through the real
    # hosted-plugin wire. The fixture is copied; its accepted export is not mutated.
    sys.path.insert(0, str(source))
    from hyperrizz_plugin.store import Store
    from hyperrizz_plugin.service import make_project, snapshot
    accepted = Store(Path(sys.argv[2]))
    accepted_id = sys.argv[3]
    current = Store()
    fixture = make_project(current, 'Host transport acceptance', 'starter')
    dst = current.path(fixture)
    shutil.copytree(accepted.revision_path(accepted_id) / 'source', dst, dirs_exist_ok=True)
    shutil.copytree(accepted.revision_path(accepted_id) / 'build', dst / '.build')
    (dst / 'node_modules').symlink_to(accepted.path(accepted_id) / 'node_modules', target_is_directory=True)
    snapshot(current, fixture)
web_server._dashboard_plugins_cache = None
with TestClient(web_server.app) as client:
    route = '/api/plugins/hyperrizz/state?session=host-acceptance'
    unauthenticated = client.get(route)
    assert unauthenticated.status_code in (401, 403), unauthenticated.text
    client.headers[web_server._SESSION_HEADER_NAME] = web_server._SESSION_TOKEN
    response = client.get(route)
    assert response.status_code == 200, response.text
    assert response.json()['ok']
    project = client.post('/api/plugins/hyperrizz/action', json={'tool': 'hyperrizz_project', 'args': {'op': 'list'}})
    assert project.status_code == 200 and project.json()['ok'], project.text
    if fixture:
        info = client.get(f'/api/plugins/hyperrizz/preview/{fixture}/1')
        assert info.status_code == 200 and info.json()['ok'], info.text
        chunk = client.get(f'/api/plugins/hyperrizz/preview/{fixture}/1/0')
        assert chunk.status_code == 200 and len(chunk.json()['data']) > 600000, chunk.text[:1000]
        note = client.post('/api/plugins/hyperrizz/action', json={'tool': 'hyperrizz_review',
            'args': {'op': 'note', 'project': fixture, 'frame': 48, 'text': 'Hosted transport verified'}})
        assert note.status_code == 200 and note.json()['ok'], note.text
    config['plugins']['disabled'] = ['hyperrizz']
    config['plugins']['enabled'] = []
    save_config(config)
    disabled = client.get(route)
    assert disabled.status_code == 404, disabled.text
print(json.dumps({'ok': True, 'host': 'real Hermes ASGI application', 'isolation': isolation, 'anonymous': unauthenticated.status_code,
                  'authenticated': response.status_code, 'disabled': disabled.status_code, 'largePreviewAndNotes': bool(fixture)}))
