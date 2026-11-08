import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import {timingSafeEqual} from 'node:crypto';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const requireProject = createRequire(path.join(config.project, 'package.json'));
const requireHF = createRequire(requireProject.resolve('hyperframes/package.json'));
const puppeteer = (await import(pathToFileURL(requireProject.resolve('puppeteer-core')))).default;
const dist = path.dirname(requireHF.resolve('./dist/hyperframe.runtime.iife.js'));
const moduleName = fs.readdirSync(dist).find(n => /^studioServer-.*\.js$/.test(n));
if (!moduleName) throw Error('Pinned HyperFrames Studio server is unavailable');
const {createStudioServer} = await import(pathToFileURL(path.join(dist, moduleName)));
const {createAdaptorServer} = await import(pathToFileURL(requireHF.resolve('@hono/node-server')));
let origin;
const studio = createStudioServer({projectDir: path.join(config.folder, 'composition'), projectName: 'film',
  autoProxy: false, browserGpuMode: 'software', origin: () => origin});
const server = createAdaptorServer({fetch: studio.app.fetch});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;

function chrome(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isFile() && ['chrome-headless-shell', 'chrome', 'Chromium'].includes(e.name)) return p;
    if (e.isDirectory()) { const found = chrome(p); if (found) return found; }
  }
}
const executablePath = chrome(path.join(os.homedir(), '.cache/hyperframes/chrome'));
if (!executablePath) throw Error('Run a project check first to provision HyperFrames Chromium.');
const browser = await puppeteer.launch({executablePath, headless: true,
  args: ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader', ...(process.getuid?.()===0?['--no-sandbox']:[])],
  env: {PATH: process.env.PATH, HOME: os.homedir(), LANG: 'C.UTF-8'}});
const page = await browser.newPage();
const writes = new Set();
let lastWrite = Date.now();
page.on('request', request => { if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.add(request);lastWrite=Date.now();} });
for(const event of ['requestfinished','requestfailed'])page.on(event, request => {if(writes.delete(request))lastWrite=Date.now();});
await page.setViewport({width: 1280, height: 800, deviceScaleFactor: 1});
await page.goto(`${origin}/#project/film`, {waitUntil: 'domcontentloaded', timeout: 30000});
let last = Date.now(), closing = false, queue = Promise.resolve();
const pressed = new Set();
const sessionPath = path.join(config.folder, 'session.json');
async function close() {
  if (closing) return; closing = true;
  await browser.close();
  await studio.shutdown?.(); studio.watcher?.close();
  server.close(); relay.close();fs.rmSync(sessionPath, {force: true});process.exit(0);
}
function authorised(req) {
  const a = Buffer.from(String(req.headers['x-hyperrizz-key'] || '')), b = Buffer.from(config.token);
  return !req.headers.origin && a.length === b.length && timingSafeEqual(a, b);
}
async function action(route, body) {
  if (route === '/status') return {ok: true, running: true};
  last = Date.now();
  if (route === '/frame') {
    // One capture path, with a bound on the complete serialized response.
    for (const quality of [78, 55, 35]) {
      const bytes = await page.screenshot({type: 'jpeg', quality, optimizeForSpeed: true});
      const result = {ok: true, width: 1280, height: 800, image: Buffer.from(bytes).toString('base64')};
      if (Buffer.byteLength(JSON.stringify(result)) <= 500000) return result;
    }
    throw Error('Studio frame exceeds the 512 KiB relay budget');
  }
  if (route === '/input') {
    if (body.kind === 'pointer') {
      if (![body.x, body.y].every(Number.isFinite) || body.x < 0 || body.x > 1280 || body.y < 0 || body.y > 800) throw Error('Invalid pointer');
      await page.mouse.move(body.x, body.y);
      if (body.action === 'down') await page.mouse.down({button: body.button === 'right' ? 'right' : 'left'});
      else if (body.action === 'up') await page.mouse.up({button: body.button === 'right' ? 'right' : 'left'});
      else if (body.action !== 'move') throw Error('Invalid pointer action');
    } else if (body.kind === 'wheel') {
      if (![body.x, body.y].every(Number.isFinite)) throw Error('Invalid wheel');
      await page.mouse.wheel({deltaX: Math.max(-1000, Math.min(1000, body.x)), deltaY: Math.max(-1000, Math.min(1000, body.y))});
    } else if (body.kind === 'text') {
      if (typeof body.text !== 'string' || body.text.length > 4000) throw Error('Text input exceeds 4000 characters');
      await page.keyboard.sendCharacter(body.text);
    } else if (body.kind === 'key') {
      if (typeof body.key !== 'string' || body.key.length > 30 || !['down', 'up'].includes(body.action)) throw Error('Invalid key');
      await page.keyboard[body.action](body.key);
      if(body.action==='down')pressed.add(body.key);else pressed.delete(body.key);
    } else if(body.kind==='release') {
      for(const key of pressed)await page.keyboard.up(key);pressed.clear();await page.mouse.up();
    } else throw Error('Unknown input');
    return {ok: true};
  }
  if (route === '/flush') {
    await page.mouse.up().catch(() => {});
    const start=Date.now();
    while(writes.size||Date.now()-Math.max(start,lastWrite)<800){
      if(Date.now()-start>10000)throw Error('Studio saves did not settle; edits remain in the working copy');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return {ok:true};
  }
  if (route === '/close') { setTimeout(() => void close(), 100); return {ok: true}; }
  throw Error('Unknown editor operation');
}
const relay = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  if (!authorised(req) || req.method !== 'POST') { res.writeHead(403); res.end('{"ok":false,"error":"Forbidden"}'); return; }
  let size = 0, chunks = [];
  try {
    for await (const part of req) { size += part.length; if (size > 16384) throw Error('Input exceeds 16 KiB'); chunks.push(part); }
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const result = queue.then(() => action(req.url, body));
    queue = result.catch(() => {});
    res.end(JSON.stringify(await result));
  } catch (e) { res.writeHead(400); res.end(JSON.stringify({ok: false, error: e.message})); }
});
await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
fs.writeFileSync(sessionPath, JSON.stringify({port: relay.address().port, token: config.token, pid: process.pid}), {mode: 0o600});
setInterval(() => { if (Date.now() - last > 120000) void close(); }, 10000).unref();
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
console.log('Full HyperFrames Studio is ready; expires after two minutes without pane activity.');
