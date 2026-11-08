export function box(g, x, y, w, h, color) { g.fillStyle = color; g.fillRect(x, y, w, h); }
export function text(g, value, x, y, size = 24, color = '#fff0cf', align = 'left') {
  g.fillStyle = color; g.font = `900 ${size}px sans-serif`; g.textAlign = align; g.fillText(value, x, y);
}
export function label(g, value, x, y, color = '#c6b4ab', size = 13, align = 'left') {
  g.fillStyle = color; g.font = `bold ${size}px monospace`; g.textAlign = align; g.fillText(value, x, y);
}
export function bars(g, y, height) {
  ['#e0d4b7','#d8bc62','#6fc8c5','#7bab74','#b78cae','#c5726d','#7388b2'].forEach((c, i) => box(g, i * 960 / 7, y, Math.ceil(960 / 7), height, c));
}
export function ticker(g, value, t) {
  box(g, 44, 455, 872, 34, '#e9c88e');
  g.save(); g.beginPath(); g.rect(54, 455, 852, 34); g.clip();
  g.font = 'bold 15px monospace';
  const width = g.measureText(value).width + 65, offset = (t * 65) % width;
  for (let i = -1; i < 4; i++) label(g, value, 64 + i * width - offset, 478, '#241a2c', 15);
  g.restore();
}
