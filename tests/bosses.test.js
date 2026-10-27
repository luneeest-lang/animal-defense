import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { ENEMIES } from '../js/data/enemies.js';
import { createGame, addTower, step, spawnEnemy } from '../js/core/game.js';
import { damageEnemy } from '../js/core/enemies.js';

const [easy, normal] = MAPS;
// 보스를 길 위에 바로 놓는다 (웨이브 진행 없이)
const withBoss = (map, type, dist = 3) => {
  const g = createGame(map);
  g.countdown = null;
  const boss = spawnEnemy(g, type, 1, dist);
  return { g, boss };
};

test('보스 능력은 중급·고급에서만 켜진다', () => {
  assert.deepEqual(MAPS.map((m) => !!m.bossAbilities), [false, true, true]);
});

test('모든 보스는 이름과 능력 설명이 있다', () => {
  for (const id of ['boss', 'slimeKing', 'lich', 'lavaGolem', 'shadowWolf', 'dragon']) {
    assert.ok(ENEMIES[id].name && ENEMIES[id].skill, id);
  }
});

test('붉은 악마 (분노): 체력이 절반 아래로 떨어지면 1.5배 빨라진다', () => {
  const { g, boss } = withBoss(normal, 'boss');
  const d0 = boss.dist;
  step(g, 1);
  const normalSpeed = boss.dist - d0;
  boss.hp = boss.maxHp * 0.4;
  const d1 = boss.dist;
  step(g, 1);
  assert.ok(Math.abs((boss.dist - d1) - normalSpeed * 1.5) < 1e-6);
  assert.ok(g.events.some((e) => e.type === 'bossSkill' && e.skill === 'rage'));
});

test('슬라임 왕 (분열): 체력 75%·50%·25%마다 작은 슬라임 2마리, 한 번에 여러 구간을 넘으면 그만큼', () => {
  const { g, boss } = withBoss(normal, 'slimeKing');
  boss.hp = boss.maxHp * 0.7;
  step(g, 0.05);
  assert.equal(g.enemies.filter((e) => e.type === 'mini').length, 2);
  boss.hp = boss.maxHp * 0.2;
  step(g, 0.05);
  assert.equal(g.enemies.filter((e) => e.type === 'mini').length, 6);
  step(g, 1);
  assert.equal(g.enemies.filter((e) => e.type === 'mini').length, 6);
});

test('리치 왕 (부하 소환): 5초마다 방패병 1마리, 최대 6마리', () => {
  const { g } = withBoss(normal, 'lich', 0);
  step(g, 4.9);
  assert.equal(g.enemies.filter((e) => e.type === 'shield').length, 0);
  step(g, 0.2);
  assert.equal(g.enemies.filter((e) => e.type === 'shield').length, 1);
  step(g, 40);
  const shields = g.enemies.filter((e) => e.type === 'shield').length;
  assert.ok(shields <= 6, String(shields));
});

test('용암 거인 (단단함): 모든 피해를 30% 덜 받는다', () => {
  const { boss } = withBoss(normal, 'lavaGolem');
  damageEnemy(boss, 100, 'direct');
  damageEnemy(boss, 100, 'poison');
  assert.ok(Math.abs((boss.maxHp - boss.hp) - 140) < 1e-9);
});

test('그림자 늑대 (질주): 6초마다 1.5초 동안 3배 빠르다', () => {
  const { g, boss } = withBoss(normal, 'shadowWolf', 0);
  const base = ENEMIES.shadowWolf.speed;
  step(g, 5.9);
  const d = boss.dist;
  step(g, 0.2);
  assert.ok(g.events.some((e) => e.type === 'bossSkill' && e.skill === 'dash'));
  step(g, 1);
  assert.ok(boss.dist - d > base * 2.5, String(boss.dist - d));
});

test('흑룡 (포효): 8초마다 2.5칸 안 동물을 2초 기절시키고, 기절한 동물은 공격하지 않는다', () => {
  const g = createGame(normal);
  g.countdown = null;
  const near = addTower(g, 'squirrel', 4, 2);
  const far = addTower(g, 'squirrel', 14, 7);
  const dragon = spawnEnemy(g, 'dragon', 1, 2);
  dragon.speedMult = 0; // 제자리에서 확인
  step(g, 8.05);
  assert.ok(near.stunUntil > g.time, '가까운 동물은 기절');
  assert.ok(!(far.stunUntil > g.time), '먼 동물은 멀쩡');
  const hp = dragon.hp;
  step(g, 1);
  assert.equal(dragon.hp, hp, '기절한 동물은 쏘지 않는다');
  step(g, 1.5);
  const hp2 = dragon.hp;
  step(g, 0.5);
  assert.ok(dragon.hp < hp2, '기절이 풀리면 다시 쏜다');
});

test('초급에서는 보스 능력이 없다', () => {
  const { g, boss } = withBoss(easy, 'lich', 0);
  step(g, 12);
  assert.equal(g.enemies.filter((e) => e.type === 'shield').length, 0);
  const golem = withBoss(easy, 'lavaGolem').boss;
  damageEnemy(golem, 100, 'direct');
  assert.ok(Math.abs((golem.maxHp - golem.hp) - 100) < 1e-9);
  assert.ok(boss);
});
