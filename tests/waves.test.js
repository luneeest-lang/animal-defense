import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../js/data/enemies.js';
import { buildWaves, spawnSchedule } from '../js/core/waves.js';

const waves = buildWaves();
const count = (wave, type) => wave.groups.filter((g) => g.type === type).reduce((s, g) => s + g.count, 0);

test('웨이브는 15개이고 번호는 1부터 15이다', () => {
  assert.equal(waves.length, 15);
  assert.deepEqual(waves.map((w) => w.number), Array.from({ length: 15 }, (_, i) => i + 1));
});

test('보스는 5, 10, 15웨이브에만 1마리씩 나온다', () => {
  const bossWaves = waves.filter((w) => count(w, 'boss') > 0);
  assert.deepEqual(bossWaves.map((w) => w.number), [5, 10, 15]);
  for (const w of bossWaves) assert.equal(count(w, 'boss'), 1);
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

test('모든 웨이브는 정확히 20마리다 (보스 포함)', () => {
  for (const w of waves) assert.equal(w.groups.reduce((s, g) => s + g.count, 0), 20, `wave ${w.number}`);
});

test('뒤 웨이브일수록 병사 비중이 줄고 강한 적이 늘어난다', () => {
  assert.equal(count(waves[0], 'soldier'), 20);
  assert.ok(count(waves[14], 'soldier') < count(waves[4], 'soldier'));
  assert.ok(count(waves[14], 'tank') >= count(waves[5], 'tank'));
});

test('spawnSchedule은 시간순이고 모든 적을 포함하며 0초에 시작한다', () => {
  for (const w of waves) {
    const schedule = spawnSchedule(w);
    const total = w.groups.reduce((s, g) => s + g.count, 0);
    assert.equal(schedule.length, total);
    assert.equal(schedule[0].at, 0);
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
