import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { createGame, addTower, step } from '../js/core/game.js';
import { createEnemy } from '../js/core/enemies.js';
import { snapshotGame, restoreGame } from '../js/core/snapshot.js';
import { resultStats } from '../js/core/stats.js';

const meadow = MAPS[0];
function field(type, enemyType = 'soldier') {
  const g = createGame(meadow);
  g.countdown = null;
  const t = addTower(g, type, 5, 3);
  const e = createEnemy(g.nextId++, enemyType, 1);
  e.dist = 5;
  g.enemies.push(e);
  return { g, t, e };
}

test('동물이 준 피해와 처치를 동물 종류별로 센다 (넘친 피해는 세지 않는다)', () => {
  const { g, e } = field('eagle'); // 한 방(50)에 병사(42)를 잡는다
  const hp = e.maxHp;
  step(g, 0.05);
  assert.equal(g.enemies.length, 0);
  assert.ok(Math.abs(g.stats.damage.eagle - hp) < 1e-9, String(g.stats.damage.eagle));
  assert.equal(g.stats.kills.eagle, 1);
});

test('뱀의 독 피해도 뱀 몫이다', () => {
  const { g, e } = field('snake', 'tank');
  step(g, 0.05);
  const afterHit = g.stats.damage.snake;
  e.dist = 5;
  step(g, 1);
  assert.ok(g.stats.damage.snake > afterHit, '독이 들어가면서 늘어난다');
  assert.ok(Math.abs(g.stats.damage.snake - (e.maxHp - e.hp)) < 1e-6);
});

test('놓친 몬스터 수와 실제 플레이 시간을 센다', () => {
  const g = createGame(meadow);
  g.countdown = null;
  const e = createEnemy(g.nextId++, 'soldier', 1);
  e.dist = g.length + 1;
  g.enemies.push(e);
  step(g, 0.05);
  assert.equal(g.stats.leaked, 1);
  g.stats.playTime = 0;
  assert.equal(g.stats.playTime, 0);
});

test('결과 통계: 피해량 순서, 비율, 처치·놓침·시간 요약', () => {
  const g = createGame(meadow);
  g.stats.damage = { squirrel: 300, eagle: 600, phoenix: 100 };
  g.stats.kills = { squirrel: 5, eagle: 3, phoenix: 2 };
  g.stats.leaked = 4;
  g.stats.playTime = 125;
  g.counters.kills = 10;
  const r = resultStats(g);
  assert.deepEqual(r.ranking.map((x) => x.id), ['eagle', 'squirrel', 'phoenix']);
  assert.equal(r.ranking[0].share, 0.6);
  assert.equal(r.ranking[0].kills, 3);
  assert.equal(r.ranking[2].mythic, true);
  assert.equal(r.kills, 10);
  assert.equal(r.leaked, 4);
  assert.equal(r.time, '2:05');
  assert.equal(resultStats(createGame(meadow)).ranking.length, 0);
});

test('이어하기에 통계도 저장되고, 예전 저장(통계 없음)도 되살아난다', () => {
  const g = createGame(meadow);
  g.stats.damage = { squirrel: 123.5 };
  g.stats.kills = { squirrel: 4 };
  g.stats.leaked = 2;
  g.stats.playTime = 61;
  const back = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
  assert.deepEqual(back.stats, g.stats);
  const old = snapshotGame(createGame(meadow));
  delete old.stats;
  assert.deepEqual(restoreGame(old).stats, { damage: {}, kills: {}, leaked: 0, playTime: 0 });
  assert.deepEqual(restoreGame({ ...old, stats: { damage: { nope: 5 }, kills: {}, leaked: 0, playTime: 0 } }).stats.damage, {}, '모르는 동물은 버린다');
});

test('처치는 그 적에게 피해를 가장 많이 준 동물 몫이다 (마지막 한 방이 아니라)', async () => {
  const { credit, creditKill } = await import('../js/core/stats.js');
  const g = createGame(meadow);
  const e = createEnemy(g.nextId++, 'soldier', 1);
  let before = e.hp; e.hp -= 30; credit(g, e, 'eagle', before);
  before = e.hp; e.hp -= 20; credit(g, e, 'phoenix', before);
  creditKill(g, e);
  assert.equal(g.stats.kills.eagle, 1);
  assert.equal(g.stats.kills.phoenix, undefined);
});
