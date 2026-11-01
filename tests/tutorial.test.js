import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { createGame, summonTower, mergeTowers, callNextWave } from '../js/core/game.js';
import { createTutorial, advance, next, blocking, TUTORIAL_KEY, shouldStart } from '../js/ui/tutorial.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('소환 두 번 → 합성 → 웨이브 시작 → 강화 소개 → 신화 소개 → 끝', () => {
  const g = createGame(MAPS[0]);
  const tut = createTutorial();
  assert.equal(tut.step, 'summon');
  assert.equal(blocking(tut, g), true, '소환·합성 동안은 카운트다운이 멈춘다');
  const a = summonTower(g, seq(0.1, 0.2)); advance(tut, g, a);
  assert.equal(tut.step, 'summon');
  const b = summonTower(g, seq(0.7, 0.9)); advance(tut, g, b);
  assert.equal(a.type, b.type, '튜토리얼 첫 두 마리는 같은 동물');
  assert.equal(a.level, b.level);
  assert.equal(tut.step, 'merge');
  assert.ok(mergeTowers(g, a.id, b.id));
  advance(tut, g);
  assert.equal(tut.step, 'wave');
  callNextWave(g);
  advance(tut, g);
  assert.equal(tut.step, 'upgrade');
  assert.equal(blocking(tut, g), false, '웨이브가 시작되면 게임은 흐른다');
  next(tut);
  assert.equal(tut.step, 'mythic');
  next(tut);
  assert.equal(tut.step, 'done');
});

test('강화·신화 소개는 눌러야 넘어가고, 다른 단계는 누름으로 넘어가지 않는다', () => {
  const tut = createTutorial();
  next(tut);
  assert.equal(tut.step, 'summon');
});

test('처음 초급 맵을 시작할 때만 튜토리얼을 연다 (끝냈거나 다른 맵·무한 모드면 아님)', () => {
  const store = (v) => ({ getItem: (k) => (k === TUTORIAL_KEY ? v : null) });
  assert.equal(shouldStart(store(null), 'meadow', false), true);
  assert.equal(shouldStart(store('done'), 'meadow', false), false);
  assert.equal(shouldStart(store(null), 'forest', false), false);
  assert.equal(shouldStart(store(null), 'meadow', true), false);
  assert.equal(shouldStart({ getItem() { throw new Error('x'); } }, 'meadow', false), true, '저장소가 막혀도 열 수 있다');
});

test('합성 전에 웨이브를 먼저 불러도 게임은 멈추지 않는다', () => {
  const g = createGame(MAPS[0]);
  const tut = createTutorial();
  callNextWave(g);
  assert.equal(tut.step, 'summon');
  assert.equal(blocking(tut, g), false);
});
