import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundsFor, loadSoundSettings, saveSoundSettings, SOUND_KEY, OLD_SOUND_KEY } from '../js/ui/sound.js';

test('게임 이벤트마다 알맞은 효과음 (발사·피해 숫자처럼 잦은 것과 카드가 뜰 때는 소리가 없다)', () => {
  const events = [
    { type: 'shot' }, { type: 'hit' },
    { type: 'death', enemy: 'soldier' }, { type: 'death', enemy: 'lich' },
    { type: 'leak' }, { type: 'waveClear' },
    { type: 'bossSkill', skill: 'roar' }, { type: 'bossSkill', skill: 'dash' },
    { type: 'quake' }, { type: 'mythicShot', mythic: 'gumiho' }, { type: 'charm' },
  ];
  assert.deepEqual(soundsFor(events), ['pop', 'bossDeath', 'hurt', 'roar', 'skill', 'quake', 'charm']);
});

test('배경음과 효과음은 따로 켜고 끄며 저장된다', () => {
  const data = {};
  const store = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  assert.deepEqual(loadSoundSettings(store), { music: true, sfx: true });
  saveSoundSettings(store, { music: false, sfx: true });
  assert.deepEqual(JSON.parse(data[SOUND_KEY]), { music: false, sfx: true });
  assert.deepEqual(loadSoundSettings(store), { music: false, sfx: true });
  data[SOUND_KEY] = '{"music":"yes"}';
  assert.deepEqual(loadSoundSettings(store), { music: true, sfx: true });
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepEqual(loadSoundSettings(blocked), { music: true, sfx: true });
  saveSoundSettings(blocked, { music: false, sfx: false });
});

test('예전 소리 설정(전체·효과음만·끄기)은 새 설정으로 옮겨 읽는다', () => {
  for (const [old, want] of [['all', { music: true, sfx: true }], ['sfx', { music: false, sfx: true }], ['off', { music: false, sfx: false }]]) {
    const data = { [OLD_SOUND_KEY]: old };
    const store = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
    assert.deepEqual(loadSoundSettings(store), want, old);
  }
});
