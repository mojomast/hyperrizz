import settings from '../settings.json';
import copy from '../copy.json';
import palette from '../palette.json';
import {pictureForFrame, selectMoneyShot} from './money-shot.js';
import * as sweep from '../scenes/01-sweep.js';
import * as orbit from '../scenes/02-orbit.js';

const scenes = [sweep, orbit];
const mounts = [];
const ready = () => document.fonts.ready; // Add document.fonts.load() for bundled fonts.
function runtimeEnv() {
  const flag = globalThis.__HYPERRIZZ_MONEY_SHOT__;
  return flag == null || flag === '' ? {} : {HYPERRIZZ_MONEY_SHOT: String(flag)};
}
const plan = selectMoneyShot(settings, {env: runtimeEnv()});
function describedPicture(frame) {
  let index = 0;
  let cursor = 0;
  for (const scene of settings.scenes) {
    if (frame < cursor + scene.frames) return pictureForFrame(plan, {sceneIndex: index, localFrame: frame - cursor});
    cursor += scene.frames;
    index += 1;
  }
  throw new Error(`Frame outside composition: ${frame}`);
}
export function mount() {
  let start = 0;
  settings.scenes.forEach((scene, index) => {
    const element = document.getElementById(scene.id);
    const canvas = element.querySelector('canvas');
    const g = canvas.getContext('2d', {alpha: false});
    const startFrame = start;
    start += scene.frames;
    const render = async (sourceTime, signal) => {
      await ready();
      if (signal?.aborted) return;
      const frame = Math.max(0, Math.min(scene.frames - 1, Math.round(sourceTime * settings.fps)));
      const picture = pictureForFrame(plan, {sceneIndex: index, localFrame: frame});
      g.resetTransform();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = palette.ink;
      g.fillRect(0, 0, canvas.width, canvas.height);
      // Calibration coordinates scale with output. Redesign for a real film.
      g.save();
      g.scale(settings.width / 640, settings.height / 360);
      g.fillStyle = palette.text;
      g.font = '13px sans-serif';
      g.fillText(copy.label, 40, 45);
      scenes[picture.sceneIndex].draw(g, picture.localFrame / settings.fps, {settings, copy, palette});
      g.restore();
      return picture;
    };
    mounts.push({element, render, startFrame, endFrame: start, canvas});
    window.__hyperframes.registerFrameSource({element, ready: ready(), render, dispose() {}});
  });
}

// The test hook uses the production renderer. Only visibility is emulated here.
export const test = {
  moneyShot: plan,
  picture: describedPicture,
  async seek(frame) {
    const selected = mounts.find(m => frame >= m.startFrame && frame < m.endFrame);
    if (!selected) throw new Error(`Frame outside composition: ${frame}`);
    for (const m of mounts) m.element.style.visibility = m === selected ? 'visible' : 'hidden';
    return selected.render((frame - selected.startFrame) / settings.fps);
  },
};
