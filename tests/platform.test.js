import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCrazyGames, sdkStore, GAME_KEYS, createPlayTracker } from '../js/platform.js';

const mem = (init = {}) => { const d = { ...init }; return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; };

test('CrazyGames 사이트(또는 시험용 주소)에서만 SDK를 쓴다', () => {
  assert.equal(isCrazyGames('www.crazygames.com', ''), true);
  assert.equal(isCrazyGames('games.crazygames.com', ''), true);
  assert.equal(isCrazyGames('tiny-mythic-squad.game-files.crazygames.com', ''), true);
  assert.equal(isCrazyGames('luneeest-lang.github.io', ''), false);
  assert.equal(isCrazyGames('localhost', '?platform=crazygames'), true);
  assert.equal(isCrazyGames('evilcrazygames.com.example', ''), false);
});

test('SDK 저장소를 쓰고, 처음에는 브라우저에 남은 게임 기록을 옮겨 담는다', () => {
  const local = mem({ 'td-save-v1': '{"version":1}', 'td-lang': 'en', other: 'x' });
  const data = mem();
  const store = sdkStore({ data }, local);
  assert.equal(store.getItem('td-save-v1'), '{"version":1}');
  assert.equal(data.d['td-lang'], 'en');
  assert.equal(data.d.other, undefined, '게임 키만');
  store.setItem('td-save-v1', '{"version":1,"unlocked":2}');
  assert.equal(data.d['td-save-v1'], '{"version":1,"unlocked":2}');
  assert.ok(GAME_KEYS.includes('td-run-v1') && GAME_KEYS.includes('td-tutorial'));
});

test('SDK 저장소에 이미 기록이 있으면 브라우저 기록으로 덮어쓰지 않는다', () => {
  const local = mem({ 'td-save-v1': 'OLD' });
  const data = mem({ 'td-save-v1': 'CLOUD' });
  assert.equal(sdkStore({ data }, local).getItem('td-save-v1'), 'CLOUD');
});

test('게임 중인지가 바뀔 때만 gameplayStart/Stop을 알린다', () => {
  const calls = [];
  const track = createPlayTracker({ game: { gameplayStart: () => calls.push('start'), gameplayStop: () => calls.push('stop') } });
  track(false); track(true); track(true); track(false); track(false); track(true);
  assert.deepEqual(calls, ['start', 'stop', 'start']);
  const none = createPlayTracker(null);
  none(true); // SDK가 없으면 아무 일도 없다
});

test('gameplayStart/Stop은 SDK 객체에 붙여서 부른다 (진짜 SDK는 this를 쓴다)', () => {
  const calls = [];
  class FakeGame {
    constructor() { this.log = calls; }
    gameplayStart() { this.log.push('start'); }
    gameplayStop() { this.log.push('stop'); }
  }
  const track = createPlayTracker({ game: new FakeGame() });
  track(true); track(false);
  assert.deepEqual(calls, ['start', 'stop']);
});

test('CrazyGames용 파일(html에 data-platform="crazygames")은 주소와 상관없이 SDK를 쓴다', () => {
  assert.equal(isCrazyGames('other-domain.example', '', 'crazygames'), true);
  assert.equal(isCrazyGames('luneeest-lang.github.io', '', undefined), false);
  assert.equal(isCrazyGames('luneeest-lang.github.io', '', 'web'), false);
});
