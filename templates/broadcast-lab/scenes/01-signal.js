import {bars, box, text, label} from '../shared/draw.js';
export function draw(g, t, e) {
  bars(g, 0, 540);
  box(g, 44, 90, 872, 342, '#181522');
  const width = 540 * Math.min(1, t / 0.7);
  box(g, 480 - width / 2, 162, width, 4, '#cbeb9c');
  text(g, e.copy.signalTitle, 480, 255, 80, '#fff0cf', 'center');
  label(g, e.copy.signalSubtitle, 480, 302, '#cbeb9c', 19, 'center');
  const specs = ['CRT / VHS', 'PIXEL RIGS', 'SOURCE REPLAY'];
  specs.forEach((v, i) => { if (t >= 0.6 + i * 0.35) label(g, v, 215 + i * 265, 370, '#c6b4ab', 16, 'center'); });
  label(g, '60 FPS / FRAME-ADDRESSED / ORIGINAL SYNTHETIC CUES', 480, 470, '#181522', 14, 'center');
}
