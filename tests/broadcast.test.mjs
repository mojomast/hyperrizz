import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFrame, steppedFrame, tuningBurst, collapseAmount} from '../kits/broadcast/timing.js';
import {layerPlacement, drawSprite} from '../kits/broadcast/sprites.js';

test('three source frames hold the third in a four-step loop, also in reverse', () => {
  const sample = t => steppedFrame(t, 6, 3, 4);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => sample(i / 6)), [0, 1, 2, 2, 0, 1]);
  assert.deepEqual([3, 2, 1, 0].map(i => sample(i / 6)), [2, 2, 1, 0]);
  assert.equal(sample(-1), 0);
  assert.throws(() => steppedFrame(0, 6, 0, 4));
});
test('quarter-speed replay has its own inpoint and a bounded terminal frame', () => {
  const map = t => sourceFrame(t, {fps: 60, frames: 240, offset: 0.5, rate: 0.25});
  assert.deepEqual([0, 1 / 60, 3 / 60, 4 / 60, 1, 2].map(map), [30, 30, 30, 31, 45, 60]);
  assert.equal(map(100), 239);
  assert.equal(sourceFrame(-10, {fps: 60, frames: 240}), 0);
  assert.throws(() => sourceFrame(NaN, {fps: 60, frames: 240}));
});
test('head follows frame anchors; ground does not; native offsets are explicit', () => {
  const anchors = {head: [0.5, 0.25], ground: [0.5, 0.75]};
  const layer = {id: 'hat', anchor: 'head', scale: 0.5, offset: [1, -2]};
  assert.deepEqual(layerPlacement(layer, anchors, [0, -1]), {x: 9, y: -3, side: 16});
  assert.deepEqual(layerPlacement({...layer, anchor: 'ground'}, anchors, [0, -1]), {x: 9, y: 14, side: 16});
  assert.throws(() => layerPlacement({...layer, anchor: 'missing'}, anchors));
});
test('cosmetic order and flip apply to a complete rig; fractional scale is rejected', () => {
  const calls = [], g = {save(){},restore(){},translate(...v){calls.push(['translate',...v]);},scale(...v){calls.push(['scale',...v]);},drawImage(image){calls.push(image.id);}};
  const fixture = {sheet: {id: 'body', width: 96, height: 32}, clip: {native: 32, frames: 3, slots: 4, fps: 6}, rig: {head: [0.5, 0.2]},
    layers: [{id: 'front', z: 2, anchor: 'head', scale: 1}, {id: 'back', z: -1, anchor: 'head', scale: 1}], images: {front: {id: 'front'}, back: {id: 'back'}}};
  drawSprite(g, fixture, 10, 20, 128, 0, {flip: true});
  assert.deepEqual(calls, [['translate',138,20],['scale',-1,1],'back','body','front']);
  assert.throws(() => drawSprite(g, fixture, 0, 0, 100, 0));
});
test('tuning and power-off are time-addressed envelopes with bounded endpoints', () => {
  assert.equal(tuningBurst(-0.1), 0); assert.equal(tuningBurst(0), 0.92);
  assert.equal(tuningBurst(0.22), 0); assert.equal(tuningBurst(1), 0);
  assert.equal(collapseAmount(0, 3.1, 0.85), 0); assert.equal(collapseAmount(4, 3.1, 0.85), 1);
  assert.ok(collapseAmount(3.5, 3.1, 0.85) > 0);
});
