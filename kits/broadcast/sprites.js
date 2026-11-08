import {steppedFrame} from './timing.js';

export function layerPlacement(layer, anchors, delta = [0, 0], native = 32) {
  const anchor = anchors[layer.anchor];
  if (!anchor || ![...anchor, ...delta, layer.scale, ...(layer.offset || [0, 0])].every(Number.isFinite) || layer.scale <= 0) throw Error(`Invalid rig layer: ${layer.id}`);
  const side = Math.max(1, Math.round(native * layer.scale));
  const offset = layer.offset || [0, 0]; // Explicit native-pixel units.
  const d = layer.followFrame === false || layer.anchor === 'ground' ? [0, 0] : delta;
  return {x: Math.round(anchor[0] * native + offset[0] - side / 2) + d[0],
    y: Math.round(anchor[1] * native + offset[1] - side / 2) + d[1], side};
}

export function drawSprite(g, {sheet, clip, rig, overrides = {}, layers = [], images}, x, y, size, time, {flip = false} = {}) {
  const native = clip.native || 32;
  if (!Number.isInteger(native) || native < 1 || size <= 0 || size % native) throw Error('Sprite size must be a positive integer multiple of its native grid');
  const frame = steppedFrame(time, clip.fps, clip.frames, clip.slots || clip.frames);
  if (sheet.width < clip.frames * native || sheet.height < native) throw Error('Sprite strip is smaller than its manifest');
  const delta = clip.deltas?.[frame] || [0, 0];
  if (!delta.every(Number.isInteger)) throw Error('Anchor deltas must be native-grid integers');
  const anchors = {...rig, ...overrides};
  const sorted = [...layers].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
  if (sorted.some(layer => !Number.isFinite(layer.z))) throw Error('Layer z-order must be finite');
  const scale = size / native;
  const paint = layer => {
    const image = images[layer.id];
    if (!image) throw Error(`Missing cosmetic: ${layer.id}`);
    const at = layerPlacement(layer, anchors, delta, native);
    g.drawImage(image, at.x * scale, at.y * scale, at.side * scale, at.side * scale);
  };
  g.save();
  try {
    g.translate(Math.round(x + (flip ? size : 0)), Math.round(y));
    if (flip) g.scale(-1, 1);
    g.imageSmoothingEnabled = false;
    sorted.filter(layer => layer.z < 0).forEach(paint);
    g.drawImage(sheet, frame * native, 0, native, native, 0, 0, size, size);
    sorted.filter(layer => layer.z >= 0).forEach(paint);
  } finally { g.restore(); }
  return frame;
}
