import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONS, ICON_SIZE } from '../js/data/icons.js';
import { EMOJI_ICONS, splitIcons, hasIcon } from '../js/ui/iconText.js';
import { TOWERS } from '../js/data/towers.js';
import { MYTHICS } from '../js/data/mythics.js';
import { CARDS } from '../js/data/cards.js';
import { KO, EN } from '../js/i18n.js';

test('아이콘은 16x16이고 팔레트에 없는 글자를 쓰지 않는다', () => {
  for (const [name, d] of Object.entries(ICONS)) {
    assert.equal(d.rows.length, ICON_SIZE, name);
    for (const row of d.rows) {
      assert.equal(row.length, ICON_SIZE, `${name}: ${row}`);
      for (const ch of row) assert.ok(ch === '.' || ch in d.palette, `${name} ${ch}`);
    }
  }
});

test('이모지마다 도트 아이콘(또는 동물·신화 그림)이 정해져 있다', () => {
  for (const target of Object.values(EMOJI_ICONS)) {
    const [kind, id] = target.split(':');
    if (kind === 'animal') assert.ok(TOWERS[id], target);
    else if (kind === 'mythic') assert.ok(MYTHICS[id], target);
    else assert.ok(ICONS[target], target);
  }
  // 게임이 쓰는 이모지는 모두 바뀐다: 카드·동물·신화 아이콘과 화면 문장
  const used = [...Object.values(CARDS).map((c) => c.icon), ...Object.values(TOWERS).map((t) => t.emoji), ...Object.values(MYTHICS).map((m) => m.icon)];
  for (const s of used) assert.ok(hasIcon(s), `아이콘 없음: ${s}`);
  const sample = { n: 1, goal: 1, have: 1, need: 1, count: 1, pct: 1, total: 1, max: 1, wave: 1, best: 1, left: 1, gold: 1, lives: 1, bonus: 1, name: 'X', place: 'Y', reward: 'R', kills: 1, icon: '', stage: 'S', grade: 'G', animal: 'A', skill: 'K', list: '', value: 1 };
  const emoji = /\p{Extended_Pictographic}/u;
  for (const dict of [KO, EN]) {
    for (const [k, v] of Object.entries(dict)) {
      const text = typeof v === 'function' ? v(sample) : v;
      for (const part of splitIcons(text)) if (typeof part === 'string') assert.ok(!emoji.test(part), `${k}: 바뀌지 않는 이모지 ${part}`);
    }
  }
});

test('글자를 글자 조각과 아이콘 조각으로 나눈다', () => {
  assert.deepEqual(splitIcons('❤️ 20'), [{ icon: 'heart' }, ' 20']);
  assert.deepEqual(splitIcons('+5🪙'), ['+5', { icon: 'coin' }]);
  assert.deepEqual(splitIcons('⭐⭐☆'), [{ icon: 'star' }, { icon: 'star' }, { icon: 'starEmpty' }]);
  assert.deepEqual(splitIcons('보통 글자'), ['보통 글자']);
  assert.deepEqual(splitIcons('🐿️×2'), [{ icon: 'animal:squirrel' }, '×2']);
  assert.equal(hasIcon('abc'), false);
});
