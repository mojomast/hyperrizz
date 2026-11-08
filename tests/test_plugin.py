"""Behavior contracts for persistent edits, revisions, host wiring and process boundaries."""
import importlib.util
import json
from pathlib import Path
import sys
from unittest.mock import patch

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from hyperrizz_plugin.store import Store, Problem, confined, digest
from hyperrizz_plugin.service import make_project, snapshot, dispatch, status, bind_tool_result
from hyperrizz_plugin.process import child_env, clear_dead_render_locks
from hyperrizz_plugin.preview import document


@pytest.fixture
def film(tmp_path):
    store = Store(tmp_path)
    id = make_project(store, "Test film", "starter")
    root = store.path(id)
    build = root / ".build"
    build.mkdir()
    (build / "index.html").write_text('<!doctype html><html><head></head><body>Original</body></html>')
    snapshot(store, id)
    return store, id, root


def test_registration_is_offline_and_results_are_json():
    spec = importlib.util.spec_from_file_location("hyperrizz_test_plugin", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    tools, hooks, skills = {}, {}, {}
    class Host:
        def register_tool(self, *, name, toolset, schema, handler, description="", emoji=""):
            tools[name] = handler
        def register_skill(self, name, path):
            skills[name] = Path(path)
        def register_hook(self, name, callback):
            hooks[name] = callback
    with patch("subprocess.Popen", side_effect=AssertionError("registration spawned a process")):
        module.register(Host())
    manifest = yaml.safe_load((ROOT / "plugin.yaml").read_text())
    assert set(tools) == set(manifest["provides_tools"])
    assert set(hooks) == set(manifest["provides_hooks"])
    assert skills["production"].is_file()
    with patch.object(module, "dispatch", return_value={"ok": False, "code": "bad"}):
        for fn in tools.values():
            assert json.loads(fn({"op": "bad"}))["code"] == "bad"


def test_strict_manifest():
    class Strict(yaml.SafeLoader):
        pass
    def mapping(loader, node):
        out = {}
        for k, v in node.value:
            key = loader.construct_object(k)
            assert key not in out, f"duplicate {key}"
            out[key] = loader.construct_object(v)
        return out
    Strict.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
    value = yaml.load((ROOT / "plugin.yaml").read_text(), Loader=Strict)
    assert isinstance(value["version"], str)


def test_optimistic_writes_preserve_unseen_user_edits(film):
    store, id, root = film
    read = dispatch("hyperrizz_project", {"op": "read", "project": id, "path": "copy.json"}, store)
    (root / "copy.json").write_text('{"user":"new edit"}')
    result = dispatch("hyperrizz_project", {"op": "write", "project": id, "path": "copy.json", "content": "{}", "expected_sha": read["sha"]}, store)
    assert result["code"] == "write_conflict"
    assert json.loads((root / "copy.json").read_text())["user"] == "new edit"


def test_source_edit_is_dirty_and_preview_is_immutable(film):
    store, id, root = film
    assert not status(store, id)["dirty"]
    result = dispatch("hyperrizz_project", {"op": "write", "project": id, "path": "copy.json", "content": "{}", "expected_sha": digest(root / "copy.json")}, store)
    assert result["ok"] and status(store, id)["dirty"]
    assert (store.revision_path(id) / "build/index.html").read_text().endswith('Original</body></html>')
    assert dispatch("hyperrizz_produce", {"op": "render", "project": id}, store)["code"] == "stale_build"


def test_files_are_confined_even_through_symlinks(film, tmp_path):
    store, id, root = film
    outside = tmp_path / "private.txt"
    outside.write_text("private")
    (root / "escape").symlink_to(tmp_path, target_is_directory=True)
    for path in ["../private.txt", str(outside), "escape/private.txt", "a\\b"]:
        assert dispatch("hyperrizz_project", {"op": "read", "project": id, "path": path}, store)["code"] == "invalid_path"
    with pytest.raises(Problem):
        confined(root, "../x")


def test_notes_pin_revision_and_frame_and_are_profile_local(film, tmp_path):
    store, id, root = film
    note = dispatch("hyperrizz_review", {"op": "note", "project": id, "frame": 15, "text": "Hold this title"}, store)
    assert note["revision"] == 1
    snapshot(store, id)
    notes = dispatch("hyperrizz_review", {"op": "notes", "project": id}, store)["notes"]
    assert notes[0]["revision"] == 1 and notes[0]["frame"] == 15
    assert dispatch("hyperrizz_review", {"op": "note", "project": id, "frame": 60, "text": "bad"}, store)["code"] == "invalid_frame"
    assert dispatch("hyperrizz_review", {"op": "resolve", "project": id, "note_id": note["note_id"]}, store)["ok"]
    assert dispatch("hyperrizz_project", {"op": "status", "project": id}, Store(tmp_path / "other-profile"))["code"] == "not_found"


def test_restore_backs_up_unbuilt_edits(film):
    store, id, root = film
    (root / "copy.json").write_text('{"local":"must survive"}')
    result = dispatch("hyperrizz_project", {"op": "restore", "project": id, "revision": 1}, store)
    assert result["ok"] and result["revision"] == 2
    assert json.loads((Path(result["backup"]) / "copy.json").read_text())["local"] == "must survive"
    assert not status(store, id)["dirty"]


def test_hook_routes_only_success_to_its_exact_session(film):
    store, id, root = film
    other = make_project(store, "Other", "starter")
    with patch("hyperrizz_plugin.service.Store", return_value=store):
        bind_tool_result(tool_name="hyperrizz_project", args={"op": "create"}, result=json.dumps({"ok": True, "project": id}), session_id="chat-a")
        bind_tool_result(tool_name="hyperrizz_project", args={"op": "status", "project": other}, result='{"ok":true}', session_id="chat-a")
        bind_tool_result(tool_name="hyperrizz_project", args={"op": "create"}, result=json.dumps({"ok": False, "project": other}), session_id="chat-b")
    with store.db() as db:
        bindings = dict(db.execute("SELECT session,project FROM bindings"))
    assert bindings == {"chat-a": id}


def test_process_environment_does_not_inherit_secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("UNRELATED_SECRET_SENTINEL", "do-not-pass")
    monkeypatch.setenv("NODE_OPTIONS", "--require /malicious.js")
    monkeypatch.setenv("HTTP_PROXY", "http://bad-proxy")
    env = child_env(tmp_path)
    assert "do-not-pass" not in json.dumps(env)
    assert "NODE_OPTIONS" not in env and "HTTP_PROXY" not in env
    assert env["DO_NOT_TRACK"] == "1"
    assert Path(env["HOME"]).is_relative_to(tmp_path)


def test_live_preview_fails_explicitly_on_missing_and_remote_assets(film):
    store, id, root = film
    runtime = root / "node_modules/hyperframes/dist"
    runtime.mkdir(parents=True)
    for name in ["hyperframe.runtime.iife.js", "hyperframes-player.global.js"]:
        (runtime / name).write_text("// test fixture")
    rev = store.revision_path(id)
    html = rev / "build/index.html"
    html.write_text('<html><head></head><body><img src="missing.png"></body></html>')
    with pytest.raises(Problem, match="missing"):
        document(store, id)
    html.write_text('<html><head></head><body><img src="https://example.com/image.png"></body></html>')
    with pytest.raises(Problem, match="local"):
        document(store, id)


def test_studio_edits_cannot_be_silently_rebuilt(film):
    store, id, root = film
    snapshot(store, id, "studio")
    result = dispatch("hyperrizz_produce", {"op": "build", "project": id}, store)
    assert result["code"] == "studio_changes"


def test_unknown_operations_return_recoverable_errors(film):
    store, id, root = film
    for name in ["hyperrizz_project", "hyperrizz_review", "hyperrizz_produce"]:
        result = dispatch(name, {"op": "unknown", "project": id}, store)
        assert not result["ok"] and result["code"] == "unknown_operation"


def test_only_dead_project_render_locks_are_released(film):
    import os
    store, id, root = film
    lock = root / 'out/render.lock'
    lock.parent.mkdir(exist_ok=True)
    lock.write_text(json.dumps({'project': str(root), 'pid': os.getpid()}))
    clear_dead_render_locks(root)
    assert lock.exists(), 'A live render owner must keep its lock'
    lock.write_text(json.dumps({'project': str(root / 'different'), 'pid': 999999999}))
    clear_dead_render_locks(root)
    assert lock.exists(), 'Another project must keep its lock'
    lock.write_text(json.dumps({'project': str(root), 'pid': 999999999}))
    clear_dead_render_locks(root)
    assert not lock.exists()


def test_reconcile_preserves_editor_revision_and_requires_changed_source(film):
    store, id, root = film
    revision = snapshot(store, id, 'studio')
    args = {'op': 'reconcile', 'project': id, 'revision': revision}
    assert dispatch('hyperrizz_project', args, store)['code'] == 'source_unchanged'
    (root / 'copy.json').write_text('{"reconciled":true}')
    result = dispatch('hyperrizz_project', args, store)
    assert result['ok'] and not store.project(id)['edited_build']
    assert store.revision_path(id, revision).is_dir()


def test_expired_editor_must_be_recovered_before_source_edits(film):
    import shutil
    store, id, root = film
    working = store.root / 'editors' / id / 'composition'
    shutil.copytree(root / '.build', working)
    (working / 'index.html').write_text('<html><head></head><body>Unsaved Studio work</body></html>')
    assert dispatch('hyperrizz_produce', {'op': 'build', 'project': id}, store)['code'] == 'editor_recovery'
    recovered = dispatch('hyperrizz_review', {'op': 'close_editor', 'project': id}, store)
    assert recovered['ok'] and recovered['changed'] and recovered['revision'] == 2
    assert 'Unsaved Studio work' in (store.revision_path(id) / 'build/index.html').read_text()


def test_render_rejects_a_build_modified_after_review(film):
    store, id, root = film
    (root / '.build/index.html').write_text('A different film')
    result = dispatch('hyperrizz_produce', {'op': 'render', 'project': id}, store)
    assert result['code'] == 'stale_build'


def test_project_mutations_do_not_race_an_existing_edit(film):
    store, id, root = film
    with store.edit_lock(id):
        result = dispatch('hyperrizz_project', {'op': 'restore', 'project': id, 'revision': 1}, store)
    assert result['code'] == 'busy'
    assert store.project(id)['revision'] == 1
