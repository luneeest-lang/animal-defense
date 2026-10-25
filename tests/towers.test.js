import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { waypointPoints } from '../js/core/path.js';
import { createEnemy } from '../js/core/enemies.js';
import { TOWERS, MAX_LEVEL, towerStats, upgradeCost, findTarget, fire } from '../js/core/towers.js';

const points = waypointPoints(MAPS[0]);
const tower = (type, col = 5, row = 3, level = 0) => ({ id: 1, type, col, row, level, cooldown: 0, invested: TOWERS[type].cost });
const enemyAt = (id, type, dist) => Object.assign(createEnemy(id, type, 1), { dist });

test('타워 기본 수치', () => {
  assert.deepEqual(Object.keys(TOWERS), ['squirrel', 'elephant', 'penguin', 'eagle', 'snake']);
  assert.deepEqual(['squirrel', 'elephant', 'penguin', 'eagle', 'snake'].map((t) => TOWERS[t].cost), [50, 90, 70, 120, 80]);
  assert.equal(MAX_LEVEL, 3);
  assert.deepEqual(towerStats('elephant', 0), { damage: 20, range: 2.2, cooldown: 1.6, splash: 1.0 });
  assert.equal(towerStats('eagle', 0).bossMult, 1.5);
  assert.equal(towerStats('snake', 0).poisonDps, 6);
  assert.equal(towerStats('penguin', 0).slowFactor, 0.6);
});

test('레벨마다 능력치가 오른다', () => {
  assert.equal(towerStats('squirrel', 0).damage, 8);
  assert.equal(towerStats('squirrel', 2).damage, 18);
  assert.ok(Math.abs(towerStats('squirrel', 3).range - 3.1) < 1e-9);
  assert.ok(towerStats('squirrel', 3).cooldown < towerStats('squirrel', 0).cooldown);
  assert.ok(towerStats('snake', 3).poisonDps > towerStats('snake', 0).poisonDps);
  assert.ok(towerStats('penguin', 3).slowFactor >= 0.3);
  assert.ok(towerStats('penguin', 3).slowFactor < towerStats('penguin', 0).slowFactor);
});

test('업그레이드 비용은 현재 레벨 기준이고 최대 레벨이면 null이다', () => {
  assert.equal(upgradeCost('squirrel', 0), 40);
  assert.equal(upgradeCost('squirrel', 1), 70);
  assert.equal(upgradeCost('squirrel', 2), 110);
  assert.equal(upgradeCost('squirrel', 3), null);
});

test('findTarget은 사거리 안에서 가장 앞선 적을 고른다', () => {
  const near = enemyAt(1, 'soldier', 4);
  const front = enemyAt(2, 'soldier', 6);
  const far = enemyAt(3, 'soldier', 12);
  assert.equal(findTarget(tower('squirrel'), [near, front, far], points), front);
  assert.equal(findTarget(tower('squirrel'), [far], points), null);
  assert.equal(findTarget(tower('squirrel'), [], points), null);
});

test('squirrel은 대상 한 마리에게 8 피해', () => {
  const e = enemyAt(1, 'soldier', 5);
  fire(tower('squirrel'), e, [e], points);
  assert.equal(e.hp, 32);
});

test('elephant는 대상 주변 반경 1.0 안의 모든 적에게 피해를 준다', () => {
  const a = enemyAt(1, 'tank', 5);
  const b = enemyAt(2, 'tank', 5.5);
  const c = enemyAt(3, 'tank', 8);
  const hit = fire(tower('elephant'), a, [a, b, c], points);
  assert.equal(a.hp, 140);
  assert.equal(b.hp, 140);
  assert.equal(c.hp, 160);
  assert.deepEqual(hit.map((e) => e.id).sort(), [1, 2]);
});

test('penguin은 감속을, snake는 독을 건다', () => {
  const p = enemyAt(1, 'soldier', 5);
  fire(tower('penguin'), p, [p], points);
  assert.equal(p.hp, 37);
  assert.deepEqual(p.slow, { factor: 0.6, left: 1.5 });
  const s = enemyAt(2, 'soldier', 5);
  fire(tower('snake'), s, [s], points);
  assert.equal(s.hp, 38);
  assert.deepEqual(s.poison, { dps: 6, left: 3 });
});

test('eagle은 보스에게 1.5배 피해를 준다', () => {
  const boss = enemyAt(1, 'boss', 5);
  fire(tower('eagle'), boss, [boss], points);
  assert.equal(boss.hp, 1500 - 75);
  const soldier = enemyAt(2, 'tank', 5);
  fire(tower('eagle'), soldier, [soldier], points);
  assert.equal(soldier.hp, 110);
});

test('findTarget은 이미 죽은(hp <= 0) 적을 무시한다', () => {
  const dead = enemyAt(1, 'soldier', 6);
  dead.hp = 0;
  const alive = enemyAt(2, 'soldier', 5);
  assert.equal(findTarget(tower('squirrel'), [dead, alive], points), alive);
  assert.equal(findTarget(tower('squirrel'), [dead], points), null);
});
