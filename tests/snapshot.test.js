import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import {
  createGame, addTower, emptyCells, callNextWave, step, chooseCard, CONFIG,
} from '../js/core/game.js';
import { craftMythic, RECIPE_LEVELS } from '../js/core/mythics.js';
import { MYTHICS } from '../js/data/mythics.js';
import { snapshotGame, restoreGame, isBetweenWaves } from '../js/core/snapshot.js';
import { RUN_KEY, loadRun, writeRun, clearRun } from '../js/storage.js';

const forest = MAPS[1];
const memStore = () => {
  const data = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};

function midGame() {
  const g = createGame(forest);
  const cells = emptyCells(g);
  addTower(g, 'squirrel', ...cells[0], 1).invested = 100;
  addTower(g, 'eagle', ...cells[1], 0).invested = 50;
  MYTHICS.girin.recipe.forEach((t, i) => addTower(g, t, ...cells[2 + i], RECIPE_LEVELS[i]));
  craftMythic(g, 'girin');
  Object.assign(g, { gold: 321, lives: 17, waveNumber: 6, clearedWave: 6, summons: 9, countdown: 4.2 });
  g.upgrades.eagle = 2;
  g.mods.damage.snake = 1.3;
  g.mods.attackSpeed = 1.1;
  g.cardsTaken = ['train:snake', 'haste'];
  return g;
}

test('웨이브 사이(적도 스폰 예정도 없고 카운트다운이나 카드 고르기 중)에만 저장할 수 있다', () => {
  const g = createGame(forest);
  assert.equal(isBetweenWaves(g), true);
  callNextWave(g);
  step(g, 0.5);
  assert.equal(isBetweenWaves(g), false);
  g.enemies = [];
  g.spawnQueue = [];
  g.countdown = null;
  g.cardChoices = ['haste', 'eye', 'heal'];
  assert.equal(isBetweenWaves(g), true);
  g.status = 'lost';
  assert.equal(isBetweenWaves(g), false);
});

test('저장했다가 되살리면 골드·생명·웨이브·동물·강화·카드가 그대로다', () => {
  const g = midGame();
  const snap = JSON.parse(JSON.stringify(snapshotGame(g)));
  const r = restoreGame(snap);
  assert.equal(r.map, forest);
  for (const k of ['gold', 'lives', 'waveNumber', 'clearedWave', 'summons']) assert.equal(r[k], g[k], k);
  assert.deepEqual(r.upgrades, g.upgrades);
  assert.deepEqual(r.mods, g.mods);
  assert.deepEqual(r.cardsTaken, g.cardsTaken);
  const shape = (t) => [t.id, t.type, t.level, t.col, t.row, t.invested, !!t.mythic];
  assert.deepEqual(r.towers.map(shape), g.towers.map(shape));
  assert.ok(r.nextId > Math.max(...r.towers.map((t) => t.id)));
  // 되살린 게임은 다음 웨이브까지 카운트다운을 처음부터 다시 센다
  assert.equal(r.countdown, CONFIG.waveGap);
  assert.deepEqual([r.enemies, r.spawnQueue, r.zones, r.status], [[], [], [], 'running']);
});

test('카드를 고르던 중에 저장하면 같은 카드 3장이 다시 나온다', () => {
  const g = midGame();
  g.countdown = null;
  g.cardChoices = ['haste', 'eye', 'treasure'];
  const r = restoreGame(snapshotGame(g));
  assert.deepEqual(r.cardChoices, ['haste', 'eye', 'treasure']);
  assert.equal(chooseCard(r, 'eye'), true);
});

test('첫 웨이브 전이면 첫 카운트다운으로 되살린다', () => {
  const g = createGame(forest);
  addTower(g, 'snake', ...emptyCells(g)[0]);
  const r = restoreGame(snapshotGame(g));
  assert.equal(r.countdown, CONFIG.firstCountdown);
});

test('망가지거나 이상한 저장은 되살리지 않는다', () => {
  const good = snapshotGame(midGame());
  const bad = [
    null, 42, 'x', {}, { ...good, version: 9 }, { ...good, mapId: 'nope' }, { ...good, gold: 'many' },
    { ...good, lives: 0 }, { ...good, waveNumber: 30 }, { ...good, towers: [{ type: 'dragon', level: 0, col: 0, row: 0, invested: 0 }] },
    { ...good, towers: [good.towers[0], { ...good.towers[1], col: good.towers[0].col, row: good.towers[0].row }] },
    { ...good, cardChoices: ['nope', 'eye', 'heal'] },
  ];
  for (const s of bad) assert.equal(restoreGame(s), null, JSON.stringify(s)?.slice(0, 80));
});

test('저장소: 쓰고 읽고 지울 수 있고, 저장소가 막혀도 오류 없이 넘어간다', () => {
  const store = memStore();
  assert.equal(loadRun(store), null);
  const snap = snapshotGame(midGame());
  assert.equal(writeRun(store, snap), true);
  assert.ok(store.data[RUN_KEY]);
  assert.deepEqual(loadRun(store), JSON.parse(JSON.stringify(snap)));
  clearRun(store);
  assert.equal(loadRun(store), null);
  store.data[RUN_KEY] = '{broken';
  assert.equal(loadRun(store), null);
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(loadRun(blocked), null);
  assert.equal(writeRun(blocked, snap), false);
  clearRun(blocked);
});

test('미션·황금 몬스터 일정과 진행도 저장되고, 예전 저장(이 정보 없음)도 되살린다', async () => {
  const { startMission } = await import('../js/core/missions.js');
  const g = midGame();
  g.schedule = { golden: [12, 18], missions: [9, 21] };
  g.counters.kills = 77;
  startMission(g, 'kill');
  const r = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
  assert.deepEqual(r.schedule, { golden: [12, 18], missions: [9, 21] });
  assert.equal(r.counters.kills, 77);
  assert.deepEqual(r.mission, g.mission);
  const old = snapshotGame(midGame());
  delete old.schedule; delete old.mission; delete old.counters; delete old.lastMission;
  const r2 = restoreGame(old);
  assert.ok(r2);
  assert.equal(r2.mission, null);
  assert.equal(r2.schedule.golden.length, 4);
});
