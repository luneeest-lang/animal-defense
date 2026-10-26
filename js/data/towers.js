// base는 레벨 0 능력치. 레벨별 증가는 core/towers.js의 towerStats에서 계산한다.
// range/splash: 칸, cooldown: 초, slowFactor: 이동 속도 배율, bossMult: 보스에게 주는 피해 배율
export const TOWERS = {
  squirrel: {
    name: '다람쥐', emoji: '🐿️', cost: 50, kind: 'single',
    base: { damage: 8, range: 2.5, cooldown: 0.6 },
  },
  elephant: {
    name: '코끼리', emoji: '🐘', cost: 90, kind: 'splash',
    base: { damage: 20, range: 2.2, cooldown: 1.6, splash: 1.0 },
  },
  penguin: {
    name: '펭귄', emoji: '🐧', cost: 70, kind: 'slow',
    base: { damage: 3, range: 2.4, cooldown: 0.9, slowFactor: 0.6, slowDuration: 1.5 },
  },
  eagle: {
    name: '독수리', emoji: '🦅', cost: 120, kind: 'single',
    base: { damage: 50, range: 4.5, cooldown: 1.8, bossMult: 1.5 },
  },
  snake: {
    name: '뱀', emoji: '🐍', cost: 80, kind: 'poison',
    base: { damage: 2, range: 2.5, cooldown: 1.2, poisonDps: 6, poisonDuration: 3 },
  },
};

// 레벨 0~3의 성장 단계 이름. 각성 단계는 성체 그림에 오라가 생긴다.
export const STAGE_NAMES = ['아기', '청년', '성체', '각성'];

// 각성 오라 색 (속성에 맞춘다)
export const AURA_COLORS = {
  squirrel: '#ff9f43',
  elephant: '#d9b26f',
  penguin: '#7fdcff',
  eagle: '#ffd23f',
  snake: '#7dff6a',
};
