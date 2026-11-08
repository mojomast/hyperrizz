import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {root, settings, frames} from './common.mjs';

process.chdir(root);
const buildRoot = fs.realpathSync('.build');
const original = fs.readFileSync('.build/index.html', 'utf8');
assert.ok(original.includes('<script src="runtime.js"></script>'), 'Update test bootstrap if runtime entry changes');
const html = original.replace('<script src="runtime.js"></script>',
  '<script>window.__hyperframes={assetUrl:p=>p,registerFrameSource:()=>()=>{}};</script><script src="runtime.js"></script>');
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wav': 'audio/wav'};
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const candidate = path.resolve(buildRoot, '.' + decodeURIComponent(url.pathname));
    if (!candidate.startsWith(buildRoot + path.sep)) throw Error('outside build');
    const real = fs.realpathSync(candidate);
    if (!real.startsWith(buildRoot + path.sep) || !fs.statSync(real).isFile()) throw Error('outside build or non-file');
    res.setHeader('Content-Type', types[path.extname(real)] || 'application/octet-stream');
    fs.createReadStream(real).pipe(res);
  } catch { res.statusCode = 404; res.end(); }
});
function findChrome(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, f.name);
    if (f.isFile() && f.name === 'chrome-headless-shell') return p;
    if (f.isDirectory()) { const found = findChrome(p); if (found) return found; }
  }
}
const executablePath = process.env.CHROME_BIN || findChrome(path.join(os.homedir(), '.cache/hyperframes/chrome'));
assert.ok(executablePath, 'Run HyperFrames check to provision Chrome, or set CHROME_BIN.');
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const args = ['--disable-dev-shm-usage'];
  // Root-only fixture/container fallback; use sandboxed Chrome under an ordinary user.
  if (process.getuid?.() === 0 || process.env.HF_CHROME_NO_SANDBOX === '1') args.push('--no-sandbox');
  browser = await puppeteer.launch({executablePath, headless: true, args});
  const page = await browser.newPage();
  await page.setViewport({width: settings.width, height: settings.height, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'load'});
  const sampleFrames = new Set([0, frames - 1]);
  let start = 0;
  for (const s of settings.scenes) {
    sampleFrames.add(start + Math.floor(s.frames / 2));
    for (const f of [start - 1, start, start + 1]) if (f >= 0 && f < frames) sampleFrames.add(f);
    start += s.frames;
  }
  const samples = [...sampleFrames].sort((a, b) => a - b);
  const capture = async frame => {
    await page.evaluate(async f => { await Film.test.seek(f); }, frame);
    return createHash('sha256').update(await page.screenshot()).digest('hex');
  };
  const hashes = new Map();
  for (const frame of samples) hashes.set(frame, await capture(frame));
  for (const frame of [...samples].reverse()) assert.equal(await capture(frame), hashes.get(frame), `Reverse seek changed frame ${frame}`);
  // Fixed permutation, with every sample once and no render-time randomness.
  const shuffled = [...samples.filter((_, i) => i % 2), ...samples.filter((_, i) => !(i % 2))];
  for (const frame of shuffled) assert.equal(await capture(frame), hashes.get(frame), `Shuffled seek changed frame ${frame}`);
  assert.notEqual(await capture(0), await capture(Math.min(5, settings.scenes[0].frames - 1)), 'Known calibration motion is frozen; choose an animated interval after adapting the project');
  assert.deepEqual(errors, []);
  fs.mkdirSync('out', {recursive: true});
  fs.writeFileSync('out/seek-check.json', JSON.stringify({samples, reverseMatches: samples.length, shuffledMatches: samples.length, motionChanged: true, pageErrors: errors, browser: await browser.version()}, null, 2));
  console.log(`PASS: ${samples.length} reverse + shuffled exact-pixel matches, cut boundaries, motion sensitivity, no page errors.`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
