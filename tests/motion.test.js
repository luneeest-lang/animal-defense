import { test } from 'node:test';
import assert from 'node:assert/strict';
import { towerMotion, ATTACK_MS } from '../js/ui/motion.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('가만히 있을 때는 숨 쉬듯 위아래로 살짝 늘었다 줄었다 한다 (부피는 거의 그대로)', () => {
  const ys = [];
  for (let t = 0; t < 4000; t += 50) {
    const m = towerMotion(t, 7, null);
    assert.equal(m.dx, 0, '앞으로 나가지 않는다');
    assert.ok(m.sy >= 0.97 && m.sy <= 1.03, String(m.sy));
    assert.ok(Math.abs(m.sx * m.sy - 1) < 0.02, '납작해지면 옆으로 퍼진다');
    ys.push(m.sy);
  }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.03, '움직임이 보일 만큼은 있다');
});

test('동물마다 숨 쉬는 박자가 달라 한꺼번에 움직이지 않는다', () => {
  assert.notEqual(towerMotion(1000, 1, null).sy, towerMotion(1000, 2, null).sy);
});

test('공격하면 바라보는 쪽으로 툭 나갔다가 돌아온다', () => {
  const shot = 1000;
  assert.ok(close(towerMotion(shot, 1, shot).dx, 0));
  const mid = towerMotion(shot + ATTACK_MS / 2, 1, shot);
  assert.ok(mid.dx > 0.08 && mid.dx <= 0.12, `가운데쯤 가장 멀리: ${mid.dx}`);
  assert.ok(mid.sx > 1 && mid.sy < 1, '내밀 때 납작하게');
  assert.ok(close(towerMotion(shot + ATTACK_MS, 1, shot).dx, 0), '끝나면 제자리');
  assert.equal(towerMotion(shot + ATTACK_MS + 500, 1, shot).dx, 0);
});

test('움직임 줄이기 설정이면 움직이지 않는다', () => {
  for (const [t, shot] of [[500, null], [1100, 1000]]) {
    assert.deepEqual(towerMotion(t, 3, shot, true), { dx: 0, sx: 1, sy: 1 });
  }
});
