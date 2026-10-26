import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { pathLength } from '../js/core/path.js';
import { createEnemy } from '../js/core/enemies.js';
import {
  CONFIG, createGame, addTower, summonCost, emptyCells, summonTower, canMerge, mergeTowers,
  sellTower, callNextWave, step,
} from '../js/core/game.js';

const meadow = MAPS[0];
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const oneSoldier = [{ number: 1, groups: [{ type: 'soldier', count: 1, interval: 1 }] }];
const inject = (game, type, dist, hp) => {
  const e = createEnemy(game.nextId++, type, 1);
  e.dist = dist;
  if (hp !== undefined) e.hp = hp;
  game.enemies.push(e);
  return e;
};

test('새 게임의 초기 상태', () => {
  const g = createGame(meadow);
  assert.equal(g.gold, 150);
  assert.equal(g.lives, 20);
  assert.equal(g.waveNumber, 0);
  assert.equal(g.countdown, 10);
  assert.equal(g.status, 'running');
  assert.equal(g.waves.length, 15);
  assert.equal(g.summons, 0);
  assert.equal(summonCost(g), 50);
});

test('소환: 비용을 내고 무작위 빈 칸에 아기 동물이 생기며, 다음 비용은 5 오른다', () => {
  const g = createGame(meadow);
  const first = emptyCells(g)[0];
  const t = summonTower(g, seq(0));
  assert.deepEqual([t.type, t.col, t.row, t.level, t.invested], ['squirrel', first[0], first[1], 0, 50]);
  assert.equal(g.gold, 100);
  assert.equal(summonCost(g), 55);
  const cells = emptyCells(g);
  const t2 = summonTower(g, seq(0.999999));
  assert.deepEqual([t2.type, t2.col, t2.row, t2.invested], ['snake', ...cells[cells.length - 1], 55]);
  assert.equal(g.gold, 45);
  assert.equal(summonCost(g), 60);
});

test('rng 값으로 동물과 칸이 정해진다', () => {
  const g = createGame(meadow);
  const cells = emptyCells(g);
  const t = summonTower(g, seq(0.5, 0.5));
  assert.equal(t.type, 'penguin');
  assert.deepEqual([t.col, t.row], cells[Math.floor(0.5 * cells.length)]);
});

test('골드가 모자라거나 빈 칸이 없으면 소환이 거절되고 아무것도 바뀌지 않는다', () => {
  const g = createGame(meadow);
  g.gold = 49;
  assert.equal(summonTower(g, seq(0)), null);
  assert.deepEqual([g.gold, g.summons, g.towers.length], [49, 0, 0]);
  for (const [c, r] of emptyCells(g)) addTower(g, 'squirrel', c, r);
  g.gold = 1000;
  assert.equal(emptyCells(g).length, 0);
  assert.equal(summonTower(g, seq(0)), null);
  assert.deepEqual([g.gold, g.summons], [1000, 0]);
});

test('addTower는 길, 장애물, 격자 밖, 이미 있는 칸에 놓지 않는다', () => {
  const g = createGame(meadow);
  assert.ok(addTower(g, 'squirrel', 5, 4));
  for (const [c, r] of [[5, 2], [7, 4], [-1, 0], [16, 0], [5, 4]]) {
    assert.equal(addTower(g, 'squirrel', c, r), null, `${c},${r}`);
  }
  assert.equal(addTower(g, 'nope', 6, 4), null);
  assert.equal(g.towers.length, 1);
});

