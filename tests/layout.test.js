import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitBoard } from '../js/ui/layout.js';

test('가로로 넓은 자리에는 16:10 맵을 빈틈 없이 맞춘다 (잘리지 않음)', () => {
  assert.deepEqual(fitBoard(708, 338), { width: 540, height: 337, portrait: false });
  assert.deepEqual(fitBoard(400, 400), { width: 400, height: 250, portrait: false });
});

test('세로로 긴 자리에는 맵을 돌려 10:16으로 맞춘다', () => {
  assert.deepEqual(fitBoard(390, 700), { width: 390, height: 624, portrait: true });
  assert.deepEqual(fitBoard(390, 500), { width: 312, height: 499, portrait: true });
});

test('결과는 항상 자리 안에 들어가고, 아주 큰 화면에서는 최대 크기로 제한한다', () => {
  for (const [w, h] of [[360, 553], [531, 323], [1, 1], [997, 611], [413, 913]]) {
    const r = fitBoard(w, h);
    assert.ok(r.width <= w && r.height <= h, JSON.stringify([w, h, r]));
  }
  assert.equal(fitBoard(3000, 2000).width, 1100);
  assert.equal(fitBoard(1000, 3000).width, 560);
  assert.deepEqual(fitBoard(0, 0), { width: 0, height: 0, portrait: false });
});
