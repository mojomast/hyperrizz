const finite = (...values) => values.every(Number.isFinite);
export const clamp = value => Math.max(0, Math.min(1, value));

// Pure source-frame mapping. Rate/offset belong to the source clock, not the OSD.
export function sourceFrame(time, {fps, frames, offset = 0, rate = 1}) {
  if (!finite(time, fps, frames, offset, rate) || fps <= 0 || !Number.isInteger(frames) || frames < 1) throw Error('Invalid source time map');
  return Math.min(frames - 1, Math.max(0, Math.floor((offset + time * rate) * fps + 1e-7)));
}

// A short original strip holds its last frame in the remaining authored slots.
export function steppedFrame(time, fps, frameCount, slots = frameCount) {
  if (!finite(time, fps) || fps <= 0 || !Number.isInteger(frameCount) || frameCount < 1 || !Number.isInteger(slots) || slots < frameCount) throw Error('Invalid stepped animation');
  return Math.min(frameCount - 1, Math.floor(Math.max(0, time) * fps + 1e-7) % slots);
}

export function tuningBurst(localTime, duration = 0.22, peak = 0.92) {
  if (!finite(localTime, duration, peak) || duration <= 0) throw Error('Invalid transition envelope');
  return localTime >= 0 && localTime < duration ? clamp(peak) * (1 - localTime / duration) : 0;
}

export function collapseAmount(time, start, duration) {
  if (!finite(time, start, duration) || duration <= 0) throw Error('Invalid collapse envelope');
  const t = clamp((time - start) / duration);
  return t * t * (3 - 2 * t);
}
