import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = process.argv[2];
if (!destination || process.argv.length !== 3) throw Error('Usage: node scripts/create-broadcast-lab.mjs /new/project/path');
const target = path.resolve(destination);
if (fs.existsSync(target)) throw Error('Destination exists; choose a new directory. Existing projects are never overwritten.');
const source = fs.realpathSync(root);
let existing = path.dirname(target);
const suffix = [];
while (!fs.existsSync(existing)) { suffix.unshift(path.basename(existing)); existing = path.dirname(existing); }
const parent = path.resolve(fs.realpathSync(existing), ...suffix);
if (parent === source || parent.startsWith(source + path.sep)) throw Error('Materialize outside the skill/repository directory.');
fs.mkdirSync(parent, {recursive: true});
fs.mkdirSync(target); // Exclusive directory creation also detects a competing writer.
const starter = path.join(root, 'templates/starter');
fs.cpSync(starter, target, {recursive: true, filter: file => path.relative(starter, file).split(path.sep)[0] !== 'scenes'});
fs.cpSync(path.join(root, 'templates/broadcast-lab'), target, {recursive: true});
fs.cpSync(path.join(root, 'kits/broadcast'), path.join(target, 'broadcast'), {recursive: true});
const packagePath = path.join(target, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath));
pkg.name = 'hyperrizz-broadcast-lab';
pkg.scripts.build = 'node scripts/prepare.mjs && node scripts/build.mjs';
pkg.scripts['seek-check'] = 'node scripts/effect-check.mjs';
pkg.scripts.stills = 'hyperframes snapshot .build --at 1.8,5.5,8.8,10.8,13.5,15.4 --no-end --output previews/keyframes';
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
const lockPath = path.join(target, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath));
lock.name = pkg.name; lock.packages[''].name = pkg.name;
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log(`Created broadcast lab at ${target}. Next: npm ci, npm run build, npm run check, npm run seek-check, npm run stills, npm run render.`);
