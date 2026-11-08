export function draw(g, t, {copy, palette}) {
  g.fillStyle = palette.first;
  g.fillRect(40 + t * 400, 160, 80, 80);
  g.fillStyle = palette.text;
  g.font = 'bold 30px sans-serif';
  g.fillText(copy.first, 40, 120);
}
