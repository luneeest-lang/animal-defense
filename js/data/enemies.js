// hp: 체력, speed: 칸/초, reward: 처치 골드, leak: 끝까지 갔을 때 줄어드는 생명
// directMult: 직접 피해 배율(독은 영향 없음), splitInto: 죽을 때 생기는 적
export const ENEMIES = {
  soldier: { hp: 40, speed: 1.0, reward: 5, leak: 1 },
  runner: { hp: 25, speed: 2.0, reward: 6, leak: 1 },
  tank: { hp: 160, speed: 0.6, reward: 12, leak: 1 },
  shield: { hp: 80, speed: 0.9, reward: 9, leak: 1, directMult: 0.5 },
  splitter: { hp: 60, speed: 1.0, reward: 8, leak: 1, splitInto: { type: 'mini', count: 2 } },
  mini: { hp: 20, speed: 1.4, reward: 2, leak: 1 },
  boss: { hp: 1500, speed: 0.5, reward: 100, leak: 5 },
};
