// 업적: 판이 끝날 때 확인하고, 처음 달성하면 도감 카드를 준다(core/dex.js의 addCards).
// 저장: save.achievements { id: true }, save.totals { kills, golden, mythicsUsed: [신화 id] } (판을 넘어 쌓이는 기록)
import { TOWERS } from '../data/towers.js';
import { MYTHICS } from '../data/mythics.js';
import { MAPS } from '../data/maps.js';
import { addCards, dexProgress } from './dex.js';

const maxStars = 3 * MAPS.length;
const clearedMaps = (save) => MAPS.filter((m) => save.records?.[m.id]?.stars > 0).length;
const totalStars = (save) => MAPS.reduce((s, m) => s + (save.records?.[m.id]?.stars ?? 0), 0);
const endlessBest = (save) => Math.max(0, ...MAPS.map((m) => save.records?.[m.id]?.endlessBest ?? 0));
const maxDexLevel = (save) => Math.max(0, ...Object.entries(save.collection ?? {}).map(([id, n]) => dexProgress(id, n).level));

// have(save, ctx): 지금까지 이룬 정도. ctx(이번 판)는 메뉴에서 볼 때 없다
export const ACHIEVEMENTS = [
  { id: 'firstClear', icon: '🚩', goal: 1, reward: { common: 4 }, have: (s) => Math.min(1, clearedMaps(s)) },
  { id: 'allMaps', icon: '🏆', goal: MAPS.length, reward: { mythic: 2 }, have: (s) => clearedMaps(s) },
  { id: 'perfect', icon: '❤️', goal: 1, reward: { common: 6 }, have: (s, c) => (c?.won && !c.endless && c.game.lives >= 20 ? 1 : 0) },
  { id: 'allStars', icon: '⭐', goal: maxStars, reward: { mythic: 3 }, have: (s) => totalStars(s) },
  { id: 'firstAwaken', icon: '👑', goal: 1, reward: { common: 2 }, have: (s, c) => Math.min(1, c?.game.counters.awakens ?? 0) },
  { id: 'firstMythic', icon: '✨', goal: 1, reward: { common: 4 }, have: (s, c) => Math.min(1, c?.game.counters.mythics ?? 0) },
  { id: 'allMythics', icon: '🔥', goal: Object.keys(MYTHICS).length, reward: { mythic: 3 }, have: (s) => s.totals?.mythicsUsed?.length ?? 0 },
  { id: 'endless40', icon: '♾️', goal: 40, reward: { common: 6 }, have: (s) => endlessBest(s) },
  { id: 'endless60', icon: '♾️', goal: 60, reward: { mythic: 3 }, have: (s) => endlessBest(s) },
  { id: 'kills1000', icon: '⚔️', goal: 1000, reward: { common: 6 }, have: (s) => s.totals?.kills ?? 0 },
  { id: 'golden10', icon: '🪙', goal: 10, reward: { mythic: 1 }, have: (s) => s.totals?.golden ?? 0 },
  { id: 'dexMax', icon: '📖', goal: 10, reward: { mythic: 2 }, have: (s) => maxDexLevel(s) },
];
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);
const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const emptyTotals = () => ({ kills: 0, golden: 0, mythicsUsed: [] });

// 판이 끝날 때 누적 기록을 더한다: 처치, 황금 몬스터, 싸워 본 신화(피해를 준 신화)
export function addTotals(save, game) {
  const t = { ...emptyTotals(), ...(save.totals ?? {}) };
  const used = new Set(t.mythicsUsed);
  for (const id of Object.keys(game.stats?.damage ?? {})) if (MYTHICS[id]) used.add(id);
  return { ...save, totals: { kills: t.kills + game.counters.kills, golden: t.golden + game.counters.golden, mythicsUsed: [...used] } };
}

export function progressOf(save, id, ctx = null) {
  const a = byId[id];
  return { have: Math.min(a.goal, a.have(save, ctx)), goal: a.goal };
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
function rewardCards(reward, rng) {
  const cards = {};
  const give = (pool, n) => { for (let i = 0; i < n; i++) { const id = pick(pool, rng); cards[id] = (cards[id] ?? 0) + 1; } };
  give(Object.keys(TOWERS), reward.common ?? 0);
  give(Object.keys(MYTHICS), reward.mythic ?? 0);
  return cards;
}

// 판이 끝난 뒤 새로 이룬 업적을 확인한다. 보상 카드를 넣은 새 save와 달성 목록을 돌려준다.
// ctx: { game, won, wave, endless }
// 이번 판의 누적 기록(처치·황금 몬스터·싸워 본 신화)도 여기서 더한다
export function evaluate(save, ctx, rng = Math.random) {
  const withTotals = ctx?.game ? addTotals(save, ctx.game) : save;
  let next = { ...withTotals, achievements: { ...(save.achievements ?? {}) } };
  const unlocked = [];
  // 카드 보상으로 도감 레벨이 오르면 dexMax가 이어서 달성될 수 있어 두 번 확인한다
  for (let pass = 0; pass < 2; pass++) {
    for (const a of ACHIEVEMENTS) {
      if (next.achievements[a.id] || a.have(next, ctx) < a.goal) continue;
      next.achievements[a.id] = true;
      const cards = rewardCards(a.reward, rng);
      const added = addCards(next, cards);
      next = { ...added.save, achievements: next.achievements };
      unlocked.push({ id: a.id, icon: a.icon, cards, levelUps: added.levelUps });
    }
  }
  return { save: next, unlocked };
}

