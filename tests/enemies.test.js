import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../js/data/enemies.js';
import {
  hpScale, createEnemy, damageEnemy, applySlow, applyPoison, stepEnemy, speedScale, isBoss,
} from '../js/core/enemies.js';

test('적 기본 수치', () => {
  const pick = (id) => {
    const { hp, speed, reward, leak } = ENEMIES[id];
    return { hp, speed, reward, leak };
  };
  assert.deepEqual(pick('soldier'), { hp: 40, speed: 1.0, reward: 5, leak: 1 });
  assert.equal(ENEMIES.runner.hp, 25);
  assert.equal(ENEMIES.runner.speed, 2.0);
  assert.equal(ENEMIES.runner.reward, 6);
  assert.deepEqual([ENEMIES.tank.hp, ENEMIES.tank.speed, ENEMIES.tank.reward], [160, 0.6, 12]);
  assert.deepEqual([ENEMIES.shield.hp, ENEMIES.shield.speed, ENEMIES.shield.reward], [80, 0.9, 9]);
  assert.equal(ENEMIES.shield.directMult, 0.5);
  assert.deepEqual([ENEMIES.splitter.hp, ENEMIES.splitter.speed, ENEMIES.splitter.reward], [60, 1.0, 8]);
  assert.deepEqual(ENEMIES.splitter.splitInto, { type: 'mini', count: 2 });
  assert.deepEqual([ENEMIES.mini.hp, ENEMIES.mini.speed, ENEMIES.mini.reward], [20, 1.4, 2]);
  assert.deepEqual([ENEMIES.boss.hp, ENEMIES.boss.speed, ENEMIES.boss.reward, ENEMIES.boss.leak], [1500, 0.5, 200, 5]);
});

test('웨이브 번호에 따라 체력이 늘어난다', () => {
  // 전체 체력 5% 상향 (기본 수치 x 1.05)
  assert.ok(Math.abs(hpScale(1) - 1.05) < 1e-9);
  assert.ok(Math.abs(createEnemy(1, 'soldier', 1).hp - 42) < 1e-9);
  // 10웨이브까지는 웨이브마다 기본의 30%씩, 그 뒤로는 웨이브마다 1.1배씩 더 늘어난다
  assert.ok(Math.abs(createEnemy(1, 'soldier', 10).hp - 42 * 3.7) < 1e-9);
  assert.ok(Math.abs(createEnemy(1, 'soldier', 11).hp - 168 * 1.1) < 1e-9);
  assert.ok(Math.abs(hpScale(30) - 1.05 * 9.7 * 1.1 ** 20) < 1e-9);
  const e = createEnemy(7, 'soldier', 1);
  assert.deepEqual(
    { id: e.id, type: e.type, waveNumber: e.waveNumber, maxHp: e.maxHp, dist: e.dist, slow: e.slow, poison: e.poison },
    { id: 7, type: 'soldier', waveNumber: 1, maxHp: e.maxHp, dist: 0, slow: null, poison: null },
  );
});

test('방패병은 직접 피해를 절반만 받고 독은 그대로 받는다', () => {
  const e = createEnemy(1, 'shield', 1);
  damageEnemy(e, 10, 'direct');
  assert.equal(e.hp, e.maxHp - 5);
  damageEnemy(e, 10, 'poison');
  assert.equal(e.hp, e.maxHp - 15);
});

test('슬로우는 이동 속도를 줄이고 만료되면 정상 속도로 돌아온다', () => {
  const e = createEnemy(1, 'soldier', 1);
  applySlow(e, 0.5, 2);
  stepEnemy(e, 1);
  assert.equal(e.dist, 0.5);
  stepEnemy(e, 1);
  assert.equal(e.dist, 1.0);
  stepEnemy(e, 1);
  assert.equal(e.dist, 2.0);
});

test('약한 슬로우는 강한 슬로우를 덮어쓰지 못한다', () => {
  const e = createEnemy(1, 'soldier', 1);
  applySlow(e, 0.5, 2);
  applySlow(e, 0.8, 2);
  stepEnemy(e, 1);
  assert.equal(e.dist, 0.5);
});

test('독은 초당 피해를 주고 지속시간이 지나면 멈춘다', () => {
  const e = createEnemy(1, 'tank', 1);
  applyPoison(e, 6, 3);
  stepEnemy(e, 1);
  stepEnemy(e, 1);
  assert.equal(e.hp, e.maxHp - 12);
  stepEnemy(e, 1);
  assert.equal(e.hp, e.maxHp - 18);
  stepEnemy(e, 1);
  assert.equal(e.hp, e.maxHp - 18);
});

test('지속시간보다 긴 한 번의 step도 지속시간만큼만 피해를 준다', () => {
  const e = createEnemy(1, 'tank', 1);
  applyPoison(e, 6, 3);
  stepEnemy(e, 10);
  assert.equal(e.hp, e.maxHp - 18);
});

test('보스 6종이 있고 흑룡은 체력이 가장 높다', () => {
  const bosses = ['boss', 'slimeKing', 'lich', 'lavaGolem', 'shadowWolf', 'dragon'];
  for (const id of bosses) {
    assert.ok(isBoss(id), id);
    assert.equal(ENEMIES[id].leak, 5, id);
    assert.ok(ENEMIES[id].name, id);
  }
  assert.ok(!isBoss('soldier'));
  for (const id of bosses.slice(0, 5)) assert.ok(ENEMIES.dragon.hp > ENEMIES[id].hp);
});

test('웨이브가 높을수록 몬스터가 빨라진다 (웨이브마다 1%)', () => {
  assert.equal(speedScale(1), 1);
  assert.ok(Math.abs(speedScale(30) - 1.29) < 1e-9);
  const e = createEnemy(1, 'soldier', 11);
  stepEnemy(e, 1);
  assert.ok(Math.abs(e.dist - 1.1) < 1e-9);
});

test('방패병의 방어는 웨이브가 높을수록 단단해진다 (직접 피해 50% → 최소 35%)', () => {
  const early = createEnemy(1, 'shield', 1);
  const late = createEnemy(2, 'shield', 30);
  assert.equal(early.directMult, 0.5);
  assert.ok(late.directMult >= 0.35 && late.directMult < 0.4, String(late.directMult));
  damageEnemy(late, 100, 'direct');
  assert.ok(Math.abs(late.maxHp - late.hp - 100 * late.directMult) < 1e-9);
});
