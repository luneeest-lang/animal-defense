import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { pathCells } from '../js/core/path.js';
import { createGame, emptyCells } from '../js/core/game.js';
import { decorFor, marginDecor } from '../js/ui/decor.js';
import { DECOR_SPRITES, DECOR_THEMES } from '../js/data/decor.js';

test('장식 그림: 테마마다 바닥 장식과 키 큰 장식이 있고 모두 16x16이다', () => {
  for (const theme of ['mountain', 'forest', 'sea']) {
    const set = DECOR_THEMES[theme];
    assert.ok(set.flat.length >= 2 && set.tall.length >= 2, theme);
    for (const name of [...set.flat, ...set.tall]) assert.ok(DECOR_SPRITES[name], name);
  }
  for (const [name, def] of Object.entries(DECOR_SPRITES)) {
    assert.equal(def.rows.length, 16, name);
    for (const row of def.rows) {
      assert.equal(row.length, 16, `${name}: ${row}`);
      for (const ch of row) assert.ok(ch === '.' || ch in def.palette, `${name} ${ch}`);
    }
  }
});

test('맵 안 장식: 길·막힌 칸에는 없고, 키 큰 장식은 동물이 소환될 수 있는 칸을 피한다', () => {
  for (const map of MAPS) {
    const list = decorFor(map);
    const path = pathCells(map);
    const blocked = new Set(map.blocked.map(([c, r]) => `${c},${r}`));
    const summonable = new Set(emptyCells(createGame(map)).map(([c, r]) => `${c},${r}`));
    assert.ok(list.length >= 12, `${map.id}: ${list.length}개는 너무 적다`);
    const seen = new Set();
    for (const d of list) {
      const key = `${d.c},${d.r}`;
      assert.ok(!path.has(key) && !blocked.has(key), `${map.id} ${key}`);
      assert.ok(!seen.has(key), '한 칸에 장식은 하나');
      seen.add(key);
      if (d.tall) assert.ok(!summonable.has(key), `${map.id} 키 큰 장식이 소환 칸 ${key}`);
      assert.ok(DECOR_THEMES[map.theme][d.tall ? 'tall' : 'flat'].includes(d.name), d.name);
      assert.ok(Math.abs(d.dx) <= 0.25 && Math.abs(d.dy) <= 0.25);
    }
    assert.ok(list.some((d) => d.tall) && list.some((d) => !d.tall), map.id);
  }
});

test('장식 배치는 늘 같다 (새로고침해도 그대로)', () => {
  assert.deepEqual(decorFor(MAPS[1]), decorFor(MAPS[1]));
  assert.deepEqual(marginDecor('forest', -3, 5), marginDecor('forest', -3, 5));
});

test('여백 장식: 테마에 맞는 장식이 적당히 흩어져 있다', () => {
  for (const theme of ['mountain', 'forest', 'sea']) {
    let n = 0;
    for (let i = -6; i < 0; i++) {
      for (let j = 0; j < 20; j++) {
        const d = marginDecor(theme, i, j);
        if (!d) continue;
        n++;
        assert.ok([...DECOR_THEMES[theme].flat, ...DECOR_THEMES[theme].tall, ...DECOR_THEMES[theme].big].includes(d.name), d.name);
      }
    }
    assert.ok(n > 120 * 0.2 && n < 120 * 0.6, `${theme}: ${n}/120`);
  }
});
