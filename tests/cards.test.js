import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { CARDS, drawCards } from '../js/data/cards.js';
import { createEnemy } from '../js/core/enemies.js';
import {
  createGame, addTower, callNextWave, step, chooseCard, effectiveStats, emptyCells,
} from '../js/core/game.js';
import { towerStats } from '../js/core/towers.js';

const meadow = MAPS[0];
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const twoWaves = [
  { number: 1, groups: [{ type: 'soldier', count: 1, interval: 1 }] },
  { number: 2, groups: [{ type: 'soldier', count: 1, interval: 1 }] },
];
// 1웨이브를 끝내 카드 선택 상태로 만든다
const clearFirstWave = (g) => {
  callNextWave(g);
  step(g, 0.1);
  g.enemies[0].hp = 0;
  step(g, 0.05);
};

test('카드는 동물 특훈 5장과 공용 카드 8장, 모두 이름·아이콘·설명이 있다', () => {
  const ids = Object.keys(CARDS);
  assert.equal(ids.length, 13);
  for (const id of ['train:squirrel', 'train:elephant', 'train:penguin', 'train:eagle', 'train:snake',
    'haste', 'eye', 'treasure', 'heal', 'lucky', 'bounty', 'frost', 'hunter']) {
    assert.ok(CARDS[id], id);
    assert.ok(CARDS[id].icon && CARDS[id].name && CARDS[id].desc, id);
  }
});

test('drawCards는 서로 다른 카드 3장을 뽑는다', () => {
  for (let k = 0; k < 20; k++) {
    const r = Math.random;
    const cards = drawCards(r);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards).size, 3);
    for (const id of cards) assert.ok(CARDS[id]);
  }
  assert.deepEqual(drawCards(seq(0)), Object.keys(CARDS).slice(0, 3));
});

test('웨이브를 끝내면 카드 3장이 나오고, 고를 때까지 게임이 멈춘다', () => {
  const g = createGame(meadow, twoWaves);
  g.rng = seq(0);
  clearFirstWave(g);
  assert.equal(g.cardChoices.length, 3);
  const t = g.time;
  const countdown = g.countdown;
  step(g, 5);
  assert.equal(g.time, t, '카드를 고르는 동안 시간이 흐르지 않는다');
  assert.equal(g.countdown, countdown);
  assert.equal(callNextWave(g), 0, '카드를 고르기 전에는 다음 웨이브를 시작할 수 없다');
  assert.equal(chooseCard(g, 'nope'), false);
  assert.equal(chooseCard(g, g.cardChoices[0]), true);
  assert.equal(g.cardChoices, null);
  assert.deepEqual(g.cardsTaken, ['train:squirrel']);
  step(g, 1);
  assert.ok(g.time > t);
});

test('마지막 웨이브를 끝내면 카드가 나오지 않는다', () => {
  const g = createGame(meadow, [twoWaves[0]]);
  clearFirstWave(g);
  assert.equal(g.cardChoices, null);
  assert.equal(g.status, 'won');
});

const choose = (g, id) => { g.cardChoices = [id]; return chooseCard(g, id); };

test('동물 특훈: 그 동물 공격력 +30% (여러 번 고르면 쌓인다)', () => {
  const g = createGame(meadow);
  const t = addTower(g, 'eagle', 5, 3);
  choose(g, 'train:eagle');
  choose(g, 'train:eagle');
  assert.ok(Math.abs(effectiveStats(g, t).damage - towerStats('eagle', 0).damage * 1.6) < 1e-9);
  const s = addTower(g, 'squirrel', 6, 3);
  assert.equal(effectiveStats(g, s).damage, towerStats('squirrel', 0).damage);
});

test('날쌘 발톱은 공격 간격을 줄이고, 매의 눈은 사거리를 늘린다', () => {
  const g = createGame(meadow);
  const t = addTower(g, 'squirrel', 5, 3);
  const base = towerStats('squirrel', 0);
  choose(g, 'haste');
  choose(g, 'eye');
  assert.ok(Math.abs(effectiveStats(g, t).cooldown - base.cooldown / 1.1) < 1e-9);
  assert.ok(Math.abs(effectiveStats(g, t).range - (base.range + 0.3)) < 1e-9);
});

test('보물 상자 +100골드, 응급 치료 +3생명, 행운의 소환은 아기 2마리 무료', () => {
  const g = createGame(meadow);
  g.rng = seq(0);
  const gold = g.gold;
  choose(g, 'treasure');
  assert.equal(g.gold, gold + 100);
  choose(g, 'heal');
  assert.equal(g.lives, 23);
  const cells = emptyCells(g).length;
  choose(g, 'lucky');
  assert.equal(g.towers.length, 2);
  assert.ok(g.towers.every((t) => t.level === 0 && t.invested === 0));
  assert.equal(emptyCells(g).length, cells - 2);
  assert.equal(g.gold, gold + 100, '무료 소환은 골드를 쓰지 않는다');
});

test('현상금은 처치 보상 +1, 서리 바람은 몬스터 이동 -8%, 보스 사냥꾼은 보스 피해 +25%', () => {
  const g = createGame(meadow);
  g.countdown = null;
  choose(g, 'bounty');
  choose(g, 'frost');
  choose(g, 'hunter');
  addTower(g, 'squirrel', 5, 3);
  const e = createEnemy(g.nextId++, 'soldier', 1);
  e.dist = 5;
  e.hp = 1;
  g.enemies.push(e);
  const gold = g.gold;
  step(g, 0.05);
  assert.equal(g.gold, gold + 6);
  const runner = createEnemy(g.nextId++, 'soldier', 1);
  g.enemies.push(runner);
  g.towers = [];
  step(g, 1);
  assert.ok(Math.abs(runner.dist - 0.92) < 1e-9, String(runner.dist));

  const g2 = createGame(meadow);
  g2.countdown = null;
  choose(g2, 'hunter');
  addTower(g2, 'squirrel', 5, 3);
  const boss = createEnemy(g2.nextId++, 'boss', 1);
  boss.dist = 5;
  g2.enemies.push(boss);
  step(g2, 0.05);
  assert.ok(Math.abs((boss.maxHp - boss.hp) - towerStats('squirrel', 0).damage * 1.25) < 1e-9);
});
