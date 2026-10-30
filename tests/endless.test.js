import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { ENEMIES } from '../js/data/enemies.js';
import { buildWaves, waveAt, isBossWave, WAVE_COUNT } from '../js/core/waves.js';
import { speedScale, hpScale } from '../js/core/enemies.js';
import { createGame, step, chooseCard } from '../js/core/game.js';
import { snapshotGame, restoreGame } from '../js/core/snapshot.js';
import { defaultSave, loadSave, recordResult } from '../js/storage.js';

const meadow = MAPS[0];
const total = (w) => w.groups.reduce((s, g) => s + g.count, 0);
const bosses = (w) => w.groups.filter((g) => ENEMIES[g.type].boss);

test('무한 모드 웨이브: 30까지는 보통 판과 같고, 31부터 몬스터 수가 늘며 5웨이브마다 보스가 나온다', () => {
  const base = buildWaves();
  for (let n = 1; n <= WAVE_COUNT; n++) assert.deepEqual(waveAt(n), base[n - 1], `wave ${n}`);
  for (let n = 31; n <= 80; n++) {
    const w = waveAt(n);
    assert.equal(w.number, n);
    for (const g of w.groups) assert.ok(ENEMIES[g.type] && g.count > 0 && g.interval > 0, `${n} ${g.type}`);
    assert.equal(isBossWave(w), n % 5 === 0, `wave ${n} boss`);
  }
  assert.ok(total(waveAt(31)) > 20, '31웨이브는 20마리보다 많다');
  assert.ok(total(waveAt(59)) > total(waveAt(31)), '뒤로 갈수록 많아진다');
  assert.ok(total(waveAt(200)) <= 45, '너무 많아지지 않게 상한');
});

test('무한 모드 보스: 35웨이브부터 서로 다른 보스 2마리가 함께 나온다', () => {
  assert.equal(bosses(waveAt(30)).length, 1);
  for (const n of [35, 40, 45, 50]) {
    const b = bosses(waveAt(n));
    assert.equal(b.length, 2, `wave ${n}`);
    assert.notEqual(b[0].type, b[1].type);
  }
});

test('웨이브가 높아도 이동 속도는 최대 1.5배, 체력은 계속 커진다', () => {
  assert.equal(speedScale(300), 1.5);
  assert.ok(hpScale(60) > hpScale(40) && hpScale(40) > hpScale(30));
});

test('무한 모드는 30웨이브를 깨도 이기지 않고 다음 웨이브가 이어진다 (보스를 깨면 카드도 나온다)', () => {
  const g = createGame(meadow, undefined, { endless: true });
  assert.equal(g.endless, true);
  assert.ok(g.schedule.golden.length > 0, '황금 몬스터·미션 일정은 보통 판처럼 있다');
  Object.assign(g, { waveNumber: 29, clearedWave: 29, countdown: 0.01, lives: 20 });
  step(g, 0.05);
  assert.equal(g.waveNumber, 30);
  assert.ok(g.waves.length > 30, '웨이브 목록이 늘어난다');
  g.spawnQueue = []; g.enemies = [];
  step(g, 0.05);
  assert.equal(g.status, 'running', '30웨이브를 깨도 끝나지 않는다');
  assert.ok(g.cardChoices, '30웨이브 보스를 깨면 카드');
  chooseCard(g, g.cardChoices[0]);
  assert.ok(g.countdown > 0, '31웨이브 카운트다운');
});

test('보통 판은 그대로 30웨이브를 깨면 이긴다', () => {
  const g = createGame(meadow);
  assert.equal(g.endless, false);
  Object.assign(g, { waveNumber: 29, clearedWave: 29, countdown: 0.01 });
  step(g, 0.05);
  g.spawnQueue = []; g.enemies = [];
  step(g, 0.05);
  assert.equal(g.status, 'won');
  assert.equal(g.waves.length, WAVE_COUNT);
});

test('무한 모드 이어하기: 31웨이브 넘어서도 저장하고 되살린다', () => {
  const g = createGame(meadow, undefined, { endless: true });
  Object.assign(g, { waveNumber: 41, clearedWave: 41, countdown: 5 });
  g.waves = Array.from({ length: 42 }, (_, i) => waveAt(i + 1));
  const back = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
  assert.ok(back);
  assert.equal(back.endless, true);
  assert.equal(back.waveNumber, 41);
  assert.ok(back.waves.length >= 42);
  // 보통 판은 30을 넘는 웨이브로 되살릴 수 없다
  const snap = snapshotGame(createGame(meadow));
  assert.equal(restoreGame({ ...snap, waveNumber: 41, clearedWave: 41 }), null);
});

test('무한 모드 기록: 맵마다 최고 웨이브만 남고 별·해금은 그대로', () => {
  let save = recordResult(defaultSave(), 'meadow', { wave: 30, lives: 18, won: true });
  const before = JSON.stringify({ stars: save.records.meadow.stars, best: save.records.meadow.bestWave, unlocked: save.unlocked });
  save = recordResult(save, 'meadow', { wave: 37, lives: 0, won: false, endless: true });
  assert.equal(save.records.meadow.endlessBest, 37);
  assert.equal(JSON.stringify({ stars: save.records.meadow.stars, best: save.records.meadow.bestWave, unlocked: save.unlocked }), before);
  save = recordResult(save, 'meadow', { wave: 33, lives: 0, won: false, endless: true });
  assert.equal(save.records.meadow.endlessBest, 37, '낮은 기록은 덮어쓰지 않는다');
  save = recordResult(save, 'meadow', { wave: 12, lives: 0, won: false });
  assert.equal(save.records.meadow.endlessBest, 37, '보통 판 기록을 남겨도 무한 기록은 지워지지 않는다');
  const loaded = loadSave({ getItem: () => JSON.stringify(save), setItem() {} });
  assert.equal(loaded.records.meadow.endlessBest, 37);
});
