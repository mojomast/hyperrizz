import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'scripts/create-broadcast-lab.mjs');
const temp = () => fs.mkdtempSync(path.join(fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir(), 'hyperrizz-materializer-'));
test('materializes a complete advanced project with the pinned starter dependencies', () => {
  const dir = temp(), output = path.join(dir, 'film');
  try {
    const result = spawnSync(process.execPath, [generator, output], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const pkg = JSON.parse(fs.readFileSync(path.join(output, 'package.json')));
    const lock = JSON.parse(fs.readFileSync(path.join(output, 'package-lock.json')));
    assert.equal(pkg.name, 'hyperrizz-broadcast-lab');
    assert.equal(lock.packages[''].name, pkg.name);
    assert.deepEqual(pkg.devDependencies, lock.packages[''].devDependencies);
    assert.ok(fs.existsSync(path.join(output, 'broadcast/LICENSE')));
    assert.ok(fs.existsSync(path.join(output, 'scripts/effect-check.mjs')));
    assert.equal(fs.readdirSync(path.join(output, 'scenes')).length, 4);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'settings.json'))).scenes.length, 4);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
test('refuses an existing destination without changing its content', () => {
  const dir = temp(), sentinel = path.join(dir, 'keep.txt');
  try {
    fs.writeFileSync(sentinel, 'user content');
    const result = spawnSync(process.execPath, [generator, dir]);
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'user content');
    assert.deepEqual(fs.readdirSync(dir), ['keep.txt']);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
test('refuses generation inside the installed source before creating directories', () => {
  const destination = path.join(root, '.materializer-must-not-exist', 'film');
  assert.equal(fs.existsSync(path.dirname(destination)), false);
  const result = spawnSync(process.execPath, [generator, destination]);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(path.dirname(destination)), false);
});
