import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../js/data/enemies.js';
import { buildWaves, spawnSchedule, isBossWave, BOSS_INTRO } from '../js/core/waves.js';

const waves = buildWaves();
const count = (wave, type) => wave.groups.filter((g) => g.type === type).reduce((s, g) => s + g.count, 0);

test('웨이브는 30개이고 번호는 1부터 30이다', () => {
  assert.equal(waves.length, 30);
  assert.deepEqual(waves.map((w) => w.number), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('5웨이브마다 서로 다른 보스가 1마리씩만 나온다 (마지막은 흑룡)', () => {
  const bossWaves = waves.filter(isBossWave);
  assert.deepEqual(bossWaves.map((w) => w.number), [5, 10, 15, 20, 25, 30]);
  assert.deepEqual(bossWaves.map((w) => w.groups.map((g) => [g.type, g.count])),
    [[['boss', 1]], [['slimeKing', 1]], [['lich', 1]], [['lavaGolem', 1]], [['shadowWolf', 1]], [['dragon', 1]]]);
  for (const w of bossWaves) assert.ok(ENEMIES[w.groups[0].type].boss);
});

test('새 적은 정해진 웨이브부터 섞여 나온다', () => {
  const first = (type) => waves.find((w) => count(w, type) > 0).number;
  assert.equal(first('runner'), 3);
  assert.equal(first('splitter'), 4);
  assert.equal(first('tank'), 6);
  assert.equal(first('shield'), 8);
});

test('모든 웨이브가 비어 있지 않고 정의된 적만 쓴다', () => {
  for (const w of waves) {
    assert.ok(w.groups.length > 0);
    for (const g of w.groups) {
      assert.ok(ENEMIES[g.type] && g.type !== 'mini', `unknown type ${g.type}`);
      assert.ok(g.count > 0 && g.interval > 0);
    }
  }
});

test('보스 웨이브(5의 배수)는 보스 1마리만, 나머지 웨이브는 정확히 20마리다', () => {
  for (const w of waves) {
    const total = w.groups.reduce((s, g) => s + g.count, 0);
    if (w.number % 5 === 0) {
      assert.ok(isBossWave(w), `wave ${w.number}`);
      assert.equal(w.groups.length, 1);
      assert.equal(total, 1);
    } else {
      assert.ok(!isBossWave(w), `wave ${w.number}`);
      assert.equal(total, 20, `wave ${w.number}`);
    }
  }
});

test('보스는 경고 연출 시간만큼 늦게 나온다', () => {
  assert.equal(BOSS_INTRO, 3);
  assert.deepEqual(spawnSchedule(waves[4]), [{ at: BOSS_INTRO, type: 'boss' }]);
});

test('뒤 웨이브일수록 병사 비중이 줄고 강한 적이 늘어난다', () => {
  assert.equal(count(waves[0], 'soldier'), 20);
  assert.ok(count(waves[13], 'soldier') < count(waves[3], 'soldier'));
  assert.ok(count(waves[13], 'tank') >= count(waves[5], 'tank'));
});

test('spawnSchedule은 시간순이고 모든 적을 포함하며 0초(보스는 경고 뒤)에 시작한다', () => {
  for (const w of waves) {
    const schedule = spawnSchedule(w);
    const total = w.groups.reduce((s, g) => s + g.count, 0);
    assert.equal(schedule.length, total);
    assert.equal(schedule[0].at, isBossWave(w) ? BOSS_INTRO : 0);
    for (let i = 1; i < schedule.length; i++) assert.ok(schedule[i].at >= schedule[i - 1].at);
  }
});

test('그룹 사이에는 1.5초 간격이 있다', () => {
  const schedule = spawnSchedule({ number: 1, groups: [
    { type: 'soldier', count: 3, interval: 1 },
    { type: 'runner', count: 2, interval: 0.5 },
  ] });
  assert.deepEqual(schedule, [
    { at: 0, type: 'soldier' }, { at: 1, type: 'soldier' }, { at: 2, type: 'soldier' },
    { at: 3.5, type: 'runner' }, { at: 4, type: 'runner' },
  ]);
});

test('같은 무리의 몬스터는 최소 0.95칸 떨어져 나와 체력바가 겹치지 않는다', () => {
  for (const w of waves) {
    for (const g of w.groups) {
      if (g.count > 1) assert.ok(g.interval * ENEMIES[g.type].speed >= 0.95, `wave ${w.number} ${g.type}`);
    }
  }
});

test('빠른 몬스터 무리가 먼저 나와 뒤 무리가 앞 무리를 따라잡지 않는다', () => {
  for (const w of waves) {
    const speeds = w.groups.map((g) => ENEMIES[g.type].speed);
    for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] <= speeds[i - 1], `wave ${w.number}: ${w.groups.map((g) => g.type)}`);
  }
});

test('16웨이브 이후에는 병사가 거의 없고 탱크·방패병이 많다', () => {
  for (const w of waves.filter((x) => x.number > 16 && !isBossWave(x))) {
    assert.equal(count(w, 'soldier'), 0, `wave ${w.number}`);
    assert.ok(count(w, 'tank') + count(w, 'shield') >= 11, `wave ${w.number}`);
  }
});
