import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWaves } from '../js/core/waves.js';
import { ENEMIES } from '../js/data/enemies.js';
import { INTRO_TYPES, newEnemies, loadSeen, saveSeen, SEEN_KEY } from '../js/ui/enemyIntro.js';
import { KO, EN, enemyName, enemyTip, setLang } from '../js/i18n.js';

const mem = () => { const d = {}; return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };

test('처음 보는 일반 몬스터만 알려 주고 보스·황금·작은 슬라임은 빼며, 한 웨이브에 여럿이면 모두', () => {
  assert.deepEqual([...INTRO_TYPES].sort(), ['bat', 'healer', 'runner', 'shield', 'splitter', 'tank']);
  const waves = buildWaves();
  assert.deepEqual(newEnemies(waves[0], new Set()), []);
  assert.deepEqual(newEnemies(waves[2], new Set()), ['runner']);
  assert.deepEqual(newEnemies(waves[6], new Set(['runner', 'splitter', 'tank'])), ['bat']);
  assert.deepEqual(newEnemies(waves[6], new Set(['runner', 'splitter', 'tank', 'bat'])), []);
  assert.deepEqual(newEnemies(waves[4], new Set()), [], '보스 웨이브');
});

test('본 몬스터는 저장되고 이상한 값은 버린다', () => {
  const s = mem();
  assert.deepEqual([...loadSeen(s)], []);
  saveSeen(s, new Set(['bat', 'runner']));
  assert.deepEqual([...loadSeen(s)].sort(), ['bat', 'runner']);
  s.setItem(SEEN_KEY, '{bad');
  assert.deepEqual([...loadSeen(s)], []);
  s.setItem(SEEN_KEY, JSON.stringify(['bat', 'nope']));
  assert.deepEqual([...loadSeen(s)], ['bat']);
  assert.deepEqual([...loadSeen({ getItem() { throw new Error('x'); } })], []);
});

test('안내할 몬스터마다 한국어·영어 이름과 설명이 있다', () => {
  for (const lang of ['ko', 'en']) {
    setLang(lang);
    for (const id of INTRO_TYPES) {
      assert.ok(enemyName(id) && enemyTip(id), `${lang} ${id}`);
      if (lang === 'en') assert.ok(!/[가-힣]/.test(enemyName(id) + enemyTip(id)), id);
    }
  }
  setLang('ko');
  assert.ok(ENEMIES.bat.air);
  assert.ok(KO && EN);
});
