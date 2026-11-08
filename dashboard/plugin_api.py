"""Hermes authenticates and profile-scopes this router before dispatching it."""
import base64
import importlib.util
import json
from pathlib import Path
import sys

from fastapi import APIRouter, Request
from starlette.concurrency import run_in_threadpool

# Dashboard loaders use an independent module name. Load only our own package;
# tools and routes communicate through profile storage, never module globals.
_root = Path(__file__).resolve().parents[1]
_name = "_hyperrizz_backend_" + __import__("hashlib").sha256(str(_root).encode()).hexdigest()[:12]
if _name not in sys.modules:
    spec = importlib.util.spec_from_file_location(_name, _root / "hyperrizz_plugin/__init__.py",
                                                submodule_search_locations=[str(_root / "hyperrizz_plugin")])
    module = importlib.util.module_from_spec(spec)
    sys.modules[_name] = module
    spec.loader.exec_module(module)
service = __import__(_name + ".service", fromlist=["dispatch"])
preview = __import__(_name + ".preview", fromlist=["document"])
studio = __import__(_name + ".studio", fromlist=["Studio"])
Store, Problem = service.Store, service.Problem
router = APIRouter()


async def body(request, limit=600000):
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise Problem("too_large", "Request exceeds the body limit.")
        chunks.append(chunk)
    value = json.loads(b"".join(chunks) or b"{}")
    if not isinstance(value, dict):
        raise Problem("invalid_request", "Expected a JSON object.")
    return value


def envelope(fn, *args):
    try:
        return {"ok": True, **fn(*args)}
    except Problem as e:
        return {"ok": False, "code": e.code, "error": str(e), "fix": e.fix}
    except Exception as e:
        return {"ok": False, "code": "request_failed", "error": str(e)}


@router.get("/state")
def state(session: str = ""):
    store = Store()
    with store.db() as db:
        bound = db.execute("SELECT project FROM bindings WHERE session=?", (session,)).fetchone()
    return {"ok": True, "projects": service.operate(store, "hyperrizz_project", {"op": "list"})["projects"],
            "selected": bound[0] if bound else None}


@router.get("/project/{id}")
def project(id: str):
    return envelope(service.status, Store(), id)


@router.post("/action")
async def action(request: Request):
    try:
        data = await body(request)
        if data.get("tool") not in {"hyperrizz_project", "hyperrizz_review", "hyperrizz_produce"}:
            raise Problem("invalid_tool", "Unknown production tool.")
        return await run_in_threadpool(service.dispatch, data["tool"], data.get("args", {}), Store())
    except Exception as e:
        return {"ok": False, "code": "invalid_request", "error": str(e)}


def preview_file(store, id, revision):
    store.revision_path(id, revision)
    file = store.root / "preview-packages" / id / f"{revision}-v1.html"
    if not file.is_file():
        service.atomic(file, preview.document(store, id, revision)["html"])
    return file


@router.get("/preview/{id}/{revision}")
def preview_info(id: str, revision: int):
    def info():
        file = preview_file(Store(), id, revision)
        settings = json.loads((Store().revision_path(id, revision) / "source/settings.json").read_text())
        return {"bytes": file.stat().st_size, "sha": service.digest(file), "chunk_bytes": 512000, "settings": settings,
                "shell": (_root / "hyperrizz_plugin/review_shell.html").read_text()}
    return envelope(info)


@router.get("/preview/{id}/{revision}/{chunk}")
def preview_chunk(id: str, revision: int, chunk: int):
    def read():
        file = preview_file(Store(), id, revision)
        if not 0 <= chunk < (file.stat().st_size + 511999) // 512000:
            raise Problem("invalid_chunk", "Chunk is outside this preview.")
        with file.open("rb") as f:
            f.seek(chunk * 512000)
            return {"data": base64.b64encode(f.read(512000)).decode()}
    return envelope(read)


@router.post("/studio/{id}/{op}")
async def studio_action(id: str, op: str, request: Request):
    try:
        data = await body(request, 16384)
        if op not in {"frame", "input"}:
            raise Problem("invalid_operation", "Unsupported editor operation.")
        editor = studio.Studio(Store(), id)
        return await run_in_threadpool(envelope, editor.request, op, data)
    except Exception as e:
        return {"ok": False, "code": "studio_error", "error": str(e)}


@router.get("/export/{id}")
def export_info(id: str):
    def info():
        store = Store()
        store.project(id)
        root = store.root / "exports" / id
        report = json.loads((root / "export.json").read_text())
        file = Path(report["path"]).resolve()
        if not file.is_relative_to(root.resolve()):
            raise Problem("invalid_path", "Export path escapes the project.")
        return {"path": str(file), "name": f"hyperrizz-r{report['revision']}.mp4", "bytes": file.stat().st_size}
    return envelope(info)