test('같은 동물, 같은 단계끼리만 합성되고 놓인 자리의 타워가 성장한다', () => {
  const g = createGame(meadow);
  const a = addTower(g, 'squirrel', 5, 4);
  const b = addTower(g, 'squirrel', 6, 4);
  const c = addTower(g, 'elephant', 9, 4);
  const d = addTower(g, 'squirrel', 10, 4, 1);
  a.invested = 50;
  b.invested = 55;
  assert.equal(canMerge(g, a.id, c.id), false);
  assert.equal(canMerge(g, a.id, d.id), false);
  assert.equal(canMerge(g, a.id, a.id), false);
  assert.equal(canMerge(g, a.id, 9999), false);
  assert.equal(mergeTowers(g, a.id, c.id), false);
  assert.equal(mergeTowers(g, a.id, b.id), true);
  assert.deepEqual([b.level, b.invested, b.col, b.row], [1, 105, 6, 4]);
  assert.ok(!g.towers.includes(a));
  assert.equal(g.towers.length, 3);
  assert.equal(mergeTowers(g, d.id, b.id), true);
  assert.equal(b.level, 2);
});

test('각성(마지막) 단계는 더 합칠 수 없다', () => {
  const g = createGame(meadow);
  const a = addTower(g, 'eagle', 5, 4, 3);
  const b = addTower(g, 'eagle', 6, 4, 3);
  assert.equal(canMerge(g, a.id, b.id), false);
  assert.equal(mergeTowers(g, a.id, b.id), false);
  assert.equal(g.towers.length, 2);
});

test('판매하면 들어간 소환 비용 합계의 70%를 내림해 돌려받고 칸이 비워진다', () => {
  const g = createGame(meadow);
  const a = summonTower(g, seq(0));
  const b = summonTower(g, seq(0));
  mergeTowers(g, a.id, b.id);
  g.gold = 0;
  assert.equal(sellTower(g, b.id), 73);
  assert.equal(g.gold, 73);
  assert.equal(g.towers.length, 0);
  assert.equal(sellTower(g, b.id), 0);
  assert.ok(addTower(g, 'squirrel', b.col, b.row));
});

test('다음 웨이브 호출: 보너스를 주고 연달아 눌러도 한 번만 시작한다', () => {
  const g = createGame(meadow);
  assert.equal(callNextWave(g), 10);
  assert.equal(g.waveNumber, 1);
  assert.equal(g.gold, 160);
  assert.equal(callNextWave(g), 0);
  assert.equal(g.waveNumber, 1);
  assert.equal(g.gold, 160);
});

test('보너스는 남은 카운트다운을 올림한 값이다', () => {
  const g = createGame(meadow);
  g.countdown = 6.2;
  assert.equal(callNextWave(g), 7);
  assert.equal(g.gold, 157);
});

test('카운트다운이 끝나면 웨이브가 자동 시작되고, 스폰이 끝나면 웨이브 간격 카운트다운이 시작된다', () => {
  const g = createGame(meadow, oneSoldier.concat([{ number: 2, groups: [{ type: 'soldier', count: 1, interval: 1 }] }]));
  step(g, 10.1);
  assert.equal(g.waveNumber, 1);
  assert.equal(g.enemies.length, 1);
  assert.ok(g.countdown > CONFIG.waveGap - 1 && g.countdown <= CONFIG.waveGap);
});

test('마지막 웨이브를 시작하면 카운트다운이 더 이상 생기지 않는다', () => {
  const g = createGame(meadow, oneSoldier);
  callNextWave(g);
  step(g, 0.05);
  assert.equal(g.countdown, null);
  assert.equal(callNextWave(g), 0);
});

test('처치하면 보상을 한 번만 받는다', () => {
  const g = createGame(meadow);
  addTower(g, 'squirrel', 5, 3);
  inject(g, 'soldier', 5, 8);
  step(g, 0.05);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.gold, 155);
  step(g, 0.05);
  assert.equal(g.gold, 155);
  assert.ok(g.events.every((e) => e.type !== 'death'));
});

test('분열체가 죽으면 작은 적 둘이 같은 자리에 생기고 분열체 보상만 받는다', () => {
  const g = createGame(meadow);
  addTower(g, 'squirrel', 5, 3);
  inject(g, 'splitter', 5, 1);
  step(g, 0.05);
  assert.equal(g.enemies.length, 2);
  for (const m of g.enemies) {
    assert.equal(m.type, 'mini');
    assert.ok(Math.abs(m.dist - 5.05) < 0.2);
  }
  assert.equal(g.gold, 150 + 8);
});

