import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyTint } from '../js/ui/atmosphere.js';

test('1웨이브는 낮(물들이지 않음), 웨이브가 진행될수록 점점 노을빛이 짙어진다', () => {
  assert.equal(skyTint(0).alpha, 0);
  assert.equal(skyTint(1).alpha, 0);
  let last = 0;
  for (let w = 2; w <= 30; w++) {
    const s = skyTint(w);
    assert.ok(s.alpha >= last - 1e-9, `${w}: ${s.alpha} < ${last}`);
    assert.match(s.color, /^\d+, \d+, \d+$/);
    last = s.alpha;
  }
  assert.ok(skyTint(30).alpha > 0.1, '30웨이브는 노을이 보인다');
  assert.ok(skyTint(30).alpha <= 0.22, '그래도 맵이 잘 보일 만큼만');
});

test('무한 모드 30웨이브 뒤로는 밤이 되고, 너무 어둡지는 않다', () => {
  const dusk = skyTint(30);
  const night = skyTint(45);
  assert.ok(night.alpha >= dusk.alpha);
  assert.ok(night.night > 0.9, '밤');
  assert.ok(skyTint(200).alpha <= 0.3);
  assert.equal(skyTint(10).night, 0);
});
