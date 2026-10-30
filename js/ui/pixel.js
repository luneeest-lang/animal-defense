import { SPRITES, SPRITE_SIZE } from '../data/sprites.js';
import { TILES } from '../data/tiles.js';
import { ANIMAL_SPRITES } from '../data/animals.js';
import { MYTHIC_SPRITES } from '../data/mythicSprites.js';
import { DECOR_SPRITES } from '../data/decor.js';
import { refine } from './refine.js';

// 옛 원본 도트(16x16, 신화 20x20)는 구울 때 2배 해상도로 정교하게 다듬는다(ui/refine.js).
// 새로 그린 그림은 처음부터 2배 해상도(32x32, 신화 40x40)라 그대로 쓴다
export const ART_SCALE = 2;
export const ART_SIZE = SPRITE_SIZE * ART_SCALE;

// 동물·몬스터는 밝은 바깥 테두리(rim)로 배경 장식과 구분되게 한다
const RIM_ANIMAL = '#ffffffb8';
const RIM_ENEMY = '#fff4e078';

// 색 격자(색 문자열 또는 null)를 캔버스로 굽는다
function bakeGrid(grid) {
  const canvas = document.createElement('canvas');
  canvas.width = grid[0]?.length ?? ART_SIZE;
  canvas.height = grid.length || ART_SIZE;
  const ctx = canvas.getContext('2d');
  grid.forEach((row, y) => {
    row.forEach((c, x) => {
      if (c === null) return;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

// 처음부터 2배 해상도(32x32, 신화 40x40)로 그린 그림은 키우거나 테두리·명암을 다시 다듬지 않는다
// (그린 사람이 이미 넣었다). rim·grain·mute 같은 마무리만 한다
const isNative = (rows) => rows.length >= ART_SIZE;
const finish = (rows, opts = {}) => (isNative(rows) ? { ...opts, scale: false, outline: false, shade: false } : opts);
const bake = (palette, rows, opts) => bakeGrid(refine(palette, rows, finish(rows, opts)));

// 적 스프라이트: { 이름: [프레임 캔버스...] }
function bakeSpritesRaw() {
  const baked = {};
  for (const [name, def] of Object.entries(SPRITES)) {
    baked[name] = def.frames.map((rows) => bake(def.palette, rows, { rim: RIM_ENEMY }));
  }
  return baked;
}

// 피격 번쩍임용 하얀 실루엣: { 이름: [프레임 캔버스...] }
function bakeSilhouettesRaw() {
  const baked = {};
  for (const [name, def] of Object.entries(SPRITES)) {
    // 다듬은 그림과 같은 모양이 되도록, 다듬은 뒤 칠해진 곳을 모두 하얗게 한다
    baked[name] = def.frames.map((rows) => bakeGrid(refine(def.palette, rows, finish(rows)).map((row) => row.map((c) => (c ? '#ffffff' : null)))));
  }
  return baked;
}

// 맵 타일: { 이름: [무늬마다 [프레임 캔버스...]] }
function bakeTilesRaw() {
  const baked = {};
  for (const [name, def] of Object.entries(TILES)) {
    // 칸을 꽉 채우는 바닥은 고운 결만, 투명한 곳이 있는 물체(바위·나무·암초)는 테두리와 명암까지 다듬는다
    baked[name] = def.variants.map((frames, v) => frames.map((rows) => {
      const object = rows.some((row) => row.includes('.'));
      return bake(def.palette, rows, object ? {} : { outline: false, shade: false, grain: 0.22, seed: v, tile: true });
    }));
  }
  return baked;
}

// 동물 타워: { 이름: [레벨 0~3 캔버스] }
function bakeAnimalsRaw() {
  const baked = {};
  for (const [name, def] of Object.entries(ANIMAL_SPRITES)) {
    baked[name] = def.levels.map((rows) => bake(def.palette, rows, { rim: RIM_ANIMAL }));
  }
  return baked;
}

// 신화 동물: { id: 캔버스 }
function bakeMythicsRaw() {
  return Object.fromEntries(Object.entries(MYTHIC_SPRITES).map(([id, def]) => [id, bake(def.palette, def.rows, { rim: RIM_ANIMAL })]));
}

// 맵 장식: { 이름: 캔버스 }
function bakeDecorRaw() {
  // 장식은 색을 조금 차분하게 해서 배경으로 물러나게 한다
  return Object.fromEntries(Object.entries(DECOR_SPRITES).map(([id, def]) => [id, bake(def.palette, def.rows, { mute: 0.25 })]));
}

// 한 번 구운 그림은 다시 쓴다 (다듬기 계산이 있어 화면과 메뉴가 따로 구우면 시작이 느려진다)
const once = (make) => {
  let cached = null;
  return () => (cached ??= make());
};
export const bakeSprites = once(bakeSpritesRaw);
export const bakeSilhouettes = once(bakeSilhouettesRaw);
export const bakeTiles = once(bakeTilesRaw);
export const bakeAnimals = once(bakeAnimalsRaw);
export const bakeMythics = once(bakeMythicsRaw);
export const bakeDecor = once(bakeDecorRaw);
