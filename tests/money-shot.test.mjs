import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moneyShotEnabled, pictureForFrame, scoreScene, selectMoneyShot} from '../templates/starter/shared/money-shot.js';

const read = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));

test('explicit hero outranks a heavier later scene, and the clock does not move', () => {
  const plan = selectMoneyShot({
    fps: 30,
    scenes: [
      {id: 'open', frames: 90, role: 'title', hook: 'Open', hero: true, settleFrame: 18},
      {id: 'later', frames: 90, role: 'feature', hook: 'Later', weight: 5000, settleFrame: 40},
    ],
  });
  assert.equal(plan.enabled, true);
  assert.equal(plan.reason, 'opening-settled');
  assert.equal(plan.sceneId, 'open');
  assert.equal(plan.coldOpen, false);
  assert.equal(plan.holdFrames, 0);
  assert.equal(plan.openingSettle, 18);
  assert.equal(plan.settleFrame, 18);
  assert.equal(plan.hook, 'Open');
  assert.equal(plan.shiftsAudio, false);
  assert.equal(plan.insertedFrames, 0);
  assert.equal(plan.audioStart, 0);
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 0}), {sceneIndex: 0, localFrame: 18, held: true, coldOpen: false});
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 17}), {sceneIndex: 0, localFrame: 18, held: true, coldOpen: false});
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 18}), {sceneIndex: 0, localFrame: 18, held: false, coldOpen: false});
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 1, localFrame: 0}), {sceneIndex: 1, localFrame: 0, held: false, coldOpen: false});
});

test('a later hero is a picture-only cold open and then the opening settles', () => {
  const plan = selectMoneyShot({
    fps: 30,
    scenes: [
      {id: 'open', frames: 90, role: 'feature', settleFrame: 30},
      {id: 'hero', frames: 90, role: 'title', hook: 'Money shot', hero: true, settleFrame: 10},
    ],
  });
  assert.equal(plan.reason, 'cold-open');
  assert.equal(plan.sceneId, 'hero');
  assert.equal(plan.coldOpen, true);
  assert.equal(plan.holdFrames, 30);
  assert.equal(plan.openingSettle, 30);
  assert.equal(plan.shiftsAudio, false);
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 0}), {sceneIndex: 1, localFrame: 10, held: true, coldOpen: true});
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 29}), {sceneIndex: 1, localFrame: 10, held: true, coldOpen: true});
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 30}), {sceneIndex: 0, localFrame: 30, held: false, coldOpen: false});
});

test('cold open can be shorter than the opening settle hold', () => {
  const plan = {
    enabled: true, sceneIndex: 2, settleFrame: 8, openingSettle: 20, holdFrames: 12, coldOpen: true,
  };
  assert.equal(pictureForFrame(plan, {sceneIndex: 0, localFrame: 11}).coldOpen, true);
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 12}), {sceneIndex: 0, localFrame: 20, held: true, coldOpen: false});
  assert.equal(pictureForFrame(plan, {sceneIndex: 0, localFrame: 20}).held, false);
});

test('role and weight pick a title over a signoff, and an earlier tie stays earlier', () => {
  const plan = selectMoneyShot({
    fps: 30,
    scenes: [
      {id: 'card', frames: 60, role: 'title', hook: 'Hook', settleFrame: 12},
      {id: 'end', frames: 60, role: 'signoff', hook: 'Bye', settleFrame: 10},
      {id: 'plate', frames: 60, role: 'media', mediaOnly: true, settleFrame: 4},
    ],
  });
  assert.equal(plan.sceneId, 'card');
  assert.ok(scoreScene({role: 'signoff', hook: 'Bye'}, 1) < scoreScene({role: 'title', hook: 'Hook'}, 0));
  const tied = selectMoneyShot({
    fps: 30,
    scenes: [
      {id: 'first', frames: 30, role: 'title', settleFrame: 4},
      {id: 'second', frames: 30, role: 'title', weight: 1, settleFrame: 4},
    ],
  });
  assert.equal(tied.sceneId, 'first');
});

test('an unmarked opening that is already finished does not invent a hold', () => {
  const plan = selectMoneyShot({fps: 30, scenes: [{id: 'live', frames: 30}, {id: 'next', frames: 30}]});
  assert.equal(plan.enabled, false);
  assert.equal(plan.reason, 'already-settled');
  assert.deepEqual(pictureForFrame(plan, {sceneIndex: 0, localFrame: 0}), {sceneIndex: 0, localFrame: 0, held: false, coldOpen: false});
});

test('the switch defaults on and accepts the documented off values', () => {
  assert.equal(moneyShotEnabled(undefined, {}), true);
  assert.equal(moneyShotEnabled(undefined, {HYPERRIZZ_MONEY_SHOT: '0'}), false);
  for (const flag of ['false', 'off', 'no', 'OFF']) {
    assert.equal(selectMoneyShot({fps: 30, scenes: [{id: 'a', frames: 10, hero: true, settleFrame: 4}]}, {env: {HYPERRIZZ_MONEY_SHOT: flag}}).reason, 'disabled');
  }
  assert.equal(selectMoneyShot({fps: 30, moneyShot: false, scenes: [{id: 'a', frames: 10, hero: true, settleFrame: 4}]}).reason, 'disabled');
  assert.equal(selectMoneyShot({fps: 30, moneyShot: true, scenes: [{id: 'a', frames: 10, hero: true, settleFrame: 4}]}, {env: {HYPERRIZZ_MONEY_SHOT: '0'}}).enabled, true);
  assert.equal(selectMoneyShot({fps: 30, scenes: []}).reason, 'empty');
});

test('a marked hero without an explicit settle uses the entrance fallback', () => {
  const plan = selectMoneyShot({fps: 30, scenes: [{id: 'title', frames: 90, role: 'title', hero: true, hook: 'Hello'}]});
  assert.equal(plan.openingSettle, 23);
  assert.equal(plan.enabled, true);
});

test('bundled films open on their finished hook and keep audio at frame 0', () => {
  const starter = selectMoneyShot(read('../templates/starter/settings.json'));
  assert.equal(starter.sceneId, 'scene-01-sweep');
  assert.equal(starter.hook, 'Seek any frame.');
  assert.equal(starter.openingSettle, 18);
  assert.equal(starter.coldOpen, false);
  assert.equal(starter.shiftsAudio, false);
  assert.equal(starter.insertedFrames, 0);
  const lab = selectMoneyShot(read('../templates/broadcast-lab/settings.json'));
  assert.equal(lab.sceneId, 'scene-signal');
  assert.equal(lab.hook, 'AFTER HOURS.');
  assert.equal(lab.openingSettle, 108);
  assert.equal(lab.coldOpen, false);
  assert.equal(lab.shiftsAudio, false);
  assert.equal(lab.audioStart, 0);
  const build = fs.readFileSync(new URL('../templates/starter/scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /data-start="0"/);
});
