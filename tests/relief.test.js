import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reliefCells, screenGrid } from '../js/ui/relief.js';

// 3x3 맵, 가운데 가로줄이 길
const map = { cols: 3, rows: 3, theme: 'mountain', waypoints: [[0, 1], [2, 1]], blocked: [] };
const at = (cells, i, j) => cells.find((x) => x.i === i && x.j === j);

test('화면 격자: 세로 화면이면 맵을 돌린 크기와 칸 대응', () => {
  assert.deepEqual(screenGrid(map, false).cellAt(2, 0), [2, 0]);
  const g = screenGrid({ ...map, cols: 4 }, true);
  assert.deepEqual([g.cols, g.rows], [3, 4]);
  // 돌린 화면의 (i, j)는 맵의 (j, rows-1-i)
  assert.deepEqual(g.cellAt(0, 1), [1, 2]);
});

test('돌산: 땅이 높고 길이 한 단 낮다. 위가 높은 낮은 칸에 절벽 벽이 생긴다', () => {
  const cells = reliefCells(map, false);
  const road = at(cells, 1, 1);
  assert.equal(road.high, false);
  assert.equal(road.wallTop, true); // 위쪽 땅의 앞면 벽
  assert.equal(road.lipBottom, true); // 아래쪽 땅 가장자리
  assert.equal(road.shadeLeft, false); // 왼쪽은 길
  const ground = at(cells, 1, 0);
  assert.equal(ground.high, true);
  assert.equal(ground.wallTop, false);
  assert.equal(ground.rimBottom, true); // 아래로 떨어지는 모서리에 밝은 테두리
  // 맵 밖은 같은 높이로 본다
  assert.equal(at(cells, 0, 1).shadeLeft, false);
});

test('바다: 판자 다리가 높고 물이 낮다', () => {
  const cells = reliefCells({ ...map, theme: 'sea' }, false);
  assert.equal(at(cells, 1, 1).high, true);
  assert.equal(at(cells, 1, 2).wallTop, true); // 다리 아래 물 칸에 다리 옆면
  assert.equal(at(cells, 1, 0).wallTop, false);
});

test('세로 화면에서도 벽은 화면 아래쪽을 향한다', () => {
  // 돌리면 맵의 가로줄 길(r=1)이 화면 세로줄(i = rows-1-1 = 1)이 된다
  const cells = reliefCells(map, true);
  const road = at(cells, 1, 1);
  assert.equal(road.high, false);
  assert.equal(road.wallTop, false); // 위(같은 세로줄)는 길
  assert.equal(road.shadeLeft, true); // 왼쪽은 땅
  assert.equal(road.edgeRight, true);
});

test('막힌 칸(바위, 나무)은 땅 높이다', () => {
  const cells = reliefCells({ ...map, blocked: [[1, 0]] }, false);
  assert.equal(at(cells, 1, 0).high, true);
});
