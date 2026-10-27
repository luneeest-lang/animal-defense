import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundsFor, SOUND_MODES, nextSoundMode, loadSoundMode, saveSoundMode, SOUND_KEY } from '../js/ui/sound.js';

test('게임 이벤트마다 알맞은 효과음 (발사·피해 숫자처럼 너무 잦은 것은 소리가 없다)', () => {
  const events = [
    { type: 'shot' }, { type: 'hit' },
    { type: 'death', enemy: 'soldier' }, { type: 'death', enemy: 'lich' },
    { type: 'leak' }, { type: 'waveClear' },
    { type: 'bossSkill', skill: 'roar' }, { type: 'bossSkill', skill: 'dash' },
    { type: 'quake' }, { type: 'mythicShot', mythic: 'gumiho' }, { type: 'charm' },
  ];
  assert.deepEqual(soundsFor(events), ['pop', 'bossDeath', 'hurt', 'clear', 'roar', 'skill', 'quake', 'charm']);
});

test('소리 설정은 전체 → 효과음만 → 끄기 순서로 돌고, 저장된다', () => {
  assert.deepEqual(SOUND_MODES, ['all', 'sfx', 'off']);
  assert.deepEqual(['all', 'sfx', 'off'].map(nextSoundMode), ['sfx', 'off', 'all']);
  const data = {};
  const store = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  assert.equal(loadSoundMode(store), 'all');
  saveSoundMode(store, 'sfx');
  assert.equal(data[SOUND_KEY], 'sfx');
  assert.equal(loadSoundMode(store), 'sfx');
  data[SOUND_KEY] = 'loud';
  assert.equal(loadSoundMode(store), 'all');
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadSoundMode(blocked), 'all');
  saveSoundMode(blocked, 'off');
});
