import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {root, settings} from './common.mjs';
process.chdir(root);
const build = fs.realpathSync('.build');
const entry = fs.readFileSync('.build/index.html', 'utf8');
assert.ok(entry.includes('<script src="runtime.js"></script>'));
const html = entry.replace('<script src="runtime.js"></script>', '<script>window.__hyperframes={assetUrl:p=>p,registerFrameSource:()=>()=>{}};</script><script src="runtime.js"></script>');
const server = http.createServer((req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    const file = fs.realpathSync(path.resolve(build, '.' + decodeURIComponent(pathname)));
    if (!file.startsWith(build + path.sep) || !fs.statSync(file).isFile()) throw Error('Invalid asset');
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.wav':'audio/wav','.json':'application/json'})[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch { res.statusCode = 404; res.end(); }
});
function chrome(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, f.name);
    if (f.isFile() && f.name === 'chrome-headless-shell') return p;
    if (f.isDirectory()) { const found = chrome(p); if (found) return found; }
  }
}
let browser;
try {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const args = ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader'];
  if (process.getuid?.() === 0 || process.env.HF_CHROME_NO_SANDBOX === '1') args.push('--no-sandbox');
  const executablePath = process.env.CHROME_BIN || chrome(path.join(os.homedir(), '.cache/hyperframes/chrome'));
  assert.ok(executablePath, 'Run HyperFrames check first to provision Chrome, or set CHROME_BIN.');
  browser = await puppeteer.launch({executablePath, headless: true, args});
  const page = await browser.newPage();
  await page.setViewport({width: settings.width, height: settings.height, deviceScaleFactor: 1});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'load'});
  const capture = async (frame, controls = {}) => {
    await page.evaluate(async ({frame, controls}) => Film.test.seek(frame, controls), {frame, controls});
    return createHash('sha256').update(await page.screenshot()).digest('hex');
  };
  const samples = [0,5,108,239,240,241,330,479,480,481,528,599,600,601,648,719,720,721,810,930,959];
  const expected = new Map();
  for (const frame of samples) expected.set(frame, await capture(frame));
  for (const frame of [...samples].reverse()) assert.equal(await capture(frame), expected.get(frame), `Reverse frame ${frame}`);
  for (const frame of [...samples.filter((_, i) => i % 2), ...samples.filter((_, i) => !(i % 2))]) assert.equal(await capture(frame), expected.get(frame), `Shuffled frame ${frame}`);
  assert.notEqual(expected.get(0), expected.get(5), 'Motion frozen');
  const clean = await capture(330, {intensity: 0, burst: 0, collapse: 0});
  assert.notEqual(clean, expected.get(330), 'Intensity control does not affect pixels');
  assert.notEqual(await capture(330, {intensity: 1}), expected.get(330), 'Maximum intensity does not affect pixels');
  await capture(330, {intensity: 0, burst: 0, collapse: 0});
  const cleanDiff = await page.evaluate(() => {
    const a = Film.test.sourcePixels(330), b = Film.test.outputPixels(330);
    let maximum = 0, changed = 0;
    for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); if (delta) changed++; maximum = Math.max(maximum, delta); }
    return {maximum, changed};
  });
  assert.equal(cleanDiff.maximum, 0, 'Clean bypass changes source pixels or orientation');
  assert.notEqual(await capture(241, {burst: 0}), expected.get(241), 'Tuning burst missing');
  assert.notEqual(await capture(930, {collapse: 0}), expected.get(930), 'Power-off collapse missing');
  const sourceFrames = [];
  for (const frame of [600,601,603,604,648]) sourceFrames.push((await page.evaluate(async f => Film.test.seek(f), frame)).sourceFrame);
  assert.deepEqual(sourceFrames, [30,30,30,31,42], 'Quarter-speed source mapping drifted');
  let state;
  for (let frame = 480; frame < 500; frame++) state = await page.evaluate(async f => Film.test.seek(f), frame);
  assert.equal(state.cacheEntries, 12, 'Cache exceeded its bound or failed to fill');
  assert.equal(await capture(528), expected.get(528), 'Re-decode after eviction changes pixels');
  assert.equal(await page.evaluate(async () => { try { await Film.test.invalidFrame(); return false; } catch { return true; } }), true);
  assert.equal(await page.evaluate(async () => { try { await Film.test.abortedFrame(); return false; } catch (e) { return e.name === 'AbortError'; } }), true);
  assert.deepEqual(errors, []);
  const report = {samples, reverseMatches: samples.length, shuffledMatches: samples.length, motionChanged: true,
    cleanBypass: cleanDiff, intensityLevelsDistinct: true, tuningChanged: true, collapseChanged: true,
    quarterSpeedSourceFrames: sourceFrames, cacheEntries: state.cacheEntries, rejectedMissingFrame: true, respectedAbort: true,
    pageErrors: errors, browser: await browser.version()};
  fs.mkdirSync('out', {recursive: true});
  fs.writeFileSync('out/seek-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
