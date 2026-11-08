export function draw(g, t, {copy, palette}) {
  g.fillStyle = palette.second;
  g.beginPath();
  g.arc(320 + Math.sin(t * Math.PI * 2) * 140, 210, 28, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = palette.text;
  g.font = 'bold 30px sans-serif';
  g.fillText(copy.second, 40, 120);
}
