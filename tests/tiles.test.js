import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { TILES } from '../js/data/tiles.js';

test('맵은 초급(돌산), 중급(숲), 고급(바다) 순서이고 id는 그대로다', () => {
  assert.deepEqual(MAPS.map((m) => m.theme), ['mountain', 'forest', 'sea']);
  assert.deepEqual(MAPS.map((m) => m.name), ['초급', '중급', '고급']);
  assert.deepEqual(MAPS.map((m) => m.place), ['돌산', '숲', '바다']);
  assert.deepEqual(MAPS.map((m) => m.id), ['meadow', 'forest', 'canyon']);
});

test('돌산, 숲, 바다 테마에 필요한 타일이 모두 있다', () => {
  for (const name of ['mountainGround', 'mountainPath', 'mountainBoulder', 'forestGrass', 'forestPath', 'forestTree', 'seaWater', 'seaPlank', 'seaReef', 'seaRaft']) {
    assert.ok(TILES[name], `${name} missing`);
  }
  assert.equal(TILES.forestGrass.variants.length, 5);
  for (const frames of TILES.seaWater.variants) {
    assert.equal(frames.length, 2);
    assert.notDeepEqual(frames[0], frames[1], '물결 두 프레임이 같다');
  }
});

test('타일은 16x16(또는 새로 그린 32x32)이고 한 타일의 무늬·프레임 크기가 같으며 팔레트에 없는 글자를 쓰지 않는다', () => {
  for (const [name, def] of Object.entries(TILES)) {
    for (const color of Object.values(def.palette)) assert.match(color, /^#[0-9a-f]{6}$/i);
    assert.ok(def.variants.length > 0, `${name} variants`);
    const size = def.variants[0][0].length;
    assert.ok(size === 16 || size === 32, `${name} size ${size}`);
    for (const frames of def.variants) {
      assert.ok(frames.length > 0);
      for (const rows of frames) {
        assert.equal(rows.length, size, `${name} rows`);
        for (const row of rows) {
          assert.equal(row.length, size, `${name} width`);
          for (const ch of row) assert.ok(ch === '.' || ch in def.palette, `${name} unknown ${ch}`);
        }
      }
    }
  }
});

test('바닥 타일은 빈틈 없이 칸을 덮는다', () => {
  for (const name of ['mountainGround', 'mountainPath', 'forestGrass', 'forestPath', 'seaWater', 'seaPlank']) {
    for (const frames of TILES[name].variants) {
      for (const rows of frames) assert.ok(!rows.join('').includes('.'), `${name} has transparent pixels`);
    }
  }
});

test('맵이 어려울수록 몬스터 체력 배율이 크다 (초급 1, 중급 1.05, 고급 1.52)', () => {
  assert.deepEqual(MAPS.map((m) => m.hpMult), [1, 1.05, 1.52]);
});
