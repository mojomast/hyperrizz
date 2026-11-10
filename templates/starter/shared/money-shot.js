/**
 * Money shot: frame 0 is a finished hero, not a fade from black.
 *
 * The composition clock does not move. Music, narration and scene durations
 * stay on the frames the edit compiled. The opening picture is drawn at the
 * hero's settled local frame and held there until the real clock catches up.
 * When a later scene wins, that settled frame is a short picture-only cold
 * open. No frames are inserted and the soundtrack is not delayed.
 */

const ROLE_SCORE = {
  hero: 80,
  title: 48,
  feature: 36,
  stat: 36,
  chart: 34,
  proof: 34,
  split: 32,
  compare: 32,
  list: 26,
  code: 24,
  media: 12,
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function defaultEnv() {
  try {
    if (typeof process !== 'undefined' && process.env) return process.env;
  } catch { /* browser bundle has no process */ }
  return {};
}

/** Default on. `false`, or HYPERRIZZ_MONEY_SHOT=0|false|off|no, turns it off. `true` forces it on. */
export function moneyShotEnabled(value, env = defaultEnv()) {
  if (value === false) return false;
  if (value === true) return true;
  const flag = String(env?.HYPERRIZZ_MONEY_SHOT ?? '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return true;
}

function sceneRole(scene) {
  return text(scene?.role || scene?.type).toLowerCase();
}

function sceneFrames(scene) {
  const frames = Number(scene?.frames);
  return Number.isInteger(frames) && frames > 0 ? frames : 1;
}

/** Higher is a stronger thumbnail. An explicit hero outranks every other shot. */
export function scoreScene(scene, index = 0) {
  const role = sceneRole(scene);
  let score = ROLE_SCORE[role] ?? 12;
  const hook = text(scene?.hook) || text(scene?.title);
  if (hook) score += 28;
  if (scene?.plate || scene?.image || scene?.background) score += 16;
  if (Number.isFinite(scene?.weight)) score += Number(scene.weight);
  if (role === 'signoff' || role === 'outro') score -= 50;
  if ((role === 'media' || scene?.mediaOnly === true) && !hook) score -= 12;
  score += Math.max(0, 5 - index);
  return score;
}

/**
 * Local frame at which this scene looks finished. An explicit settle wins.
 * A marked hero/title/list/code with no settle uses a short entrance fallback.
 * Anything else stays on its authored first frame.
 */
export function settleFrameOf(scene, fps = 30) {
  const frames = sceneFrames(scene);
  const rate = fps > 0 ? fps : 30;
  if (Number.isInteger(scene?.settleFrame) && scene.settleFrame >= 0) return Math.min(scene.settleFrame, frames - 1);
  if (Number.isFinite(scene?.settle) && scene.settle >= 0) return Math.min(frames - 1, Math.max(0, Math.round(scene.settle * rate)));
  const role = sceneRole(scene);
  const marked = scene?.hero === true || role === 'title' || role === 'hero' || role === 'list' || role === 'code';
  if (!marked) return 0;
  const seconds = role === 'list' || role === 'code' ? 1 : 0.75;
  return Math.min(frames - 1, Math.max(0, Math.round(seconds * rate)));
}

function blank(reason, extra = {}) {
  return {
    enabled: false, sceneId: null, sceneIndex: null, hero: false, hook: '', score: 0,
    settleFrame: 0, openingSettle: 0, holdFrames: 0, coldOpen: false,
    shiftsAudio: false, insertedFrames: 0, audioStart: 0, reason, ...extra,
  };
}

/**
 * Pick the money shot. `moneyShot: false` or HYPERRIZZ_MONEY_SHOT=0 disables it.
 * The returned plan never changes duration or the audio start.
 */
export function selectMoneyShot(settings, options = {}) {
  const flag = options.moneyShot !== undefined ? options.moneyShot : settings?.moneyShot;
  if (!moneyShotEnabled(flag, options.env)) return blank('disabled');
  const scenes = Array.isArray(settings?.scenes) ? settings.scenes : [];
  if (scenes.length === 0) return blank('empty');
  const fps = Number(settings?.fps) > 0 ? Number(settings.fps) : 30;
  let best = null;
  scenes.forEach((scene, index) => {
    const score = scoreScene(scene, index);
    const settleFrame = settleFrameOf(scene, fps);
    const hero = scene?.hero === true;
    const better = !best || (hero !== best.hero
      ? hero
      : score > best.score || (score === best.score && index < best.index));
    if (better) {
      best = {
        scene, index, score, settleFrame, hero,
        hook: text(scene?.hook) || text(scene?.title),
      };
    }
  });
  const openingSettle = settleFrameOf(scenes[0], fps);
  const heroIsOpening = best.index === 0;
  let holdFrames = 0;
  if (!heroIsOpening) {
    const duration = sceneFrames(scenes[0]);
    const cap = Math.max(0, duration - 1);
    const wanted = Math.max(openingSettle, best.settleFrame, Math.min(12, cap));
    holdFrames = Math.max(0, Math.min(wanted, cap, Math.round(fps * 1.5)));
  }
  const enabled = openingSettle > 0 || holdFrames > 0;
  const chosen = {
    sceneId: best.scene?.id ?? null, sceneIndex: best.index, hero: best.hero, hook: best.hook, score: best.score,
    settleFrame: best.settleFrame, openingSettle, holdFrames, coldOpen: holdFrames > 0,
    shiftsAudio: false, insertedFrames: 0, audioStart: 0,
  };
  if (!enabled) return blank('already-settled', chosen);
  return {...chosen, enabled: true, reason: holdFrames > 0 ? 'cold-open' : 'opening-settled'};
}

/** Which picture to draw for one output frame. The output frame index is unchanged. */
export function pictureForFrame(plan, {sceneIndex, localFrame}) {
  const live = {sceneIndex, localFrame, held: false, coldOpen: false};
  if (!plan?.enabled || sceneIndex !== 0) return live;
  if (plan.coldOpen && localFrame < plan.holdFrames) {
    return {sceneIndex: plan.sceneIndex, localFrame: plan.settleFrame, held: true, coldOpen: true};
  }
  if (localFrame < plan.openingSettle) {
    return {sceneIndex: 0, localFrame: plan.openingSettle, held: true, coldOpen: false};
  }
  return live;
}
