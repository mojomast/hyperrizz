import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {moneyShotEnabled} from '../shared/money-shot.js';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const settings = JSON.parse(fs.readFileSync(path.join(root, 'settings.json'), 'utf8'));
export const frames = settings.scenes.reduce((n, s) => n + s.frames, 0);
export const duration = frames / settings.fps;
export const hf = path.join(root, 'node_modules', '.bin', 'hyperframes');
export function run(bin, args, options = {}) {
  return execFileSync(bin, args, {cwd: root, stdio: 'inherit', ...options});
}
export function verify(file, width, height, report, maxBytes) {
  const args = ['scripts/verify-media.py', file, '--width', String(width), '--height', String(height),
    '--fps', String(settings.fps), '--duration', String(duration), '--audio', settings.audio ? 'required' : 'forbidden', '--report', report];
  if (maxBytes) args.push('--max-bytes', String(maxBytes));
  if (settings.audio && settings.targetLufs !== undefined) args.push('--target-lufs', String(settings.targetLufs));
  if (settings.audio && settings.maxTruePeak !== undefined) args.push('--max-true-peak', String(settings.maxTruePeak));
  if (!moneyShotEnabled(settings.moneyShot)) args.push('--money-shot', 'off');
  if (process.platform === 'linux') run('nice', ['-n', '19', 'python3', ...args]);
  else run('python3', args);
}
