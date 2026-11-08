import {drawSprite} from '../broadcast/sprites.js';
import {box, text, label, ticker} from '../shared/draw.js';
export function draw(g, t, e) {
  box(g, 0, 0, 960, 540, '#382b46');
  for (let i = 0; i < 12; i++) box(g, i * 100 - (t * 22) % 100, 90, 2, 340, '#533b58');
  text(g, e.copy.wardrobeTitle, 60, 136, 56);
  label(g, e.copy.wardrobeSubtitle, 63, 166, '#e7c788', 15);
  box(g, 60, 195, 350, 235, '#1d1c30'); box(g, 435, 195, 465, 235, '#67415e');
  drawSprite(g, {...e.sprite, layers: []}, 115, 206, 192, t);
  const count = t < 1 ? 1 : t < 2.1 ? 2 : 3;
  drawSprite(g, {...e.sprite, layers: e.sprite.layers.slice(0, count), overrides: {head: [0.52, 0.28]}}, 525, 206, 192, t, {flip: true});
  label(g, 'BASE / 32PX × 6', 85, 417, '#cbeb9c', 14);
  label(g, `${count} LAYERS / MIRRORED`, 465, 417, '#fff0cf', 14);
  for (let i = 0; i < count; i++) label(g, ['BACK','HEAD','FRONT'][i], 768, 263 + i * 45, '#f5ce70', 15);
  ticker(g, 'NATIVE GRID  •  FRAME ANCHORS  •  Z-ORDER  •  THREE FRAMES / FOUR STEPS', t);
}
