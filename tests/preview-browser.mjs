// Real Chromium + upstream HyperFrames player, in the same opaque guest posture.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [project, chrome, htmlFile, output] = process.argv.slice(2);
const req = createRequire(project + '/package.json');
const {default: puppeteer} = await import(pathToFileURL(req.resolve('puppeteer-core')));
const browser = await puppeteer.launch({executablePath: chrome, headless: true,
  args: ['--enable-unsafe-swiftshader', '--disable-dev-shm-usage', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])]});
try {
  const page = await browser.newPage();
  await page.setViewport({width: 1000, height: 650, deviceScaleFactor: 1});
  const errors = [], messages = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') messages.push(m.text()); });
  const html = fs.readFileSync(htmlFile, 'utf8');
  await page.setContent('<html><body style="margin:0;background:#111"><iframe title="Film" sandbox="allow-scripts" style="width:960px;height:540px;border:0"></iframe><script>window.states=[];addEventListener("message",e=>{if(e.data?.channel==="hyperrizz-review")states.push(e.data)})</script></body></html>');
  await page.$eval('iframe', (el, html) => { el.src = 'data:text/html,' + encodeURIComponent(html); }, html);
  await page.waitForFunction(() => states.some(s => s.type === 'state' && s.ready), {timeout: 30000});
  const send = (type, extra = {}) => page.evaluate(({type, extra}) => document.querySelector('iframe').contentWindow.postMessage({channel:'hyperrizz-review',type,...extra},'*'), {type, extra});
  await send('seek', {time: .5});
  await page.waitForFunction(() => states.some(s => Math.abs(s.time-.5)<.04), {timeout:10000});
  const before = await page.screenshot();
  await send('seek', {time: 1.5});
  await page.waitForFunction(() => states.some(s => Math.abs(s.time-1.5)<.04), {timeout:10000});
  const after = await page.screenshot();
  assert.notDeepEqual(before, after, 'Scrubbing must paint different scenes');
  await send('play');
  await page.waitForFunction(() => states.some(s => s.paused===false), {timeout:5000});
  await send('pause');
  await send('seek', {time:.5});
  await page.waitForFunction(() => states.at(-1)?.paused && Math.abs(states.at(-1).time-.5)<.04);
  await page.screenshot({path:output});
  assert.deepEqual(errors, []);
  assert.deepEqual(messages, []);
  console.log(JSON.stringify({ok:true,seek:true,play:true,pause:true,opaqueOrigin:true,errors,messages}));
} finally { await browser.close(); }
