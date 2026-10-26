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

test('동물 타워 도트는 아기, 청년, 성체, 각성 네 장이고 점점 커진다', async () => {
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
    // 아기, 청년, 성체는 모습이 다르고, 각성은 성체 그림에 오라를 화면에서 더한다
    assert.notDeepEqual(def.levels[0], def.levels[1], `${name} baby = youth`);
    assert.notDeepEqual(def.levels[1], def.levels[2], `${name} youth = adult`);
    assert.deepEqual(def.levels[3], def.levels[2], `${name} awakened should reuse the adult sprite`);
    const filled = (rows) => rows.join('').replace(/\./g, '').length;
    assert.ok(filled(def.levels[0]) < filled(def.levels[1]) && filled(def.levels[1]) < filled(def.levels[2]), `${name} should grow`);
  }
});

test('성장 단계 이름과 오라 색이 모든 타워에 정해져 있다', async () => {
  const { TOWERS, STAGE_NAMES, AURA_COLORS } = await import('../js/data/towers.js');
  assert.deepEqual(STAGE_NAMES, ['아기', '청년', '성체', '각성']);
  for (const id of Object.keys(TOWERS)) assert.match(AURA_COLORS[id], /^#[0-9a-f]{6}$/i, id);
});
