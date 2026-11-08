import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {root, settings, run} from './common.mjs';
process.chdir(root);
for (const dir of ['assets', '.cache']) fs.mkdirSync(dir, {recursive: true});
const stamp = createHash('sha256').update(fs.readFileSync('scripts/prepare.mjs')).update(fs.readFileSync('scripts/sound.py')).update(JSON.stringify(settings)).digest('hex');
const marker = '.cache/broadcast-fixture-stamp';
const ready = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === stamp &&
  fs.existsSync('assets/broadcast.wav') && fs.existsSync('assets/replay-frames') &&
  Array.from({length: settings.sourceFrames}, (_, i) => `assets/replay-frames/${String(i + 1).padStart(5, '0')}.jpg`).every(f => fs.existsSync(f));
const low = (bin, args) => process.platform === 'linux' ? run('nice', ['-n', '19', bin, ...args]) : run(bin, args);
if (!ready) {
  const seconds = settings.sourceFrames / settings.sourceFps;
  const flags = ['-y', '-v', 'error', '-nostdin', '-threads', '2', '-filter_threads', '2', '-filter_complex_threads', '2'];
  low('ffmpeg', [...flags, '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=${settings.sourceFps}:duration=${seconds}`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '2', '.cache/replay-source.mp4']);
  // This one directory is explicitly owned by this synthetic-fixture generator.
  fs.rmSync('assets/replay-frames', {recursive: true, force: true});
  fs.mkdirSync('assets/replay-frames');
  low('ffmpeg', [...flags, '-i', '.cache/replay-source.mp4', '-vf', `fps=${settings.sourceFps}`, '-frames:v', String(settings.sourceFrames), '-q:v', '2', '-threads', '2', 'assets/replay-frames/%05d.jpg']);
  low('python3', ['scripts/sound.py']);
  fs.writeFileSync(marker, stamp);
}
const files = ['.cache/replay-source.mp4', 'assets/broadcast.wav', ...fs.readdirSync('assets/replay-frames').filter(n => n.endsWith('.jpg')).sort().map(n => `assets/replay-frames/${n}`)];
const manifest = {provenance: 'Generated FFmpeg testsrc2 + original synthesized sound cues; no game footage', sourceFps: settings.sourceFps, sourceFrames: settings.sourceFrames,
  files: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
fs.writeFileSync('assets/fixture-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Prepared ${settings.sourceFrames} immutable 60fps source frames and broadcast sound cues.`);
