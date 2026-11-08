import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {root, settings, duration} from './common.mjs';
process.chdir(root);
for (const key of ['width', 'height', 'fps', 'previewWidth']) assert.ok(Number.isInteger(settings[key]) && settings[key] > 0, key);
assert.ok(settings.scenes.length > 0);
assert.equal(new Set(settings.scenes.map(s => s.id)).size, settings.scenes.length);
for (const s of settings.scenes) {
  assert.match(s.id, /^[a-z][a-z0-9-]*$/);
  assert.ok(Number.isInteger(s.frames) && s.frames > 0);
}
for (const dir of ['.build', 'out', 'previews']) fs.mkdirSync(dir, {recursive: true});
if (fs.existsSync('assets')) fs.cpSync('assets', '.build/assets', {recursive: true});
if (settings.audio) {
  assert.match(settings.audio, /^assets\/[a-zA-Z0-9_./-]+$/);
  assert.ok(!settings.audio.split('/').includes('..') && fs.existsSync(settings.audio));
}
await build({entryPoints: ['shared/runtime.js'], bundle: true, format: 'iife', globalName: 'Film', outfile: '.build/runtime.js', target: 'chrome120'});
let start = 0;
const hosts = settings.scenes.map(s => {
  const seconds = s.frames / settings.fps;
  const markup = `<section id="${s.id}" class="scene" data-composition-id="${s.id}" data-start="${start / settings.fps}" data-duration="${seconds}" data-track-index="1" data-no-timeline style="width:${settings.width}px;height:${settings.height}px"><canvas width="${settings.width}" height="${settings.height}" data-layout-ignore></canvas></section>`;
  start += s.frames;
  return markup;
}).join('\n');
const audio = settings.audio ? `<audio id="soundtrack" class="clip" src="${settings.audio}" data-start="0" data-duration="${duration}" data-track-index="2"></audio>` : '';
const composition = `<main id="film" data-composition-id="film" data-start="0" data-duration="${duration}" data-width="${settings.width}" data-height="${settings.height}" data-fps="${settings.fps}" data-no-timeline style="width:${settings.width}px;height:${settings.height}px">${hosts}${audio}</main>`;
fs.writeFileSync('.build/index.html', fs.readFileSync('index.html', 'utf8').replace('<!-- COMPOSITION -->', composition));
fs.copyFileSync('style.css', '.build/style.css');
// Hash built content, settings and lockfile; generated output changes invalidate export evidence.
const hash = createHash('sha256');
function add(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'build.json') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) add(p);
    else if (entry.isFile()) hash.update(p).update(fs.readFileSync(p));
  }
}
add('.build');
hash.update(fs.readFileSync('settings.json')).update(fs.readFileSync('package-lock.json'));
fs.writeFileSync('.build/build.json', JSON.stringify({sha256: hash.digest('hex'), duration, frames: start}, null, 2));
console.log(`Built ${start} frames / ${duration}s / ${settings.width}x${settings.height}.`);
