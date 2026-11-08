import settings from '../settings.json';
import copy from '../copy.json';
import palette from '../palette.json';
import {createCRT} from '../broadcast/crt.js';
import {FrameCache} from '../broadcast/frames.js';
import {sourceFrame, tuningBurst, collapseAmount} from '../broadcast/timing.js';
import {drawOSD} from '../broadcast/osd.js';
import {fixtures} from './fixtures.js';
import {label} from './draw.js';
import * as signal from '../scenes/01-signal.js';
import * as wardrobe from '../scenes/02-wardrobe.js';
import * as replay from '../scenes/03-replay.js';
import * as signoff from '../scenes/04-signoff.js';

const scenes = [signal, wardrobe, replay, signoff], mounts = [];
let assets;
function initialize() { return assets ??= document.fonts.ready.then(() => fixtures()); }
const assetUrl = p => window.__hyperframes.assetUrl ? window.__hyperframes.assetUrl(p) : p;
export function mount() {
  let start = 0;
  settings.scenes.forEach((scene, index) => {
    const element = document.getElementById(scene.id), canvas = element.querySelector('canvas');
    const source = document.createElement('canvas'); source.width = settings.width; source.height = settings.height;
    const g = source.getContext('2d', {alpha: false});
    const crt = createCRT(canvas, source, settings);
    const cache = index === 2 ? new FrameCache({prefix: 'assets/replay-frames', frames: settings.sourceFrames, capacity: 12, assetUrl}) : null;
    const startFrame = start; start += scene.frames;
    const render = async (sourceTime, abort, overrides = {}) => {
      const sprite = await initialize();
      if (abort?.aborted) return;
      const frame = Math.max(0, Math.min(scene.frames - 1, Math.round(sourceTime * settings.fps)));
      const time = frame / settings.fps, globalFrame = startFrame + frame;
      const env = {settings, copy, palette, sprite, globalFrame};
      if (cache) {
        // Replay starts at scene 2s, referring back to source 0.5s at quarter speed.
        env.sourceFrame = sourceFrame(time < 2 ? time : time - 2, {fps: settings.sourceFps, frames: settings.sourceFrames, offset: time < 2 ? 0 : 0.5, rate: time < 2 ? 1 : 0.25});
        env.source = await cache.get(env.sourceFrame, abort);
      }
      if (abort?.aborted) return;
      g.resetTransform(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = palette.ink; g.fillRect(0, 0, source.width, source.height);
      g.save();
      try {
        g.scale(settings.width / 960, settings.height / 540);
        g.imageSmoothingEnabled = false;
        scenes[index].draw(g, time, env);
        label(g, copy.provenance, 480, 516, '#fff0cf', 12, 'center');
      } finally { g.restore(); }
      drawOSD(g, {width: settings.width, height: settings.height, frame: globalFrame, fps: settings.fps, channel: index + 1, recording: index === 1});
      const collapse = index === 3 ? collapseAmount(time, 3.1, 0.85) : 0;
      const burst = index ? tuningBurst(time) : 0;
      crt.draw({frame: globalFrame, intensity: overrides.intensity ?? settings.effectIntensity,
        burst: overrides.burst ?? burst, collapse: overrides.collapse ?? collapse});
      return {frame: globalFrame, sourceFrame: env.sourceFrame ?? null, cacheEntries: cache?.entries.size || 0};
    };
    mounts.push({element, render, startFrame, endFrame: start, canvas, source, cache});
    window.__hyperframes.registerFrameSource({element, ready: initialize(), render, dispose() { cache?.dispose(); crt.dispose(); }});
  });
}

export const test = {
  async seek(frame, overrides = {}) {
    const selected = mounts.find(m => frame >= m.startFrame && frame < m.endFrame);
    if (!selected) throw Error(`Frame outside composition: ${frame}`);
    for (const m of mounts) m.element.style.visibility = m === selected ? 'visible' : 'hidden';
    return selected.render((frame - selected.startFrame) / settings.fps, undefined, overrides);
  },
  sourcePixels(frame) {
    const m = mounts.find(m => frame >= m.startFrame && frame < m.endFrame);
    return Array.from(m.source.getContext('2d').getImageData(0, 0, m.source.width, m.source.height).data);
  },
  outputPixels(frame) {
    const m = mounts.find(m => frame >= m.startFrame && frame < m.endFrame);
    const image = document.createElement('canvas'); image.width = m.canvas.width; image.height = m.canvas.height;
    const ctx = image.getContext('2d'); ctx.drawImage(m.canvas, 0, 0);
    return Array.from(ctx.getImageData(0, 0, image.width, image.height).data);
  },
  async invalidFrame() { return mounts[2].cache.get(settings.sourceFrames); },
  async abortedFrame() { const a = new AbortController(); a.abort(); return mounts[2].cache.get(0, a.signal); },
};
