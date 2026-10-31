import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, defaultSave, loadSave, writeSave, starsFor, recordResult } from '../js/storage.js';

const fakeStore = (raw) => ({ getItem: () => raw, setItem() {} });

test('저장 키와 기본값', () => {
  assert.equal(SAVE_KEY, 'td-save-v1');
  assert.deepEqual(defaultSave(), { version: 1, unlocked: 1, records: {}, collection: {} });
  assert.deepEqual(loadSave(fakeStore(null)), defaultSave());
});

test('깨지거나 엉뚱한 저장 데이터는 기본값으로 시작한다', () => {
  for (const raw of ['{not json', 'null', '[]', '"x"', '{"version":2}', '{"version":1,"unlocked":"x"}', '{"version":1}']) {
    assert.deepEqual(loadSave(fakeStore(raw)), defaultSave(), raw);
  }
});

test('범위를 벗어난 값은 보정한다', () => {
  const save = loadSave(fakeStore('{"version":1,"unlocked":99,"records":{"meadow":{"bestWave":999,"stars":9},"nope":{"bestWave":3,"stars":1}}}'));
  assert.equal(save.unlocked, 3);
  assert.deepEqual(save.records, { meadow: { bestWave: 30, stars: 3 } });
  assert.equal(loadSave(fakeStore('{"version":1,"unlocked":-4,"records":{}}')).unlocked, 1);
});

test('저장소 접근이 예외를 던져도 기본값으로 시작한다', () => {
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadSave(throwing), defaultSave());
  assert.equal(writeSave(throwing, defaultSave()), false);
});

test('저장하고 다시 읽으면 같은 값이다', () => {
  const data = {};
  const store = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  const save = recordResult(defaultSave(), 'meadow', { wave: 15, lives: 18, won: true });
  assert.equal(writeSave(store, save), true);
  assert.deepEqual(loadSave(store), save);
});

test('별 개수는 남은 생명으로 정한다', () => {
  assert.deepEqual([20, 15, 14, 8, 7, 1].map(starsFor), [3, 3, 2, 2, 1, 1]);
});

test('승리하면 기록하고 다음 맵을 연다', () => {
  const first = recordResult(defaultSave(), 'meadow', { wave: 15, lives: 18, won: true });
  assert.equal(first.unlocked, 2);
  assert.deepEqual(first.records.meadow, { bestWave: 15, stars: 3 });
  const lost = recordResult(first, 'meadow', { wave: 9, lives: 0, won: false });
  assert.deepEqual(lost.records.meadow, { bestWave: 15, stars: 3 });
  assert.equal(lost.unlocked, 2);
  const second = recordResult(lost, 'forest', { wave: 15, lives: 5, won: true });
  const third = recordResult(second, 'canyon', { wave: 15, lives: 5, won: true });
  assert.equal(second.unlocked, 3);
  assert.equal(third.unlocked, 3);
});

test('패배만 해도 최고 웨이브는 기록하지만 맵은 열리지 않고, 원본은 바뀌지 않는다', () => {
  const base = defaultSave();
  const next = recordResult(base, 'meadow', { wave: 7, lives: 0, won: false });
  assert.deepEqual(next.records.meadow, { bestWave: 7, stars: 0 });
  assert.equal(next.unlocked, 1);
  assert.deepEqual(base, defaultSave());
});
