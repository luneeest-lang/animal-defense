import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { ENEMIES } from '../js/data/enemies.js';
import {
  createGame, addTower, emptyCells, spawnEnemy, step, callNextWave, upgradeAnimal, mergeTowers, CONFIG,
} from '../js/core/game.js';
import {
  rollSchedule, MISSIONS, startMission, missionText, goldenReward, GOLDEN_LAST_WAVE, MISSION_LAST_WAVE,
} from '../js/core/missions.js';
import { isBossWave, buildWaves } from '../js/core/waves.js';

const meadow = MAPS[0];
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };
const quiet = (g) => {
  g.waves = g.waves.map((w) => ({ ...w, groups: [] }));
  g.schedule = { golden: [], missions: [] };
  return g;
};

test('판마다 황금 몬스터 1번은 3~25웨이브의 일반 웨이브에서, 미션 1번은 2~24웨이브에서 무작위로 정해진다', () => {
  assert.equal(GOLDEN_LAST_WAVE, 25);
  assert.equal(MISSION_LAST_WAVE, 25);
  const waves = buildWaves();
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const s = rollSchedule(lcg(seed * 99991 + 7));
    assert.equal(s.golden.length, 1);
    for (const w of s.golden) {
      assert.ok(w >= 3 && w <= 25 && !isBossWave(waves[w - 1]), String(w));
    }
    assert.equal(s.missions.length, 1);
    assert.ok(s.missions.every((w) => w >= 2 && w <= 24));
    assert.deepEqual(s.missions, [...s.missions].sort((a, b) => a - b));
    seen.add(`${s.golden}/${s.missions}`);
  }
  assert.ok(seen.size > 15, '판마다 다르다');
});

test('황금 몬스터: 빠르고, 잡으면 골드 50 + 웨이브×5, 놓쳐도 생명은 그대로', () => {
  assert.ok(ENEMIES.golden.speed > ENEMIES.runner.speed);
  assert.equal(ENEMIES.golden.leak, 0);
  assert.equal(goldenReward(10), 100);
  const g = quiet(createGame(meadow));
  g.waveNumber = 10;
  g.countdown = null;
  g.clearedWave = 99;
  const e = spawnEnemy(g, 'golden', 10);
  assert.ok(g.events.some((ev) => ev.type === 'goldenSpawn'));
  e.hp = 0;
  const gold = g.gold;
  step(g, 0.01);
  assert.equal(g.gold - gold, 100);
  assert.equal(g.counters.golden, 1);
  const run = spawnEnemy(g, 'golden', 10, g.length - 0.01);
  run.hp = run.maxHp = 1e9;
  step(g, 0.05);
  assert.equal(g.lives, CONFIG.startLives);
  assert.ok(g.events.some((ev) => ev.type === 'goldenEscape'));
  assert.ok(!g.events.some((ev) => ev.type === 'leak'));
});

test('정해진 웨이브가 되면 황금 몬스터가 그 웨이브 도중 한 번 나온다', () => {
  const g = createGame(meadow);
  g.schedule = { golden: [1], missions: [] };
  g.rng = seq(0.5);
  callNextWave(g);
  const goldens = g.spawnQueue.filter((s) => s.type === 'golden');
  assert.equal(goldens.length, 1);
  const last = Math.max(...g.spawnQueue.map((s) => s.at));
  assert.ok(goldens[0].at > g.time && goldens[0].at <= last);
});

test('미션은 정해진 웨이브에 시작하고, 진행 중이면 다음 웨이브로 미뤄지며 25웨이브가 넘으면 시작하지 않는다', () => {
  const g = quiet(createGame(meadow));
  g.schedule.missions = [2, 3];
  g.rng = seq(0);
  callNextWave(g);
  assert.equal(g.mission, null);
  g.countdown = 1;
  callNextWave(g);
  assert.ok(g.mission, '2웨이브에 시작');
  assert.ok(g.events.some((ev) => ev.type === 'missionStart'));
  const first = g.mission;
  g.countdown = 1;
  callNextWave(g);
  assert.equal(g.mission, first, '진행 중이면 3웨이브 미션은 미뤄진다');
  const late = quiet(createGame(meadow));
  late.schedule.missions = [24];
  late.waveNumber = 25;
  late.countdown = 1;
  callNextWave(late);
  assert.equal(late.mission, null, '26웨이브에는 미뤄진 미션도 시작하지 않는다');
});

