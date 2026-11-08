// Immutable local sequence; every caller must await get() before drawing.
export class FrameCache {
  constructor({prefix, frames, capacity = 12, assetUrl = p => p}) {
    if (!Number.isInteger(frames) || frames < 1 || !Number.isInteger(capacity) || capacity < 1) throw Error('Invalid frame cache bounds');
    this.prefix = prefix; this.frames = frames; this.capacity = capacity;
    this.assetUrl = assetUrl; this.entries = new Map(); this.closed = false;
  }
  async get(frame, signal) {
    if (this.closed) throw Error('Frame cache is disposed');
    if (!Number.isInteger(frame) || frame < 0 || frame >= this.frames) throw Error(`Missing source frame ${frame}`);
    if (signal?.aborted) throw new DOMException('Frame request cancelled', 'AbortError');
    let ready = this.entries.get(frame);
    if (ready) this.entries.delete(frame);
    else {
      ready = (async () => {
        const image = new Image();
        image.src = this.assetUrl(`${this.prefix}/${String(frame + 1).padStart(5, '0')}.jpg`);
        await image.decode();
        return image;
      })();
    }
    this.entries.set(frame, ready);
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value);
    let image;
    try { image = await ready; }
    catch (error) { if (this.entries.get(frame) === ready) this.entries.delete(frame); throw error; }
    if (signal?.aborted || this.closed) throw new DOMException('Frame request cancelled', 'AbortError');
    return image;
  }
  dispose() { this.closed = true; this.entries.clear(); }
}
