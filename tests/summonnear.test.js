import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { createGame, addTower, summonTower, emptyCells } from '../js/core/game.js';

// 같은 종류·같은 단계 동물이 있으면 그 옆 빈칸에 소환해 합치기 쉽게 한다
const dist = (a, b) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

test('같은 아기 동물이 있으면 가장 가까운 빈칸에 소환된다', () => {
  for (const map of MAPS) {
    const g = createGame(map);
    g.gold = 1e6;
    const cells = emptyCells(g);
    const [c, r] = cells[Math.floor(cells.length / 2)];
    const first = addTower(g, 'squirrel', c, r);
    const near = Math.min(...emptyCells(g).map(([cc, rr]) => dist({ col: cc, row: rr }, first)));
    const t = summonTower(g, () => 0); // 0이면 첫 종류(다람쥐)
    assert.equal(t.type, 'squirrel');
    assert.equal(dist(t, first), near, map.id);
  }
});

test('짝이 없으면(다른 종류이거나 단계가 다르면) 예전처럼 아무 빈칸에나 소환된다', () => {
  const g = createGame(MAPS[0]);
  g.gold = 1e6;
  const cells = emptyCells(g);
  addTower(g, 'elephant', ...cells[0]);
  addTower(g, 'squirrel', ...cells[1], 1);
  const seen = new Set();
  let k = 0;
  const seq = [0, 0.99, 0, 0.5, 0, 0.01];
  for (let i = 0; i < 3; i++) {
    const g2 = createGame(MAPS[0]);
    g2.gold = 1e6;
    addTower(g2, 'squirrel', ...cells[1], 1);
    const t = summonTower(g2, () => seq[(k++) % seq.length]);
    seen.add(`${t.col},${t.row}`);
  }
  assert.ok(seen.size > 1, '여러 자리에 놓여야 한다');
});