test('미션 목록과 문구', () => {
  assert.deepEqual(Object.keys(MISSIONS), ['kill', 'noLeak', 'awaken', 'trio', 'golden', 'skip', 'upgrade', 'mythic']);
  const g = createGame(meadow);
  g.waveNumber = 6;
  startMission(g, 'kill');
  // 6·7웨이브에 나올 40마리의 85%
  assert.equal(g.mission.goal, 34);
  assert.equal(missionText(g.mission), '몬스터 34마리 처치 (0/34)');
});

test('처치 미션: 기한 안에 목표 수만큼 잡으면 골드 보상', () => {
  const g = createGame(meadow);
  g.waveNumber = 6;
  startMission(g, 'kill');
  quiet(g);
  g.countdown = null;
  g.clearedWave = 99;
  const { goal, reward } = g.mission;
  assert.ok(reward.gold > 0);
  const gold = g.gold;
  for (let i = 0; i < goal; i++) spawnEnemy(g, 'soldier', 1).hp = 0;
  step(g, 0.01);
  assert.equal(g.mission, null);
  assert.ok(g.events.some((ev) => ev.type === 'missionDone' && ev.mission === 'kill'));
  assert.equal(g.gold - gold, reward.gold + goal * 5);
});

test('기한이 지나면 미션은 실패하고 사라진다', () => {
  const g = quiet(createGame(meadow));
  g.waveNumber = 4;
  startMission(g, 'kill');
  g.waveNumber = g.mission.deadline;
  g.countdown = 1;
  callNextWave(g);
  assert.equal(g.mission, null);
  assert.ok(g.events.some((ev) => ev.type === 'missionFail'));
});

test('건너뛰기·강화·각성 미션은 행동 횟수로 깬다', () => {
  const g = quiet(createGame(meadow));
  g.gold = 99999;
  g.waveNumber = 3;
  startMission(g, 'upgrade');
  upgradeAnimal(g, 'eagle');
  upgradeAnimal(g, 'eagle');
  step(g, 0.01);
  assert.equal(g.mission, null);

  g.waveNumber = 3;
  startMission(g, 'awaken');
  const cells = emptyCells(g);
  const a = addTower(g, 'squirrel', ...cells[0], 2);
  const b = addTower(g, 'squirrel', ...cells[1], 2);
  mergeTowers(g, a.id, b.id, seq(0));
  step(g, 0.01);
  assert.equal(g.mission, null);
  assert.ok(g.events.some((ev) => ev.type === 'missionDone' && ev.mission === 'awaken'));
});

test('같은 동물 3마리 미션은 그 동물 강화 1단계를 무료로 준다', () => {
  const g = quiet(createGame(meadow));
  g.waveNumber = 3;
  startMission(g, 'trio');
  const cells = emptyCells(g);
  for (let i = 0; i < 3; i++) addTower(g, 'penguin', ...cells[i]);
  step(g, 0.01);
  assert.equal(g.mission, null);
  assert.equal(g.upgrades.penguin, 1);
});

test('생명을 잃지 않고 웨이브를 끝내면 생명 +2', () => {
  const g = createGame(meadow, [
    { number: 1, groups: [{ type: 'soldier', count: 1, interval: 1 }] },
    { number: 2, groups: [{ type: 'soldier', count: 1, interval: 1 }] },
  ]);
  g.schedule = { golden: [], missions: [] };
  startMission(g, 'noLeak');
  callNextWave(g);
  step(g, 0.1);
  g.enemies[0].hp = 0;
  step(g, 0.05);
  assert.equal(g.lives, CONFIG.startLives + 2);
});
