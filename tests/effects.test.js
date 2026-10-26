import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEffects, EFFECT_LIMIT, LIFE, SHAKE_MS } from '../js/ui/effects.js';

const fixed = () => 0.5;
const shot = (tower, targetId = 7) => ({ type: 'shot', tower, towerId: 1, targetId, from: { x: 1, y: 1 }, to: { x: 3, y: 1 } });

test('발사 이벤트는 발사체를 만들고 맞은 적의 피격 시각을 기록한다', () => {
  const fx = createEffects(fixed);
  fx.fromEvent(shot('squirrel', 7), 1000);
  const list = fx.active(1000);
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].kind, list[0].tower], ['projectile', 'squirrel']);
  assert.equal(fx.hitTime(7), 1000);
  assert.equal(fx.hitTime(99), -Infinity);
});

test('코끼리 공격은 발사체와 함께 충격파를 남긴다', () => {
  const fx = createEffects(fixed);
  fx.fromEvent(shot('elephant'), 0);
  assert.deepEqual(fx.active(0).map((f) => f.kind).sort(), ['projectile', 'shock']);
});

test('처치하면 파편과 보상 숫자가 생기고, 보스는 더 많은 파편과 화면 흔들림이 생긴다', () => {
  const fx = createEffects(fixed);
  fx.fromEvent({ type: 'death', enemy: 'soldier', reward: 5, x: 2, y: 2 }, 0);
  let list = fx.active(0);
  assert.equal(list.filter((f) => f.kind === 'particle').length, 8);
  assert.deepEqual(list.filter((f) => f.kind === 'coin').map((f) => f.text), ['+5']);
  assert.equal(fx.shake(0), 0);
  fx.fromEvent({ type: 'death', enemy: 'boss', reward: 200, x: 2, y: 2 }, 100);
  list = fx.active(100);
  assert.equal(list.filter((f) => f.kind === 'particle').length, 8 + 28);
  assert.ok(fx.shake(100) > 0.9);
  assert.equal(fx.shake(100 + SHAKE_MS), 0);
});

test('적이 집에 도착하면 붉은 번쩍임이 잠깐 생긴다', () => {
  const fx = createEffects(fixed);
  assert.equal(fx.flash(0), 0);
  fx.fromEvent({ type: 'leak', enemy: 'soldier', lives: 1, x: 2, y: 9 }, 500);
  assert.equal(fx.flash(500), 1);
  assert.ok(fx.flash(500 + LIFE.flash / 2) > 0);
  assert.equal(fx.flash(500 + LIFE.flash), 0);
});

test('소환은 고리와 반짝임, 합성은 성장 문구, 각성은 각성 문구와 약한 흔들림', () => {
  const fx = createEffects(fixed);
  fx.summon(3, 3, 0);
  let kinds = fx.active(0).map((f) => f.kind);
  assert.ok(kinds.includes('ring') && kinds.includes('particle'));
  fx.merge(3, 3, 1, 10);
  assert.deepEqual(fx.active(10).filter((f) => f.kind === 'text').map((f) => f.text), ['성장!']);
  assert.equal(fx.shake(10), 0);
  fx.merge(4, 4, 3, 20);
  const texts = fx.active(20).filter((f) => f.kind === 'text');
  assert.deepEqual(texts.map((f) => [f.text, f.big]), [['성장!', false], ['각성!', true]]);
  assert.ok(fx.shake(20) > 0);
});

test('수명이 다한 효과는 사라진다', () => {
  const fx = createEffects(fixed);
  fx.fromEvent(shot('squirrel'), 0);
  fx.fromEvent({ type: 'death', enemy: 'soldier', reward: 5, x: 2, y: 2 }, 0);
  assert.ok(fx.active(LIFE.projectile - 1).some((f) => f.kind === 'projectile'));
  assert.ok(!fx.active(LIFE.projectile).some((f) => f.kind === 'projectile'));
  assert.equal(fx.active(Math.max(...Object.values(LIFE))).length, 0);
});

test('효과가 아무리 많아도 개수 상한을 넘지 않는다', () => {
  const fx = createEffects(fixed);
  for (let i = 0; i < 200; i++) fx.fromEvent({ type: 'death', enemy: 'boss', reward: 200, x: 1, y: 1 }, 0);
  assert.equal(fx.active(0).length, EFFECT_LIMIT);
});

test('효과는 Math.random을 쓰지 않는다 (소환 같은 게임 무작위와 섞이지 않게)', () => {
  const original = Math.random;
  let calls = 0;
  Math.random = () => { calls += 1; return 0.5; };
  try {
    const fx = createEffects();
    fx.summon(1, 1, 0);
    fx.merge(1, 1, 3, 0);
    fx.fromEvent({ type: 'death', enemy: 'boss', reward: 200, x: 1, y: 1 }, 0);
  } finally {
    Math.random = original;
  }
  assert.equal(calls, 0);
});
