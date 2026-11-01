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

test('화면 점을 맵 좌표(칸 단위 소수)로 바꾼다. 맵 밖이어도 값을 준다', async () => {
  const { screenToMap } = await import('../js/ui/input.js');
  assert.deepEqual(screenToMap(160, 100, 320, 200, 16, 10), { x: 8, y: 5 });
  assert.deepEqual(screenToMap(-20, 100, 320, 200, 16, 10), { x: -1, y: 5 });
  // 세로: 화면 오른쪽 위 = 맵 왼쪽 위
  const p = screenToMap(390 - 39 * 4.5, 39 * 7.5, 390, 624, 16, 10);
  assert.ok(Math.abs(p.x - 7.5) < 1e-9 && Math.abs(p.y - 4.5) < 1e-9, JSON.stringify(p));
});

test('맵 좌표를 화면 점으로 바꾸면 화면 점 → 맵 좌표의 반대가 된다 (튜토리얼 손가락 위치)', async () => {
  const { screenToMap, mapToScreen } = await import('../js/ui/input.js');
  for (const [w, h] of [[320, 200], [390, 624]]) {
    const p = mapToScreen(7.5, 4.5, w, h, 16, 10);
    const back = screenToMap(p.x, p.y, w, h, 16, 10);
    assert.ok(Math.abs(back.x - 7.5) < 1e-9 && Math.abs(back.y - 4.5) < 1e-9, JSON.stringify([w, h, p, back]));
  }
});
