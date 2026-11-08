"""Loopback-only SDK test host. Authenticates requests; uses real plugin REST routes."""
from pathlib import Path
import importlib.util
import json
import sys
import secrets
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from hyperrizz_plugin.store import Store


def app(data, bundle, key):
    spec=importlib.util.spec_from_file_location("hyperrizz_pane_test_api",ROOT/"dashboard/plugin_api.py")
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    mod.Store=lambda:Store(data)
    api=FastAPI()
    @api.middleware("http")
    async def auth(request:Request,next):
        if request.url.path.startswith('/api/') and not secrets.compare_digest(request.headers.get('X-Test-Key',''),key):
            return JSONResponse({'ok':False},status_code=401)
        return await next(request)
    api.include_router(mod.router,prefix='/api/plugins/hyperrizz')
    @api.get('/')
    def index():
        return HTMLResponse('<!doctype html><html><body style="margin:0;background:#080a0d"><div id="pane" style="width:720px;height:100vh;margin:auto"></div><script>window.testKey='+json.dumps(key)+'</script><script type="module" src="/app.js"></script></body></html>')
    @api.get('/app.js')
    def js():return FileResponse(bundle,media_type='application/javascript')
    return api


if __name__=='__main__':
    uvicorn.run(app(Path(sys.argv[1]),sys.argv[2],sys.argv[3]),host='127.0.0.1',port=int(sys.argv[4]),log_level='warning')
