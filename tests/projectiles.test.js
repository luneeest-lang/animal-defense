import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTILES, PROJECTILE_SIZE } from '../js/data/projectiles.js';
import { TOWERS } from '../js/data/towers.js';

test('다섯 동물 모두 발사체 도트 그림이 있고 크기·팔레트가 맞다', () => {
  for (const id of Object.keys(TOWERS)) {
    const d = PROJECTILES[id];
    assert.ok(d, id);
    assert.equal(d.rows.length, PROJECTILE_SIZE, id);
    for (const row of d.rows) {
      assert.equal(row.length, PROJECTILE_SIZE, `${id}: ${row}`);
      for (const ch of row) assert.ok(ch === '.' || ch in d.palette, `${id} ${ch}`);
    }
    assert.ok(['spin', 'aim', 'none'].includes(d.turn), `${id} turn`);
  }
});
