// 등급: 아기·청년은 일반, 성체는 희귀, 각성은 전설, 재료를 모아 만든 동물은 신화
export const GRADE_NAMES = ['일반', '희귀', '전설', '신화'];
export const GRADE_COLORS = ['#c9c9c9', '#4da3ff', '#b35cff', '#ff5ec4'];
export const gradeOf = (tower) => (tower.mythic ? 3 : tower.level >= 3 ? 2 : tower.level === 2 ? 1 : 0);

// 신화 동물. recipe는 각성 주재료(이 자리에 신화가 생긴다), 각성 재료, 성체 재료 순서다(core/mythics.js의 RECIPE_LEVELS).
// 능력치는 주재료 동물의 강화·카드 효과를 이어받는다(core/mythics.js).
// range: 칸, cooldown: 초. 해태는 사거리 없이 맵 전체를 울린다.
export const MYTHICS = {
  phoenix: {
    name: '불사조', icon: '🔥', recipe: ['eagle', 'squirrel', 'penguin'], color: '#ff7a1a',
    desc: '불꽃 깃털을 쏘고, 맞은 자리에 불길이 남아요',
    base: { damage: 450, range: 3.5, cooldown: 1.0, burnDps: 225, burnTime: 3, burnRadius: 1.0 },
  },
  gumiho: {
    name: '구미호', icon: '🦊', recipe: ['snake', 'eagle', 'elephant'], color: '#6fd3ff',
    desc: '여우불이 여러 적을 쫓고, 가끔 적을 홀려 뒤로 밀어내요',
    base: { damage: 225, range: 3.5, cooldown: 0.8, shots: 4, charmChance: 0.12, charmBack: 1.0 },
  },
  cheonma: {
    name: '천마', icon: '🐎', recipe: ['penguin', 'snake', 'elephant'], color: '#9d6bff',
    desc: '날개 바람이 일직선의 적을 꿰뚫고, 주변 동물을 빠르게 해요',
    base: { damage: 375, range: 4.5, cooldown: 1.0, width: 0.6, buffRange: 2, buffSpeed: 1.25 },
  },
  haetae: {
    name: '해태', icon: '🐯', recipe: ['elephant', 'snake', 'squirrel'], color: '#dfe8ff',
    desc: '땅을 울려 맵 전체 적에게 피해를 주고 느리게 해요',
    base: { damage: 375, range: 0, cooldown: 3.0, slowFactor: 0.6, slowDuration: 1.5 },
  },
  girin: {
    name: '기린', icon: '🦒', recipe: ['squirrel', 'eagle', 'snake'], color: '#7dffb0',
    desc: '아주 빠르게 공격하고 보스에게 강해요. 잡은 적은 골드를 더 줘요',
    base: { damage: 135, range: 3.0, cooldown: 0.2, bossMult: 2, killGold: 2 },
  },
};
