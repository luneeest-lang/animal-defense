import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { waypointPoints } from '../js/core/path.js';
import { createEnemy } from '../js/core/enemies.js';
import { TOWERS, MAX_LEVEL, towerStats, findTarget, fire } from '../js/core/towers.js';

const points = waypointPoints(MAPS[0]);
const tower = (type, col = 5, row = 3, level = 0) => ({ id: 1, type, col, row, level, cooldown: 0, invested: 50 });
const enemyAt = (id, type, dist) => Object.assign(createEnemy(id, type, 1), { dist });

test('타워 종류와 최대 단계', () => {
  assert.deepEqual(Object.keys(TOWERS), ['squirrel', 'elephant', 'penguin', 'eagle', 'snake']);
  assert.equal(MAX_LEVEL, 3);
  for (const def of Object.values(TOWERS)) assert.equal(def.cost, undefined, '소환 비용은 모든 동물이 같다');
  assert.equal(towerStats('elephant', 0).splash, 1.0);
  assert.equal(towerStats('eagle', 0).bossMult, 1.5);
  assert.equal(towerStats('squirrel', 0).damage, TOWERS.squirrel.base.damage);
});

test('단계가 오르면 합성 재료 두 개보다 강해진다 (공격력 2.2배)', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const type of Object.keys(TOWERS)) {
    for (let lv = 1; lv <= 3; lv++) {
      const prev = towerStats(type, lv - 1);
      const cur = towerStats(type, lv);
      assert.ok(near(cur.damage, prev.damage * 2.2), `${type} ${lv} damage`);
      assert.ok(cur.cooldown < prev.cooldown, `${type} ${lv} cooldown`);
      assert.ok(cur.range > prev.range, `${type} ${lv} range`);
      if (prev.poisonDps) assert.ok(near(cur.poisonDps, prev.poisonDps * 2.2));
      if (prev.slowFactor) assert.ok(cur.slowFactor <= prev.slowFactor && cur.slowFactor >= 0.3);
    }
  }
});

test('findTarget은 사거리 안에서 가장 앞선 적을 고른다', () => {
  const near = enemyAt(1, 'soldier', 4);
  const front = enemyAt(2, 'soldier', 6);
  const far = enemyAt(3, 'soldier', 12);
  assert.equal(findTarget(tower('squirrel'), [near, front, far], points), front);
  assert.equal(findTarget(tower('squirrel'), [far], points), null);
  assert.equal(findTarget(tower('squirrel'), [], points), null);
});

test('squirrel은 대상 한 마리에게 기본 공격력만큼 피해', () => {
  const e = enemyAt(1, 'soldier', 5);
  fire(tower('squirrel'), e, [e], points);
  assert.equal(e.hp, e.maxHp - TOWERS.squirrel.base.damage);
});

test('elephant는 대상 주변 반경 1.0 안의 모든 적에게 피해를 준다', () => {
  const a = enemyAt(1, 'tank', 5);
  const b = enemyAt(2, 'tank', 5.5);
  const c = enemyAt(3, 'tank', 8);
  const hit = fire(tower('elephant'), a, [a, b, c], points);
  const dmg = TOWERS.elephant.base.damage;
  assert.equal(a.hp, a.maxHp - dmg);
  assert.equal(b.hp, b.maxHp - dmg);
  assert.equal(c.hp, c.maxHp);
  assert.deepEqual(hit.map((e) => e.id).sort(), [1, 2]);
});

test('penguin은 감속을, snake는 독을 건다', () => {
  const p = enemyAt(1, 'soldier', 5);
  fire(tower('penguin'), p, [p], points);
  const pb = TOWERS.penguin.base;
  assert.equal(p.hp, p.maxHp - pb.damage);
  assert.deepEqual(p.slow, { factor: pb.slowFactor, left: pb.slowDuration });
  const s = enemyAt(2, 'soldier', 5);
  fire(tower('snake'), s, [s], points);
  const sb = TOWERS.snake.base;
  assert.equal(s.hp, s.maxHp - sb.damage);
  assert.deepEqual(s.poison, { dps: sb.poisonDps, left: sb.poisonDuration, by: 'snake' });
});

test('eagle은 보스에게 1.5배 피해를 준다', () => {
  const boss = enemyAt(1, 'boss', 5);
  fire(tower('eagle'), boss, [boss], points);
  const eb = TOWERS.eagle.base;
  assert.equal(boss.hp, boss.maxHp - eb.damage * 1.5);
  const tank = enemyAt(2, 'tank', 5);
  fire(tower('eagle'), tank, [tank], points);
  assert.equal(tank.hp, tank.maxHp - eb.damage);
});

test('findTarget은 이미 죽은(hp <= 0) 적을 무시한다', () => {
  const dead = enemyAt(1, 'soldier', 6);
  dead.hp = 0;
  const alive = enemyAt(2, 'soldier', 5);
  assert.equal(findTarget(tower('squirrel'), [dead, alive], points), alive);
  assert.equal(findTarget(tower('squirrel'), [dead], points), null);
});

test('강화 레벨마다 공격력과 독 피해 +20%, 펭귄 감속 시간 +10% (사거리·속도는 그대로)', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const type of Object.keys(TOWERS)) {
    const base = towerStats(type, 1, 0);
    const up = towerStats(type, 1, 3);
    assert.ok(near(up.damage, base.damage * 1.6), type);
    assert.equal(up.range, base.range);
    assert.equal(up.cooldown, base.cooldown);
    if (base.poisonDps) assert.ok(near(up.poisonDps, base.poisonDps * 1.6));
    if (base.slowDuration) assert.ok(near(up.slowDuration, base.slowDuration * 1.3));
  }
  assert.deepEqual(towerStats('squirrel', 0), towerStats('squirrel', 0, 0));
});
