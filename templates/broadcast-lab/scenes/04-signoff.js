import {drawSprite} from '../broadcast/sprites.js';
import {box, text, label} from '../shared/draw.js';
export function draw(g, t, e) {
  box(g, 0, 0, 960, 540, '#30213b');
  for (let i = 0; i < 13; i++) { g.strokeStyle = '#603d5b'; g.lineWidth = 2; g.beginPath(); g.moveTo(480, 285); g.lineTo(-300 + i * 130, 540); g.stroke(); }
  text(g, e.copy.signoffTitle, 480, 160, 58, '#fff0cf', 'center');
  text(g, e.copy.signoffSecond, 480, 221, 58, '#cbeb9c', 'center');
  [112, 304, 496, 688].forEach((x, i) => drawSprite(g, e.sprite, x, 261, 128, t + i / 6, {flip: i % 2 === 1}));
  box(g, 120, 417, 720, 55, '#e9c88e');
  label(g, e.copy.repo, 480, 451, '#30213b', 21, 'center');
}
