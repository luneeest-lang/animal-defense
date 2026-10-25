import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import {
  waypointPoints, pathLength, positionAt, pathCells, canBuild, pointToCell,
} from '../js/core/path.js';

const meadow = MAPS[0];
const key = (c, r) => `${c},${r}`;

test('맵은 3개이고 id 순서가 정해져 있다', () => {
  assert.deepEqual(MAPS.map((m) => m.id), ['meadow', 'forest', 'canyon']);
  for (const m of MAPS) {
    assert.equal(m.cols, 16);
    assert.equal(m.rows, 10);
  }
});

test('모든 맵의 웨이브포인트는 격자 안에서 가로/세로로만 이어진다', () => {
  for (const m of MAPS) {
    for (const [c, r] of m.waypoints) {
      assert.ok(c >= 0 && c < m.cols && r >= 0 && r < m.rows, `${m.id} out of grid`);
    }
    for (let i = 1; i < m.waypoints.length; i++) {
      const [c0, r0] = m.waypoints[i - 1];
      const [c1, r1] = m.waypoints[i];
      assert.ok((c0 === c1) !== (r0 === r1), `${m.id} segment ${i} not axis-aligned or zero length`);
    }
  }
});

test('장애물 칸은 길과 겹치지 않고 격자 안에 있다', () => {
  for (const m of MAPS) {
    const cells = pathCells(m);
    for (const [c, r] of m.blocked) {
      assert.ok(c >= 0 && c < m.cols && r >= 0 && r < m.rows);
      assert.ok(!cells.has(key(c, r)), `${m.id} blocked ${c},${r} on path`);
    }
  }
});

test('초원 길 길이는 31칸이다', () => {
  assert.equal(pathLength(waypointPoints(meadow)), 31);
});

test('pathCells는 선분 위의 모든 칸을 포함한다', () => {
  const cells = pathCells(meadow);
  for (const [c, r] of [[0, 2], [6, 2], [13, 2], [13, 4], [13, 6], [8, 6], [2, 6], [2, 8], [2, 9]]) {
    assert.ok(cells.has(key(c, r)), `missing ${c},${r}`);
  }
  assert.ok(!cells.has('5,4'));
});

test('positionAt은 길을 따라 위치를 계산하고 끝을 넘으면 마지막 점에 멈춘다', () => {
  const pts = waypointPoints(meadow);
  assert.deepEqual(positionAt(pts, 0), { x: 0.5, y: 2.5 });
  assert.deepEqual(positionAt(pts, 13), { x: 13.5, y: 2.5 });
  assert.deepEqual(positionAt(pts, 15), { x: 13.5, y: 4.5 });
  assert.deepEqual(positionAt(pts, 999), { x: 2.5, y: 9.5 });
  assert.deepEqual(positionAt(pts, -3), { x: 0.5, y: 2.5 });
});

test('canBuild는 길, 장애물, 격자 밖, 점유 칸을 거절한다', () => {
  const none = new Set();
  assert.equal(canBuild(meadow, 5, 2, none), false);
  assert.equal(canBuild(meadow, 7, 4, none), false);
  assert.equal(canBuild(meadow, -1, 0, none), false);
  assert.equal(canBuild(meadow, 16, 0, none), false);
  assert.equal(canBuild(meadow, 0, 10, none), false);
  assert.equal(canBuild(meadow, 5, 4, none), true);
  assert.equal(canBuild(meadow, 5, 4, new Set(['5,4'])), false);
});

test('pointToCell은 캔버스 픽셀을 칸으로 바꾸고 밖이면 null이다', () => {
  assert.deepEqual(pointToCell(160, 100, 320, 200, 16, 10), { col: 8, row: 5 });
  assert.deepEqual(pointToCell(0, 0, 320, 200, 16, 10), { col: 0, row: 0 });
  assert.equal(pointToCell(-1, 5, 320, 200, 16, 10), null);
  assert.equal(pointToCell(320, 5, 320, 200, 16, 10), null);
  assert.equal(pointToCell(5, 200, 320, 200, 16, 10), null);
});
