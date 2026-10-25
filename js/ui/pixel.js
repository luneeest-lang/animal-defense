import { SPRITES, SPRITE_SIZE } from '../data/sprites.js';

// 문자 그림을 프레임마다 16x16 캔버스로 한 번 구워 둔다.
export function bakeSprites() {
  const baked = {};
  for (const [name, def] of Object.entries(SPRITES)) {
    baked[name] = def.frames.map((rows) => {
      const canvas = document.createElement('canvas');
      canvas.width = SPRITE_SIZE;
      canvas.height = SPRITE_SIZE;
      const ctx = canvas.getContext('2d');
      rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          if (ch === '.') return;
          ctx.fillStyle = def.palette[ch];
          ctx.fillRect(x, y, 1, 1);
        });
      });
      return canvas;
    });
  }
  return baked;
}
