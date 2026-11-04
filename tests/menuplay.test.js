import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playTarget, HERO_LINEUP } from '../js/ui/menuPlay.js';
import { defaultSave } from '../js/storage.js';
import { MAPS } from '../js/data/maps.js';
import { MYTHICS } from '../js/data/mythics.js';

test('처음 하는 사람은 PLAY를 누르면 첫 맵을 한다', () => {
  assert.equal(playTarget(defaultSave()), MAPS[0].id);
});

test('PLAY는 열린 맵 중 아직 깨지 못한(별 없는) 첫 맵을 고른다', () => {
  const save = { ...defaultSave(), unlocked: 2, records: { [MAPS[0].id]: { bestWave: 30, stars: 2 } } };
  assert.equal(playTarget(save), MAPS[1].id);
  const tried = { ...defaultSave(), unlocked: 2, records: { [MAPS[0].id]: { bestWave: 30, stars: 1 }, [MAPS[1].id]: { bestWave: 12, stars: 0 } } };
  assert.equal(playTarget(tried), MAPS[1].id);
});

test('열린 맵을 모두 깼으면 마지막으로 열린 맵을 고른다', () => {
  const recs = Object.fromEntries(MAPS.map((m) => [m.id, { bestWave: 30, stars: 3 }]));
  assert.equal(playTarget({ ...defaultSave(), unlocked: MAPS.length, records: recs }), MAPS.at(-1).id);
});

test('첫 화면 신수 줄은 실제 신수 다섯이다', () => {
  assert.equal(HERO_LINEUP.length, 5);
  assert.deepEqual([...HERO_LINEUP].sort(), Object.keys(MYTHICS).sort());
});
