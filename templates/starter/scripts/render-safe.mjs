import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {root, settings, hf, run, verify} from './common.mjs';
process.chdir(root);
fs.mkdirSync('out', {recursive: true});
fs.mkdirSync('previews', {recursive: true});
const lockRoot = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir();
const lockPaths = [path.join(root, 'out/render.lock'), process.env.HYPERFRAMES_RENDER_LOCK || path.join(lockRoot, 'hyperframes-production-render.lock')];
const owned = [];
function lowPriority(bin, args) {
  if (process.platform === 'linux') return run('nice', ['-n', '19', bin, ...args]);
  return run(bin, args);
}
try {
  for (const lock of lockPaths) {
    const fd = fs.openSync(lock, 'wx');
    owned.push({lock, fd});
    fs.writeFileSync(fd, JSON.stringify({pid: process.pid, project: root, started: new Date().toISOString()}));
  }
  const before = fs.readFileSync('.build/build.json', 'utf8');
  const args = ['render', '.build', '--fps', String(settings.fps), '--quality', 'draft', '--workers', '2', '--output', 'out/master-candidate.mp4'];
  if (process.platform === 'linux') {
    const allowed = fs.readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)[1];
    const cpus = allowed.split(',').flatMap(part => {
      const [lo, hi = lo] = part.split('-').map(Number);
      return Array.from({length: hi - lo + 1}, (_, i) => lo + i);
    }).slice(0, 2).join(',');
    lowPriority('taskset', ['-c', cpus, hf, ...args]);
  } else lowPriority(hf, args); // Non-Linux: check platform-specific encoder limits.
  const width = Math.min(settings.width, settings.previewWidth);
  const height = Math.round(settings.height * width / settings.width / 2) * 2;
  lowPriority('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-threads', '2', '-filter_threads', '2', '-filter_complex_threads', '2',
    '-i', 'out/master-candidate.mp4', '-vf', `scale=${width}:${height}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
    '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'previews/preview-candidate.mp4']);
  verify('out/master-candidate.mp4', settings.width, settings.height, 'out/master-verification.json');
  verify('previews/preview-candidate.mp4', width, height, 'out/preview-verification.json', settings.previewMaxBytes);
  if (fs.readFileSync('.build/build.json', 'utf8') !== before) throw new Error('Build changed during render; candidates retained, publication stopped.');
  fs.renameSync('out/master-candidate.mp4', 'out/master.mp4');
  fs.renameSync('previews/preview-candidate.mp4', 'previews/preview.mp4');
  fs.writeFileSync('out/render-build.json', before);
  console.log('Verified and published master + preview. Reports identify pre-rename candidate filenames and final file hashes.');
} finally {
  for (const {lock, fd} of owned.reverse()) { fs.closeSync(fd); fs.unlinkSync(lock); }
}
