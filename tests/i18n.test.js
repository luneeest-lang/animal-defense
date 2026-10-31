import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWERS } from '../js/data/towers.js';
import { MYTHICS } from '../js/data/mythics.js';
import { ENEMIES } from '../js/data/enemies.js';
import { CARDS } from '../js/data/cards.js';
import { MAPS } from '../js/data/maps.js';
import { MISSIONS } from '../js/core/missions.js';
import {
  KO, EN, t, setLang, lang, pickLang, towerName, mythicName, mythicDesc, enemyName, bossSkill,
  mapName, mapPlace, cardName, cardDesc, stageName, gradeName, missionLabel,
} from '../js/i18n.js';

const hangul = /[가-힣]/;
const sample = { n: 3, goal: 34, have: 1, need: 3, count: 5, level: 2, pct: 6, total: 10, max: 100, wave: 12, best: 30,
  left: 5, gold: 120, lives: 15, bonus: 25, name: 'X', place: 'Y', reward: 'R', kills: 4, cost: 80, value: 1, item: 'Z',
  from: 0, to: 2, animal: 'A', stage: 'S', grade: 'G', skill: 'K', time: '1:00', speed: 1, summons: 2 };
const render = (v) => (typeof v === 'function' ? v(sample) : v);

test('언어 고르기: 저장한 언어가 먼저, 없으면 휴대폰 언어가 한국어일 때만 한국어', () => {
  assert.equal(pickLang('en', ['ko-KR']), 'en');
  assert.equal(pickLang('ko', ['en-US']), 'ko');
  assert.equal(pickLang(null, ['ko-KR', 'en']), 'ko');
  assert.equal(pickLang(null, ['en-US', 'ko']), 'ko');
  assert.equal(pickLang(null, ['ja-JP']), 'en');
  assert.equal(pickLang('fr', []), 'en');
});

test('한국어와 영어 사전의 문장 목록이 같고, 영어 문장에는 한글이 없다', () => {
  assert.deepEqual(Object.keys(EN).sort(), Object.keys(KO).sort());
  // 언어 버튼만은 바꿀 언어의 이름(한국어)을 그 언어로 보여 준다
  for (const [k, v] of Object.entries(EN)) if (k !== 'menu.lang') assert.ok(!hangul.test(render(v)), `${k}: ${render(v)}`);
  assert.equal(EN['menu.lang'], '🌐 한국어');
});

test('모든 동물·신화·몬스터·보스 능력·카드·맵·미션·단계·등급에 영어 이름이 있다', () => {
  setLang('en');
  try {
    const all = [
      ...Object.keys(TOWERS).map(towerName), ...Object.keys(MYTHICS).flatMap((id) => [mythicName(id), mythicDesc(id)]),
      ...Object.keys(ENEMIES).filter((id) => ENEMIES[id].name).map(enemyName),
      ...Object.keys(ENEMIES).filter((id) => ENEMIES[id].skill).map(bossSkill),
      ...Object.keys(CARDS).flatMap((id) => [cardName(id), cardDesc(id)]),
      ...MAPS.flatMap((m) => [mapName(m.id), mapPlace(m.id)]),
      ...Object.keys(MISSIONS).map((id) => missionLabel({ id, goal: 34, progress: 1 })),
      ...[0, 1, 2, 3].flatMap((i) => [stageName(i), gradeName(i)]),
    ];
    for (const s of all) {
      assert.ok(s && !hangul.test(s), s);
    }
    assert.equal(cardName('train:squirrel'), 'Squirrel Training');
    assert.equal(missionLabel({ id: 'kill', goal: 34, progress: 50 }), 'Defeat 34 monsters (34/34)');
  } finally {
    setLang('ko');
  }
});

test('한국어일 때는 지금까지의 이름과 문장을 그대로 쓴다', () => {
  setLang('ko');
  assert.equal(lang(), 'ko');
  assert.equal(towerName('squirrel'), '다람쥐');
  assert.equal(mythicDesc('gumiho'), MYTHICS.gumiho.desc);
  assert.equal(cardDesc('heal'), CARDS.heal.desc);
  assert.equal(missionLabel({ id: 'kill', goal: 34, progress: 0 }), '몬스터 34마리 처치 (0/34)');
  assert.equal(t('result.win'), '🎉 승리!');
  assert.equal(t('nope.key'), 'nope.key', '없는 문장은 키를 그대로 보여 준다');
});
