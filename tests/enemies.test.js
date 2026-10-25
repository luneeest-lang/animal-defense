import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../js/data/enemies.js';
import {
  hpScale, createEnemy, damageEnemy, applySlow, applyPoison, stepEnemy,
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
  assert.deepEqual([ENEMIES.boss.hp, ENEMIES.boss.speed, ENEMIES.boss.reward, ENEMIES.boss.leak], [1500, 0.5, 100, 5]);
});

test('웨이브 번호에 따라 체력이 늘어난다', () => {
  assert.equal(hpScale(1), 1);
  assert.equal(createEnemy(1, 'soldier', 1).hp, 40);
  assert.equal(createEnemy(1, 'soldier', 11).hp, 120);
  const e = createEnemy(7, 'soldier', 1);
  assert.deepEqual(
    { id: e.id, type: e.type, waveNumber: e.waveNumber, maxHp: e.maxHp, dist: e.dist, slow: e.slow, poison: e.poison },
    { id: 7, type: 'soldier', waveNumber: 1, maxHp: 40, dist: 0, slow: null, poison: null },
  );
});

test('방패병은 직접 피해를 절반만 받고 독은 그대로 받는다', () => {
  const e = createEnemy(1, 'shield', 1);
  damageEnemy(e, 10, 'direct');
  assert.equal(e.hp, 75);
  damageEnemy(e, 10, 'poison');
  assert.equal(e.hp, 65);
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
  assert.equal(e.hp, 160 - 12);
  stepEnemy(e, 1);
  assert.equal(e.hp, 160 - 18);
  stepEnemy(e, 1);
  assert.equal(e.hp, 160 - 18);
});

test('지속시간보다 긴 한 번의 step도 지속시간만큼만 피해를 준다', () => {
  const e = createEnemy(1, 'tank', 1);
  applyPoison(e, 6, 3);
  stepEnemy(e, 10);
  assert.equal(e.hp, 160 - 18);
});
