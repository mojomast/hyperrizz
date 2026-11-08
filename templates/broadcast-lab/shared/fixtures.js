// Original synthetic pixel fixtures: 32px, three source frames held over four slots.
function canvas(width = 32, height = 32) {
  const image = document.createElement('canvas'); image.width = width; image.height = height;
  return image;
}
export function fixtures() {
  const sheet = canvas(96, 32), g = sheet.getContext('2d');
  const deltas = [[0, 0], [0, -1], [0, 0]];
  for (let frame = 0; frame < 3; frame++) {
    const x = frame * 32, dy = deltas[frame][1];
    g.fillStyle = '#3d304b'; g.fillRect(x + 5, 28, 23, 3);
    g.fillStyle = '#75cbd4'; g.fillRect(x + 7, 10 + dy, 19, 18); g.fillRect(x + 4, 16 + dy, 25, 8);
    g.fillStyle = '#a9e9e0'; g.fillRect(x + 9, 10 + dy, 13, 4);
    g.fillStyle = '#181522'; g.fillRect(x + 10, 17 + dy, 3, frame === 2 ? 1 : 4); g.fillRect(x + 21, 17 + dy, 3, frame === 2 ? 1 : 4);
    g.fillStyle = '#ed8068'; g.fillRect(x + 14, 24 + dy, 6, 2);
  }
  const images = {halo: canvas(), crown: canvas(), scarf: canvas()};
  const halo = images.halo.getContext('2d'); halo.strokeStyle = '#b69bdb'; halo.lineWidth = 3; halo.strokeRect(2, 2, 28, 28);
  const crown = images.crown.getContext('2d'); crown.fillStyle = '#f5ce70'; crown.fillRect(1, 16, 30, 12); crown.fillRect(1, 5, 6, 17); crown.fillRect(13, 1, 6, 20); crown.fillRect(25, 5, 6, 17);
  const scarf = images.scarf.getContext('2d'); scarf.fillStyle = '#ed8068'; scarf.fillRect(1, 8, 30, 8); scarf.fillRect(20, 14, 8, 17);
  return {sheet, images, clip: {native: 32, frames: 3, slots: 4, fps: 6, deltas},
    rig: {head: [0.5, 0.28], chest: [0.5, 0.73], ground: [0.5, 0.55]},
    layers: [
      {id: 'halo', anchor: 'ground', offset: [0, 0], scale: 1.15, z: -1, followFrame: false},
      {id: 'crown', anchor: 'head', offset: [0, -2], scale: 0.55, z: 2},
      {id: 'scarf', anchor: 'chest', offset: [0, 1], scale: 0.65, z: 3},
    ]};
}
