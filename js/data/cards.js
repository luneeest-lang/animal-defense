import { TOWERS } from './towers.js';

// 보스 웨이브를 깬 뒤 고르는 카드(한 판에 5번). 효과는 core/game.js의 chooseCard가 적용한다.
// 자주 나오지 않는 보스 보상이라 한 장 한 장이 크다
export const CARD_POWER = {
  train: 1.0, // 그 동물 공격력 +100%
  haste: 0.4, // 공격 속도 +40%
  eye: 1.0, // 사거리 +1칸
  treasure: 400, // 골드
  heal: 10, // 생명
  lucky: 6, // 무료 아기 동물 소환 수
  bounty: 4, // 처치 보상 골드 추가
  frost: 0.75, // 몬스터 이동 속도 배율
  hunter: 1.0, // 보스 피해 +100%
};
const pct = (x) => Math.round(x * 100);

const ANIMAL_ICONS = { squirrel: '🐿️', elephant: '🐘', penguin: '🐧', eagle: '🦅', snake: '🐍' };

export const CARDS = {
  ...Object.fromEntries(Object.entries(TOWERS).map(([id, def]) => [`train:${id}`, {
    icon: ANIMAL_ICONS[id], name: `${def.name} 특훈`, desc: `${def.name} 공격력 +${pct(CARD_POWER.train)}%`,
  }])),
  haste: { icon: '⚡', name: '날쌘 발톱', desc: `모든 동물 공격 속도 +${pct(CARD_POWER.haste)}%` },
  eye: { icon: '🔭', name: '매의 눈', desc: `모든 동물 사거리 +${CARD_POWER.eye}칸` },
  treasure: { icon: '💰', name: '보물 상자', desc: `골드 +${CARD_POWER.treasure}` },
  heal: { icon: '❤️', name: '응급 치료', desc: `생명 +${CARD_POWER.heal}` },
  lucky: { icon: '🎲', name: '행운의 소환', desc: `아기 동물 ${CARD_POWER.lucky}마리 무료 소환` },
  bounty: { icon: '🪙', name: '현상금', desc: `처치 보상 +${CARD_POWER.bounty}골드` },
  frost: { icon: '🧊', name: '서리 바람', desc: `모든 몬스터 이동 속도 -${pct(1 - CARD_POWER.frost)}%` },
  hunter: { icon: '👑', name: '보스 사냥꾼', desc: `보스에게 주는 피해 +${pct(CARD_POWER.hunter)}%` },
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
