import { TOWERS } from './towers.js';

// 웨이브 사이에 고르는 카드. 효과는 core/game.js의 chooseCard가 적용한다.
const ANIMAL_ICONS = { squirrel: '🐿️', elephant: '🐘', penguin: '🐧', eagle: '🦅', snake: '🐍' };

export const CARDS = {
  ...Object.fromEntries(Object.entries(TOWERS).map(([id, def]) => [`train:${id}`, {
    icon: ANIMAL_ICONS[id], name: `${def.name} 특훈`, desc: `${def.name} 공격력 +30%`,
  }])),
  haste: { icon: '⚡', name: '날쌘 발톱', desc: '모든 동물 공격 속도 +10%' },
  eye: { icon: '🔭', name: '매의 눈', desc: '모든 동물 사거리 +0.3칸' },
  treasure: { icon: '💰', name: '보물 상자', desc: '골드 +100' },
  heal: { icon: '❤️', name: '응급 치료', desc: '생명 +3' },
  lucky: { icon: '🎲', name: '행운의 소환', desc: '아기 동물 2마리 무료 소환' },
  bounty: { icon: '🪙', name: '현상금', desc: '처치 보상 +1골드' },
  frost: { icon: '🧊', name: '서리 바람', desc: '모든 몬스터 이동 속도 -8%' },
  hunter: { icon: '👑', name: '보스 사냥꾼', desc: '보스에게 주는 피해 +25%' },
};

// 서로 다른 카드 n장을 뽑는다
export function drawCards(rng = Math.random, n = 3) {
  const pool = Object.keys(CARDS);
  const picked = [];
  while (picked.length < n && pool.length) {
    picked.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  }
  return picked;
}