test('끝까지 간 적은 생명을 깎고 보상은 없다. 보스는 5', () => {
  const g = createGame(meadow);
  const len = pathLength(g.points);
  inject(g, 'soldier', len - 0.01);
  step(g, 0.05);
  assert.equal(g.lives, 19);
  assert.equal(g.gold, 150);
  assert.equal(g.enemies.length, 0);
  inject(g, 'boss', len - 0.01);
  step(g, 0.05);
  assert.equal(g.lives, 14);
});

test('생명이 0이 되면 패배하고 이후 step은 상태를 바꾸지 않는다', () => {
  const g = createGame(meadow);
  g.lives = 1;
  inject(g, 'soldier', pathLength(g.points));
  step(g, 0.05);
  assert.equal(g.status, 'lost');
  assert.equal(g.lives, 0);
  const t = g.time;
  step(g, 5);
  assert.equal(g.time, t);
  g.gold = 1000;
  assert.equal(summonTower(g, seq(0)), null);
});

test('모든 웨이브를 스폰하고 적이 사라지면 승리한다', () => {
  const g = createGame(meadow, oneSoldier);
  addTower(g, 'squirrel', 5, 3);
  callNextWave(g);
  step(g, 40);
  assert.equal(g.status, 'won');
});

test('매우 큰 dt도 작은 dt를 반복한 것과 같은 결과다', () => {
  const make = () => {
    const g = createGame(meadow);
    addTower(g, 'squirrel', 5, 3);
    return g;
  };
  const big = make();
  step(big, 60);
  const small = make();
  for (let i = 0; i < 1200; i++) step(small, 0.05);
  for (const key of ['gold', 'lives', 'status', 'waveNumber']) assert.equal(big[key], small[key], key);
  assert.equal(big.enemies.length, small.enemies.length);
  assert.ok(big.waveNumber >= 1);
  assert.ok(CONFIG.maxSubstep <= 0.05);
});

test('같은 틱에 한 타워가 죽인 적을 다른 타워가 또 노리지 않는다', () => {
  const g = createGame(meadow);
  addTower(g, 'squirrel', 5, 3);
  addTower(g, 'squirrel', 6, 3);
  inject(g, 'soldier', 5, 8);
  inject(g, 'soldier', 4.5, 8);
  const gold = g.gold;
  step(g, 0.05);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.gold, gold + 10);
});

test('타워는 정해진 공격 간격대로 쏜다 (프레임 크기에 따라 느려지지 않는다)', () => {
  const g = createGame(meadow);
  g.countdown = null; // 웨이브가 시작되어 다른 적을 노리지 않게 한다
  addTower(g, 'squirrel', 5, 3);
  const target = inject(g, 'boss', 5, 1e9);
  for (let i = 0; i < 2000; i++) {
    target.dist = 5;
    step(g, 0.05);
  }
  const shots = (1e9 - target.hp) / 8;
  assert.ok(shots >= 165 && shots <= 168, `shots ${shots}`);
});

test('게임이 끝난 뒤에는 호출, 소환, 합성, 판매가 모두 거절된다', () => {
  const g = createGame(meadow);
  const a = addTower(g, 'squirrel', 5, 4);
  const b = addTower(g, 'squirrel', 6, 4);
  g.gold = 1000;
  g.status = 'lost';
  assert.equal(callNextWave(g), 0);
  assert.equal(summonTower(g, seq(0)), null);
  assert.equal(mergeTowers(g, a.id, b.id), false);
  assert.equal(sellTower(g, a.id), 0);
  assert.equal(g.towers.length, 2);
  assert.equal(g.gold, 1000);
});

test('발사 이벤트에는 쏜 타워의 id가 담긴다', () => {
  const g = createGame(meadow);
  const t = addTower(g, 'squirrel', 5, 3);
  inject(g, 'tank', 5);
  step(g, 0.05);
  const shot = g.events.find((e) => e.type === 'shot');
  assert.equal(shot.towerId, t.id);
});
