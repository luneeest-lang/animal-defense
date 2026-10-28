import { SPRITES, SPRITE_SIZE } from '../data/sprites.js';
import { TILES } from '../data/tiles.js';
import { ANIMAL_SPRITES } from '../data/animals.js';
import { MYTHIC_SPRITES } from '../data/mythicSprites.js';
import { DECOR_SPRITES } from '../data/decor.js';

// 문자 그림 한 장을 캔버스로 굽는다. 크기는 그림 크기를 따른다(보통 16x16, 신화 20x20).
function bake(palette, rows) {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0]?.length ?? SPRITE_SIZE;
  canvas.height = rows.length || SPRITE_SIZE;
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

// 피격 번쩍임용 하얀 실루엣: { 이름: [프레임 캔버스...] }
export function bakeSilhouettes() {
  const baked = {};
  for (const [name, def] of Object.entries(SPRITES)) {
    const white = Object.fromEntries(Object.keys(def.palette).map((k) => [k, '#ffffff']));
    baked[name] = def.frames.map((rows) => bake(white, rows));
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

// 신화 동물: { id: 캔버스 }
export function bakeMythics() {
  return Object.fromEntries(Object.entries(MYTHIC_SPRITES).map(([id, def]) => [id, bake(def.palette, def.rows)]));
}

// 맵 장식: { 이름: 캔버스 }
export function bakeDecor() {
  return Object.fromEntries(Object.entries(DECOR_SPRITES).map(([id, def]) => [id, bake(def.palette, def.rows)]));
}
