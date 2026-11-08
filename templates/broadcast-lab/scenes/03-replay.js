import {box, text, label} from '../shared/draw.js';
export function draw(g, t, e) {
  box(g, 0, 0, 960, 540, '#262c3d');
  text(g, e.copy.replayTitle, 58, 137, 55);
  label(g, t >= 2 ? 'INSTANT REPLAY / ¼ SPEED' : 'SOURCE PLAYBACK / 1×', 60, 171, '#f5ce70', 17);
  box(g, 55, 188, 554, 250, '#e5cda7');
  // The synthetic source is intentionally contained with no invented frame interpolation.
  g.drawImage(e.source, 119, 193, 426, 240);
  label(g, 'FFMPEG TEST SIGNAL', 72, 421, '#fff0cf', 14);
  box(g, 640, 188, 265, 250, '#463247');
  label(g, 'OUTPUT CLOCK', 661, 225, '#c6b4ab', 14);
  text(g, String(e.globalFrame).padStart(4, '0'), 661, 273, 48, '#fff0cf');
  label(g, 'SOURCE FRAME', 661, 320, '#c6b4ab', 14);
  text(g, String(e.sourceFrame).padStart(3, '0'), 661, 370, 48, '#f5ce70');
  if (t >= 2.2) {
    const amount = Math.min(1, (t - 2.2) / 0.7);
    g.strokeStyle = '#fff0a1'; g.lineWidth = 4; g.beginPath();
    g.ellipse(407, 301, 95, 66, -0.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * amount); g.stroke();
    g.beginPath(); g.moveTo(160, 290); g.lineTo(295, 275); g.lineTo(276, 263); g.moveTo(295, 275); g.lineTo(280, 293); g.stroke();
  }
  label(g, 'SEPARATE SOURCE TIME / AWAITED FRAME DECODE / BOUNDED CACHE', 60, 478, '#c6b4ab', 14);
}
