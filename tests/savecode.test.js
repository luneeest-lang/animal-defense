import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave } from '../js/storage.js';
import { exportCode, importCode, mergeSaves, CODE_PREFIX } from '../js/savecode.js';

const blank = { achievements: {}, totals: { kills: 0, golden: 0, mythicsUsed: [] } };
const phone = {
  ...blank, version: 1, unlocked: 3,
  records: { meadow: { bestWave: 30, stars: 3, endlessBest: 41 }, forest: { bestWave: 30, stars: 1 } },
  collection: { squirrel: 12, phoenix: 2 },
};
const pc = {
  ...blank, version: 1, unlocked: 2,
  records: { meadow: { bestWave: 30, stars: 2, endlessBest: 55 }, canyon: { bestWave: 7, stars: 0 } },
  collection: { squirrel: 5, eagle: 9 },
};

test('기록을 짧은 글자 코드로 바꾸고 다시 읽는다', () => {
  const code = exportCode(phone);
  assert.ok(code.startsWith(CODE_PREFIX));
  assert.match(code, /^[A-Za-z0-9._-]+$/, '복사하기 쉬운 글자만');
  assert.deepEqual(importCode(code), phone);
  assert.deepEqual(importCode(`  ${code}\n`), phone, '앞뒤 공백은 무시');
});

test('엉뚱하거나 깨진 코드는 null', () => {
  for (const bad of ['', 'hello', `${CODE_PREFIX}@@@`, `${CODE_PREFIX}e30`, exportCode(phone).slice(0, -6)]) {
    assert.equal(importCode(bad), null, bad);
  }
});

test('이상한 값은 걸러서 읽는다 (모르는 동물, 음수)', () => {
  const code = exportCode({ ...phone, collection: { squirrel: 3, nope: 9, eagle: -2 } });
  assert.deepEqual(importCode(code).collection, { squirrel: 3 });
});

test('두 기기 기록 합치기: 좋은 쪽을 남긴다 (도감 카드·최고 기록·별·무한·해금)', () => {
  const m = mergeSaves(phone, pc);
  assert.equal(m.unlocked, 3);
  assert.deepEqual(m.records.meadow, { bestWave: 30, stars: 3, endlessBest: 55 });
  assert.deepEqual(m.records.forest, { bestWave: 30, stars: 1 });
  assert.deepEqual(m.records.canyon, { bestWave: 7, stars: 0 });
  assert.deepEqual(m.collection, { squirrel: 12, phoenix: 2, eagle: 9 });
  assert.deepEqual(mergeSaves(m, m), m, '같은 코드를 두 번 불러와도 늘어나지 않는다');
  assert.deepEqual(mergeSaves(defaultSave(), phone), mergeSaves(phone, defaultSave()));
});
