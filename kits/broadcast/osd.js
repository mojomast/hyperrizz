export function drawOSD(g, {width, height, frame, fps, channel, label = 'PLAY', recording = false}) {
  g.save();
  const margin = Math.round(width * 0.065), size = Math.max(13, Math.round(height * 0.03));
  g.font = `bold ${size}px monospace`;
  g.fillStyle = '#d8ffd4'; g.shadowColor = '#101610'; g.shadowOffsetX = 2; g.shadowOffsetY = 2;
  g.fillText(`CH ${String(channel).padStart(2, '0')}`, margin, margin);
  const seconds = Math.floor(frame / fps);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  g.textAlign = 'right';
  g.fillText(`${recording ? 'REC' : label}  /  FILM ${time}`, width - margin, margin);
  if (recording && Math.floor(frame / fps * 2) % 2 === 0) {
    g.shadowOffsetX = g.shadowOffsetY = 0; g.fillStyle = '#ff705e';
    g.fillRect(width - margin - size * 16, margin - size * 0.75, size * 0.6, size * 0.6);
  }
  g.restore();
}
