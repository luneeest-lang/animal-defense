import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { TOWERS } from '../js/data/towers.js';
import { MYTHICS } from '../js/data/mythics.js';
import { createGame } from '../js/core/game.js';
import { defaultSave, loadSave } from '../js/storage.js';
import { ACHIEVEMENTS, evaluate, progressOf, addTotals } from '../js/core/achievements.js';
import { exportCode, importCode, mergeSaves } from '../js/savecode.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const ids = () => ACHIEVEMENTS.map((a) => a.id);
const ctxOf = (over = {}) => ({ game: createGame(MAPS[0]), won: false, wave: 3, endless: false, ...over });
const cardsIn = (c, pool) => Object.entries(c).filter(([id]) => pool[id]).reduce((s, [, n]) => s + n, 0);

test('업적은 12개이고 id가 겹치지 않으며 보상은 동물 또는 신화 카드다', () => {
  assert.equal(ACHIEVEMENTS.length, 12);
  assert.equal(new Set(ids()).size, 12);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.goal >= 1, a.id);
    assert.ok((a.reward.common ?? 0) + (a.reward.mythic ?? 0) > 0, a.id);
  }
});

test('첫 클리어를 하면 업적과 카드를 받고, 다시 깨도 또 받지 않는다', () => {
  let save = { ...defaultSave(), records: { meadow: { bestWave: 30, stars: 2 } } };
  const r = evaluate(save, ctxOf({ won: true, wave: 30 }), seq(0.1));
  const first = r.unlocked.find((u) => u.id === 'firstClear');
  assert.ok(first, '첫 클리어');
  assert.equal(r.save.achievements.firstClear, true);
  assert.equal(cardsIn(first.cards, TOWERS), ACHIEVEMENTS.find((a) => a.id === 'firstClear').reward.common);
  save = r.save;
  assert.equal(evaluate(save, ctxOf({ won: true, wave: 30 }), seq(0.1)).unlocked.length, 0);
});

test('완벽한 클리어는 생명 20으로 30웨이브를 깼을 때만', () => {
  const g = createGame(MAPS[0]);
  g.lives = 20;
  assert.ok(evaluate(defaultSave(), { game: g, won: true, wave: 30, endless: false }).unlocked.some((u) => u.id === 'perfect'));
  g.lives = 19;
  assert.ok(!evaluate(defaultSave(), { game: g, won: true, wave: 30, endless: false }).unlocked.some((u) => u.id === 'perfect'));
});

test('신화 5종으로 싸워 보기: 판마다 쌓인다', () => {
  const g1 = createGame(MAPS[0]);
  g1.stats.damage = { phoenix: 10, gumiho: 5, squirrel: 3 };
  let r = evaluate(defaultSave(), { game: g1, won: false, wave: 10, endless: false });
  assert.ok(!r.unlocked.some((u) => u.id === 'allMythics'));
  assert.deepEqual(progressOf(r.save, 'allMythics'), { have: 2, goal: 5 });
  const g2 = createGame(MAPS[0]);
  g2.stats.damage = { cheonma: 1, haetae: 1, girin: 1 };
  r = evaluate(r.save, { game: g2, won: false, wave: 10, endless: false });
  assert.ok(r.unlocked.some((u) => u.id === 'allMythics'));
  assert.ok(Object.keys(MYTHICS).every((id) => r.save.totals.mythicsUsed.includes(id)));
});

test('누적 처치·황금 몬스터는 판이 끝날 때 더해지고, 목표를 넘으면 달성', () => {
  const g = createGame(MAPS[0]);
  g.counters.kills = 600;
  g.counters.golden = 1;
  let save = addTotals(defaultSave(), g);
  save = addTotals(save, g);
  assert.equal(save.totals.kills, 1200);
  assert.equal(save.totals.golden, 2);
  const r = evaluate(save, ctxOf());
  assert.ok(r.unlocked.some((u) => u.id === 'kills1000'));
  assert.deepEqual(progressOf(r.save, 'golden10'), { have: 2, goal: 10 });
});

test('무한 모드 40·60웨이브는 맵 무한 기록으로', () => {
  const save = { ...defaultSave(), records: { forest: { bestWave: 30, stars: 1, endlessBest: 45 } } };
  const r = evaluate(save, ctxOf({ endless: true, wave: 45 }));
  assert.ok(r.unlocked.some((u) => u.id === 'endless40'));
  assert.ok(!r.unlocked.some((u) => u.id === 'endless60'));
});

test('업적·누적 기록은 저장되고, 저장 코드로 옮기고 합칠 수 있다', () => {
  const a = { ...defaultSave(), achievements: { firstClear: true }, totals: { kills: 300, golden: 4, mythicsUsed: ['phoenix'] } };
  const b = { ...defaultSave(), achievements: { perfect: true }, totals: { kills: 900, golden: 1, mythicsUsed: ['girin', 'phoenix'] } };
  const loaded = loadSave({ getItem: () => JSON.stringify({ ...a, achievements: { ...a.achievements, nope: true } }) });
  assert.deepEqual(loaded.achievements, { firstClear: true }, '모르는 업적은 버린다');
  assert.deepEqual(loaded.totals, a.totals);
  assert.deepEqual(importCode(exportCode(a)).achievements, a.achievements);
  const m = mergeSaves(a, b);
  assert.deepEqual(m.achievements, { firstClear: true, perfect: true });
  assert.equal(m.totals.kills, 900);
  assert.deepEqual([...m.totals.mythicsUsed].sort(), ['girin', 'phoenix']);
});
