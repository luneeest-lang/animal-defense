import { SPRITES, SPRITE_SIZE } from '../data/sprites.js';
import { TILES } from '../data/tiles.js';
import { ANIMAL_SPRITES } from '../data/animals.js';

// 문자 그림 한 장을 16x16 캔버스로 굽는다.
function bake(palette, rows) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

// 적 스프라이트: { 이름: [프레임 캔버스...] }
export function bakeSprites() {
  const baked = {};
  for (const [name, def] of Object.entries(SPRITES)) {
    baked[name] = def.frames.map((rows) => bake(def.palette, rows));
  }
  return baked;
}

// 맵 타일: { 이름: [무늬마다 [프레임 캔버스...]] }
export function bakeTiles() {
  const baked = {};
  for (const [name, def] of Object.entries(TILES)) {
    baked[name] = def.variants.map((frames) => frames.map((rows) => bake(def.palette, rows)));
  }
  return baked;
}

// 동물 타워: { 이름: [레벨 0~3 캔버스] }
export function bakeAnimals() {
  const baked = {};
  for (const [name, def] of Object.entries(ANIMAL_SPRITES)) {
    baked[name] = def.levels.map((rows) => bake(def.palette, rows));
  }
  return baked;
}
