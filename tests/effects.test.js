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
  fx.merge(3, 3, 1, 10, '펭귄');
  assert.deepEqual(fx.active(10).filter((f) => f.kind === 'text').map((f) => f.text), ['성장! 펭귄']);
  assert.equal(fx.shake(10), 0);
  fx.merge(4, 4, 3, 20, '뱀');
  const texts = fx.active(20).filter((f) => f.kind === 'text');
  assert.deepEqual(texts.map((f) => [f.text, f.big]), [['성장! 펭귄', false], ['각성! 뱀', true]]);
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

test('웨이브 클리어는 맵 가운데에 보상 문구를 띄운다', () => {
  const fx = createEffects(fixed);
  fx.waveClear(8, 5, 10, 0);
  const texts = fx.active(0).filter((f) => f.kind === 'text');
  assert.deepEqual(texts.map((f) => [f.text, f.x, f.y]), [['웨이브 클리어 +10', 8, 5]]);
});

test('hit 이벤트는 노란 데미지 숫자를 띄운다 (반올림, 최소 1)', () => {
  const fx = createEffects(fixed);
  fx.fromEvent({ type: 'hit', enemyId: 3, amount: 7.6, x: 2, y: 2 }, 0);
  fx.fromEvent({ type: 'hit', enemyId: 4, amount: 0.2, x: 2, y: 2 }, 0);
  const dmg = fx.active(0).filter((f) => f.kind === 'damage');
  assert.deepEqual(dmg.map((f) => f.text), ['8', '1']);
  assert.ok(!fx.active(LIFE.damage).some((f) => f.kind === 'damage'));
});

test('보스 능력은 경고 문구와 고리를 띄우고, 포효는 크게 화면을 흔든다', () => {
  const fx = createEffects(fixed);
  fx.fromEvent({ type: 'bossSkill', skill: 'rage', enemy: 'boss', x: 3, y: 3 }, 0);
  assert.equal(fx.shake(0), 0);
  fx.fromEvent({ type: 'bossSkill', skill: 'roar', enemy: 'dragon', x: 3, y: 3 }, 0);
  const texts = fx.active(0).filter((f) => f.kind === 'text').map((f) => f.text);
  assert.deepEqual(texts, ['분노!', '포효!']);
  const rings = fx.active(0).filter((f) => f.kind === 'ring');
  assert.deepEqual(rings.map((f) => f.reach), [0.8, 2.5]);
  assert.ok(fx.shake(0) > 0);
});

test('신화 탄생은 큰 문구와 무지개 파편, 흔들림을 만든다', () => {
  const fx = createEffects(fixed);
  fx.fromEvent({ type: 'mythic', mythic: 'phoenix', towerId: 1, x: 3, y: 3 }, 0);
  const text = fx.active(0).find((f) => f.kind === 'text');
  assert.equal(text.text, '신화 탄생! 불사조');
  assert.equal(text.big, true);
  assert.ok(fx.active(0).filter((f) => f.kind === 'particle').length >= 20);
  assert.ok(fx.shake(0) > 0);
});

test('신화 공격: 불사조·구미호·기린은 발사체, 천마는 바람 줄기, 해태는 넓은 고리, 기절은 문구', () => {
  const fx = createEffects(fixed);
  const from = { x: 1, y: 1 };
  const to = { x: 3, y: 1 };
  for (const mythic of ['phoenix', 'gumiho', 'girin', 'cheonma']) fx.fromEvent({ type: 'mythicShot', mythic, towerId: 1, from, to }, 0);
  fx.fromEvent({ type: 'quake', towerId: 2, x: 5, y: 5 }, 0);
  fx.fromEvent({ type: 'stun', enemyId: 3, x: 2, y: 2 }, 0);
  const all = fx.active(0);
  assert.deepEqual(all.filter((f) => f.kind === 'projectile').map((f) => f.tower), ['phoenix', 'gumiho', 'girin']);
  assert.equal(all.filter((f) => f.kind === 'beam').length, 1);
  assert.ok(all.some((f) => f.kind === 'ring' && f.reach >= 3));
  assert.ok(all.some((f) => f.kind === 'text' && f.text === '기절!'));
});

test('몬스터가 블랙홀에 닿으면 빨려 들어가는 효과가 생기고, 블랙홀이 크게 꿀렁인다', () => {
  const fx = createEffects(fixed);
  assert.equal(fx.portalPulse(0), 0);
  fx.fromEvent({ type: 'leak', enemy: 'tank', lives: 1, x: 2, y: 9 }, 100);
  const suck = fx.active(100).find((f) => f.kind === 'suck');
  assert.deepEqual([suck.enemy, suck.x, suck.y], ['tank', 2, 9]);
  assert.equal(fx.portalPulse(100), 1);
  assert.ok(fx.portalPulse(100 + LIFE.suck / 2) > 0);
  assert.equal(fx.portalPulse(100 + LIFE.suck * 2), 0);
  assert.ok(!fx.active(100 + LIFE.suck).some((f) => f.kind === 'suck'));
});

test('황금 몬스터: 나타나면 큰 알림, 잡으면 금화 폭죽, 놓치면 도망 문구', () => {
  const fx = createEffects(fixed);
  fx.fromEvent({ type: 'goldenSpawn', enemyId: 1, x: 1, y: 1 }, 0);
  assert.ok(fx.active(0).some((f) => f.kind === 'text' && f.text === '✨ 황금 몬스터 출현!' && f.big));
  fx.fromEvent({ type: 'death', enemy: 'golden', reward: 100, x: 3, y: 3 }, 0);
  assert.ok(fx.active(0).filter((f) => f.kind === 'particle').length >= 30);
  fx.fromEvent({ type: 'goldenEscape', enemy: 'golden', x: 5, y: 5 }, 0);
  assert.ok(fx.active(0).some((f) => f.kind === 'text' && f.text === '도망갔다…'));
});

test('미션: 시작·성공·실패 문구', () => {
  const fx = createEffects(fixed);
  fx.fromEvent({ type: 'missionStart', mission: 'kill' }, 0, { x: 8, y: 5 });
  fx.fromEvent({ type: 'missionDone', mission: 'kill', reward: { gold: 120 } }, 0, { x: 8, y: 5 });
  fx.fromEvent({ type: 'missionFail', mission: 'kill' }, 0, { x: 8, y: 5 });
  const texts = fx.active(0).filter((f) => f.kind === 'text').map((f) => f.text);
  assert.deepEqual(texts, ['🎯 새 미션!', '🎯 미션 성공!', '미션 실패…']);
});
