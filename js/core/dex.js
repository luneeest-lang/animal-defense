import { TOWERS } from '../data/towers.js';
import { MYTHICS } from '../data/mythics.js';
import { MAPS } from '../data/maps.js';

// 도감: 보통 판 30웨이브를 깨면 동물 카드(흔함)와 신화 카드(드묾)를 받는다.
// 같은 카드를 모으면 그 동물·신화의 도감 레벨이 오르고, 레벨 1마다 피해가 3%씩 영구히 오른다(최대 10레벨, +30%).
export const DEX_MAX = 10;
export const DEX_BONUS = 0.03;

// 맵 순서(초급·중급·고급)별 기본 보상. 별 하나마다 동물 카드 2장을 더 준다
const CLEAR_CARDS = [
  { common: 6, mythic: 0 },
  { common: 9, mythic: 1 },
  { common: 12, mythic: 2 },
];
const PER_STAR = 2;

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// mapIndex: MAPS 순서, stars: 이번 클리어의 별(0~3). 반환: { 동물·신화 id: 장수 }
export function clearRewards(mapIndex, stars, rng = Math.random) {
  const base = CLEAR_CARDS[Math.max(0, Math.min(CLEAR_CARDS.length - 1, mapIndex))];
  const cards = {};
  const give = (pool, n) => {
    for (let i = 0; i < n; i++) {
      const id = pick(pool, rng);
      cards[id] = (cards[id] ?? 0) + 1;
    }
  };
  give(Object.keys(TOWERS), base.common + PER_STAR * stars);
  give(Object.keys(MYTHICS), base.mythic);
  return cards;
}

// 다음 레벨까지 필요한 장수: 동물은 레벨+1장(1, 2, 3, …장. 10레벨까지 모두 55장), 신화는 1장씩
const costOf = (id, level) => (MYTHICS[id] ? 1 : level + 1);

// 모은 장수로 진행 정도: { level, have: 이번 레벨에서 모은 장수, need: 다음 레벨까지 필요한 장수 }
export function dexProgress(id, count) {
  let level = 0;
  let left = Math.max(0, Math.floor(count));
  while (level < DEX_MAX && left >= costOf(id, level)) {
    left -= costOf(id, level);
    level += 1;
  }
  return level >= DEX_MAX ? { level, have: 0, need: 0 } : { level, have: left, need: costOf(id, level) };
}

export const dexLevel = (id, count) => dexProgress(id, count).level;

// 모은 장수 → 도감 레벨 (0레벨은 뺀다)
export function dexLevels(collection = {}) {
  const out = {};
  for (const [id, n] of Object.entries(collection)) {
    const lv = dexLevel(id, n);
    if (lv > 0) out[id] = lv;
  }
  return out;
}

// 카드를 저장에 더한다. 원래 저장은 그대로 두고 새 저장과 오른 레벨 목록을 돌려준다
export function addCards(save, cards) {
  const collection = { ...(save.collection ?? {}) };
  const levelUps = [];
  for (const [id, n] of Object.entries(cards)) {
    const from = dexLevel(id, collection[id] ?? 0);
    collection[id] = (collection[id] ?? 0) + n;
    const to = dexLevel(id, collection[id]);
    if (to > from) levelUps.push({ id, from, to });
  }
  return { save: { ...save, collection }, levelUps };
}

// 도감 레벨에 따른 피해 배율
export const dexDamage = (game, id) => 1 + DEX_BONUS * (game.dex?.[id] ?? 0);

export const DEX_IDS = [...Object.keys(TOWERS), ...Object.keys(MYTHICS)];
export const mapIndexOf = (mapId) => MAPS.findIndex((m) => m.id === mapId);
