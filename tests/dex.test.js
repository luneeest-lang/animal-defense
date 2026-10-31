import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { TOWERS } from '../js/data/towers.js';
import { MYTHICS } from '../js/data/mythics.js';
import {
  DEX_MAX, DEX_BONUS, clearRewards, dexLevel, dexProgress, addCards, dexLevels,
} from '../js/core/dex.js';
import { createGame, addTower, effectiveStats, emptyCells } from '../js/core/game.js';
import { craftMythic, RECIPE_LEVELS, mythicStats } from '../js/core/mythics.js';
import { snapshotGame, restoreGame } from '../js/core/snapshot.js';
import { defaultSave, loadSave } from '../js/storage.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const sum = (cards, pool) => Object.entries(cards).filter(([id]) => pool[id]).reduce((s, [, n]) => s + n, 0);

test('30웨이브 클리어 보상: 맵이 어려울수록, 별이 많을수록 카드가 많고 신화 카드는 드물다', () => {
  const r = (map, stars) => clearRewards(MAPS.findIndex((m) => m.id === map), stars, Math.random);
  const meadow = r('meadow', 3);
  assert.equal(sum(meadow, TOWERS), 12); // 기본 6 + 별 3개 × 2
  assert.equal(sum(meadow, MYTHICS), 0);
  const forest = r('forest', 1);
  assert.equal(sum(forest, TOWERS), 11);
  assert.equal(sum(forest, MYTHICS), 1);
  const canyon = r('canyon', 3);
  assert.equal(sum(canyon, TOWERS), 18);
  assert.equal(sum(canyon, MYTHICS), 2);
  for (const id of Object.keys(canyon)) assert.ok(TOWERS[id] || MYTHICS[id], id);
});

test('카드는 동물(신화)마다 무작위로 나뉜다', () => {
  const cards = clearRewards(0, 0, seq(0)); // 늘 첫 동물
  assert.deepEqual(cards, { [Object.keys(TOWERS)[0]]: 6 });
});

test('도감 레벨: 동물은 1·2·3…장씩 더 모아야 오르고, 신화는 1장마다 오른다. 최대 10', () => {
  assert.equal(DEX_MAX, 10);
  assert.equal(DEX_BONUS, 0.03);
  assert.equal(dexLevel('squirrel', 0), 0);
  assert.equal(dexLevel('squirrel', 1), 1);
  assert.equal(dexLevel('squirrel', 2), 1);
  assert.equal(dexLevel('squirrel', 3), 2);
  assert.equal(dexLevel('squirrel', 6), 3);
  assert.equal(dexLevel('squirrel', 55), 10);
  assert.equal(dexLevel('squirrel', 999), 10);
  assert.equal(dexLevel('phoenix', 1), 1);
  assert.equal(dexLevel('phoenix', 4), 4);
  assert.equal(dexLevel('phoenix', 50), 10);
  assert.deepEqual(dexProgress('squirrel', 4), { level: 2, have: 1, need: 3 });
  assert.deepEqual(dexProgress('squirrel', 55), { level: 10, have: 0, need: 0 });
});

test('카드를 더하면 모은 장수가 쌓이고, 오른 도감 레벨을 알려 준다', () => {
  const save = defaultSave();
  const { save: next, levelUps } = addCards(save, { squirrel: 3, phoenix: 1 });
  assert.deepEqual(next.collection, { squirrel: 3, phoenix: 1 });
  assert.deepEqual(levelUps, [{ id: 'squirrel', from: 0, to: 2 }, { id: 'phoenix', from: 0, to: 1 }]);
  assert.deepEqual(save.collection, {}, '원래 저장은 바꾸지 않는다');
  assert.deepEqual(dexLevels(next.collection), { squirrel: 2, phoenix: 1 });
  const loaded = loadSave({ getItem: () => JSON.stringify({ ...next, collection: { ...next.collection, nope: 5, eagle: -1 } }), setItem() {} });
  assert.deepEqual(loaded.collection, { squirrel: 3, phoenix: 1 }, '모르는 이름·이상한 값은 버린다');
});

test('도감 레벨만큼 그 동물·신화의 피해가 레벨당 3% 오른다 (보통 판·무한 모드 모두)', () => {
  const map = MAPS[0];
  const plain = createGame(map);
  const boosted = createGame(map, undefined, { dex: { squirrel: 5, phoenix: 10 } });
  const a = addTower(plain, 'squirrel', 5, 3);
  const b = addTower(boosted, 'squirrel', 5, 3);
  assert.ok(Math.abs(effectiveStats(boosted, b).damage - effectiveStats(plain, a).damage * 1.15) < 1e-9);
  const endless = createGame(map, undefined, { endless: true, dex: { squirrel: 5 } });
  const c = addTower(endless, 'squirrel', 5, 3);
  assert.ok(Math.abs(effectiveStats(endless, c).damage - effectiveStats(plain, a).damage * 1.15) < 1e-9);

  const mythicOf = (g) => {
    const cells = emptyCells(g);
    MYTHICS.phoenix.recipe.forEach((t, i) => addTower(g, t, ...cells[i], RECIPE_LEVELS[i]));
    return craftMythic(g, 'phoenix');
  };
  const p1 = createGame(map); const p2 = createGame(map, undefined, { dex: { phoenix: 10 } });
  const m1 = mythicStats(p1, mythicOf(p1)); const m2 = mythicStats(p2, mythicOf(p2));
  assert.ok(Math.abs(m2.damage - m1.damage * 1.3) < 1e-9);
  assert.ok(Math.abs(m2.burnDps - m1.burnDps * 1.3) < 1e-9);
});

test('이어하기는 지금 도감 레벨로 되살린다', () => {
  const g = createGame(MAPS[0], undefined, { dex: { squirrel: 2 } });
  const snap = JSON.parse(JSON.stringify(snapshotGame(g)));
  assert.deepEqual(restoreGame(snap, { dex: { squirrel: 4 } }).dex, { squirrel: 4 });
  assert.deepEqual(restoreGame(snap).dex, {});
});

test('보통 판·무한 모드 결과를 기록해도 도감은 그대로 남는다', async () => {
  const { recordResult } = await import('../js/storage.js');
  const { save } = addCards(defaultSave(), { eagle: 4 });
  const a = recordResult(save, 'meadow', { wave: 30, lives: 20, won: true });
  const b = recordResult(a, 'meadow', { wave: 40, lives: 0, won: false, endless: true });
  assert.deepEqual(b.collection, { eagle: 4 });
});
