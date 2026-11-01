import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { createGame, addTower, emptyCells, snapMergeTarget, SNAP_RADIUS } from '../js/core/game.js';

// 자석 합성: 놓은 자리가 조금 빗나가도 가까운 짝에 붙는다
function setup() {
  const g = createGame(MAPS[0]);
  const cells = emptyCells(g);
  // 서로 떨어진 빈칸 셋을 고른다
  const [a] = cells;
  const near = cells.find(([c, r]) => Math.abs(c - a[0]) + Math.abs(r - a[1]) >= 3);
  const far = cells.find(([c, r]) => Math.abs(c - a[0]) + Math.abs(r - a[1]) >= 3 && Math.abs(c - near[0]) + Math.abs(r - near[1]) >= 3);
  const from = addTower(g, 'squirrel', ...a, 1);
  const mate = addTower(g, 'squirrel', ...near, 1);
  const other = addTower(g, 'eagle', ...far, 1);
  return { g, from, mate, other };
}
const center = (t) => ({ x: t.col + 0.5, y: t.row + 0.5 });

test('놓은 칸에 짝이 있으면 그 짝', () => {
  const { g, from, mate } = setup();
  assert.equal(snapMergeTarget(g, from.id, center(mate)), mate);
});

test('짝 칸에서 한 칸쯤 빗나가도 짝에 붙는다', () => {
  const { g, from, mate } = setup();
  assert.equal(SNAP_RADIUS, 1.5);
  assert.equal(snapMergeTarget(g, from.id, { x: mate.col + 0.5 + 0.9, y: mate.row + 0.5 + 0.6 }), mate);
});

test('너무 멀면(1.5칸 넘게) 붙지 않는다', () => {
  const { g, from, mate } = setup();
  assert.equal(snapMergeTarget(g, from.id, { x: mate.col + 0.5 + 1.6, y: mate.row + 0.5 }), null);
});

test('합칠 수 없는 동물(다른 종류·다른 단계·자기 자신)에는 붙지 않는다', () => {
  const { g, from, other } = setup();
  assert.equal(snapMergeTarget(g, from.id, center(other)), null);
  assert.equal(snapMergeTarget(g, from.id, center(from)), null);
});

test('짝이 둘이면 더 가까운 짝', () => {
  const g = createGame(MAPS[0]);
  const cells = emptyCells(g);
  const pick = (dc, dr) => cells.find(([c, r]) => cells.some(([c2, r2]) => c2 === c + dc && r2 === r + dr));
  const [c0, r0] = pick(1, 0);
  const from = addTower(g, 'snake', ...cells.find(([c, r]) => Math.abs(c - c0) + Math.abs(r - r0) >= 4), 0);
  const left = addTower(g, 'snake', c0, r0, 0);
  const right = addTower(g, 'snake', c0 + 1, r0, 0);
  assert.equal(snapMergeTarget(g, from.id, { x: c0 + 0.6, y: r0 + 0.5 }), left);
  assert.equal(snapMergeTarget(g, from.id, { x: c0 + 1.4, y: r0 + 0.5 }), right);
});
