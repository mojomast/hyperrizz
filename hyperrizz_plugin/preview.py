"""Package the actual HyperFrames player and a bounded immutable build for a guest frame.

All assets cross the authenticated Hermes JSON transport. The guest gets film bytes,
never a gateway credential or a filesystem URL. No server Chrome is needed to review.
"""
import base64
import hashlib
import json
import mimetypes
from pathlib import Path
import re

from .store import Problem, confined

MAX_BYTES = 32 * 1024 * 1024


def data_url(raw, mime):
    return "data:" + mime + ";base64," + base64.b64encode(raw).decode("ascii")


def js_json(value):
    return json.dumps(value, ensure_ascii=True).replace("<", "\\u003c")


def document(store, id, revision=None):
    rev = store.revision_path(id, revision)
    build = rev / "build"
    package = store.path(id) / "node_modules/hyperframes/dist"
    runtime_path = package / "hyperframe.runtime.iife.js"
    player_path = package / "hyperframes-player.global.js"
    if not runtime_path.is_file() or not player_path.is_file():
        raise Problem("missing_runtime", "Build once to install the pinned player runtime.")
    settings = json.loads((rev / "source/settings.json").read_text())
    sources, total = {}, 0
    for p in sorted(build.rglob("*")):
        if p.is_symlink():
            raise Problem("unsafe_asset", "Preview does not follow asset symlinks.")
        if p.is_file() and not any(part.startswith(".") for part in p.relative_to(build).parts):
            total += p.stat().st_size
            if total > MAX_BYTES:
                raise Problem("preview_budget", "Live preview assets exceed 32 MiB.",
                              "Use proxy-sized review assets or open Full editor; final render can use original media.")
            sources[p.relative_to(build).as_posix()] = p.read_bytes()
    # Exported project code uses the public assetUrl helper. Its preview implementation
    # maps the same project-relative paths to read-only data URLs in this guest only.
    urls = {p: data_url(raw, mimetypes.guess_type(p)[0] or "application/octet-stream") for p, raw in sources.items()}

    def resolve(value, base="index.html"):
        if value.startswith(("data:", "#")):
            return value
        if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", value) or value.startswith("//"):
            raise Problem("remote_asset", f"Preview asset must be local: {value[:120]}", "Import the asset into the project first.")
        key = confined(build, (Path(base).parent / value.split("?", 1)[0].split("#", 1)[0]).as_posix()).relative_to(build).as_posix()
        if key not in urls:
            raise Problem("missing_asset", f"Preview asset is missing: {key}")
        return urls[key]

    for p, raw in sources.items():
        if p.endswith(".css"):
            css = re.sub(r'url\(\s*[\'"]?([^\)\'"\s]+)[\'"]?\s*\)',
                         lambda m: 'url("' + resolve(m[1], p) + '")', raw.decode())
            urls[p] = data_url(css.encode(), "text/css")
    html = sources["index.html"].decode()
    html = re.sub(r'\b(src|href)\s*=\s*([\'"])(.*?)\2',
                  lambda m: m[1] + '="' + resolve(m[3]) + '"', html)
    runtime = data_url(runtime_path.read_bytes(), "text/javascript")
    # Keep only media in the runtime lookup, avoiding duplicate bundled JS/CSS bytes.
    assets = {p: url for p, url in urls.items() if not p.endswith((".html", ".js", ".css", ".json"))}
    bootstrap = (f'<script data-source="hyperframe.runtime.iife.js" src="{runtime}"></script><script>'
                 f'const hyperrizzAssets={js_json(assets)};'
                 r'window.__hyperframes.assetUrl=p=>{const key=String(p).replace(/^\.\//,"");'
                 'if(!(key in hyperrizzAssets))throw Error("Unpackaged preview asset: "+key);return hyperrizzAssets[key]};'
                 '</script>')
    html = html.replace("<head>", "<head>" + bootstrap, 1)
    # Render through the upstream player, including awaited frame sources, WebGL,
    # media and audio. The outer Hermes guest retains its opaque-origin sandbox.
    guest = f'''<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' data:; img-src data: blob:; media-src data: blob:; font-src data:; frame-src data: blob:; connect-src data: blob:">
<style>html,body{{margin:0;width:100%;height:100%;background:#101216;color:#eee;font:13px system-ui;overflow:hidden}}hyperframes-player{{display:block;width:100%;height:100%}}#error{{position:absolute;inset:12px;padding:20px;background:#251c21;display:none}}</style>
<script src="{data_url(player_path.read_bytes(), 'text/javascript')}"></script></head><body>
<hyperframes-player width="{settings['width']}" height="{settings['height']}" controls muted></hyperframes-player><div id="error" role="alert"></div>
<script>
const player=document.querySelector('hyperframes-player');
const send=(type,detail={{}})=>parent.postMessage({{channel:'hyperrizz-review',type,...detail}},'*');
const fail=message=>{{const e=document.getElementById('error');e.style.display='block';e.textContent=message;send('error',{{message}})}};
for(const type of ['ready','assetsready','play','pause','timeupdate','ended'])player.addEventListener(type,()=>send('state',{{time:player.currentTime,duration:player.duration,paused:player.paused,ready:player.assetsReady}}));
player.addEventListener('error',e=>fail(e.detail?.message||'Player could not load'));
window.addEventListener('message',e=>{{if(e.source!==parent||e.data?.channel!=='hyperrizz-review')return;const m=e.data;
if(m.type==='seek'&&Number.isFinite(m.time))player.seek(Math.max(0,Math.min(player.duration,m.time)));
if(m.type==='play')player.play();if(m.type==='pause')player.pause();if(m.type==='mute')player.muted=!!m.value;}});
player.setAttribute('srcdoc',{js_json(html)});
window.addEventListener('pagehide',()=>player.stopMedia());
</script></body></html>'''
    raw = guest.encode()
    if len(raw) > 48 * 1024 * 1024:
        raise Problem("preview_budget", "Packaged preview exceeds 48 MiB.", "Use smaller review proxies or Full editor.")
    return {"html": guest, "sha": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
            "revision": int(rev.name), "settings": settings}
