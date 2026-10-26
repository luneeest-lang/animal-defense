import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../js/data/enemies.js';
import { SPRITES, SPRITE_SIZE, ENEMY_LOOK } from '../js/data/sprites.js';

test('모든 적 종류에 그림과 크기가 정해져 있다', () => {
  for (const type of Object.keys(ENEMIES)) {
    const look = ENEMY_LOOK[type];
    assert.ok(look, `${type} look missing`);
    assert.ok(SPRITES[look.sprite], `${type} sprite ${look.sprite} missing`);
    assert.ok(look.size > 0 && look.size <= 2, `${type} size ${look.size}`);
  }
});

test('스프라이트는 16x16 프레임 2개이고 팔레트에 없는 글자를 쓰지 않는다', () => {
  assert.equal(SPRITE_SIZE, 16);
  for (const [name, def] of Object.entries(SPRITES)) {
    for (const [ch, color] of Object.entries(def.palette)) {
      assert.equal(ch.length, 1, `${name} palette key ${ch}`);
      assert.match(color, /^#[0-9a-f]{6}$/i, `${name} color ${color}`);
    }
    assert.equal(def.frames.length, 2, `${name} frames`);
    for (const rows of def.frames) {
      assert.equal(rows.length, SPRITE_SIZE, `${name} rows`);
      for (const row of rows) {
        assert.equal(row.length, SPRITE_SIZE, `${name} row width: ${row}`);
        for (const ch of row) assert.ok(ch === '.' || ch in def.palette, `${name} unknown char ${ch}`);
      }
    }
  }
});

test('두 프레임은 서로 다르고 그림이 비어 있지 않다', () => {
  for (const [name, def] of Object.entries(SPRITES)) {
    const [a, b] = def.frames;
    assert.notDeepEqual(a, b, `${name} frames identical`);
    assert.ok(a.join('').replace(/\./g, '').length > 30, `${name} nearly empty`);
  }
});

test('동물 타워 도트는 타워마다 레벨 0~3 네 장이고 형식이 맞다', async () => {
  const { ANIMAL_SPRITES } = await import('../js/data/animals.js');
  const { TOWERS } = await import('../js/data/towers.js');
  assert.deepEqual(Object.keys(ANIMAL_SPRITES).sort(), Object.keys(TOWERS).sort());
  for (const [name, def] of Object.entries(ANIMAL_SPRITES)) {
    assert.equal(def.levels.length, 4, `${name} levels`);
    for (const rows of def.levels) {
      assert.equal(rows.length, SPRITE_SIZE);
      for (const row of rows) {
        assert.equal(row.length, SPRITE_SIZE, `${name} width`);
        for (const ch of row) assert.ok(ch === '.' || ch in def.palette, `${name} unknown ${ch}`);
      }
    }
    for (let i = 1; i < 4; i++) assert.notDeepEqual(def.levels[i], def.levels[i - 1], `${name} level ${i} looks the same`);
  }
});
