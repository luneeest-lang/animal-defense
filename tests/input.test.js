import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenToCell } from '../js/ui/input.js';

test('가로 화면에서는 그대로 칸을 찾는다', () => {
  assert.deepEqual(screenToCell(160, 100, 320, 200, 16, 10), { col: 8, row: 5 });
  assert.deepEqual(screenToCell(1, 1, 320, 200, 16, 10), { col: 0, row: 0 });
  assert.equal(screenToCell(-1, 5, 320, 200, 16, 10), null);
});

test('세로 화면에서는 맵이 90도 돌아가 있다 (맵 왼쪽 = 화면 위, 맵 위쪽 = 화면 오른쪽)', () => {
  // 390x624 캔버스, 한 칸 39px
  assert.deepEqual(screenToCell(389, 1, 390, 624, 16, 10), { col: 0, row: 0 }, '화면 오른쪽 위 = 맵 왼쪽 위');
  assert.deepEqual(screenToCell(1, 1, 390, 624, 16, 10), { col: 0, row: 9 }, '화면 왼쪽 위 = 맵 왼쪽 아래');
  assert.deepEqual(screenToCell(389, 623, 390, 624, 16, 10), { col: 15, row: 0 }, '화면 오른쪽 아래 = 맵 오른쪽 위');
  assert.deepEqual(screenToCell(390 - 39 * 4.5, 39 * 7.5, 390, 624, 16, 10), { col: 7, row: 4 });
  assert.equal(screenToCell(-1, 10, 390, 624, 16, 10), null);
  assert.equal(screenToCell(10, 625, 390, 624, 16, 10), null);
});
