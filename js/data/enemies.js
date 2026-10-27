// hp: 체력, speed: 칸/초, reward: 처치 골드, leak: 끝까지 갔을 때 줄어드는 생명
// directMult: 직접 피해 배율(독은 영향 없음), splitInto: 죽을 때 생기는 적
export const ENEMIES = {
  soldier: { hp: 40, speed: 1.0, reward: 5, leak: 1 },
  runner: { hp: 25, speed: 2.0, reward: 6, leak: 1 },
  tank: { hp: 160, speed: 0.6, reward: 12, leak: 1 },
  shield: { hp: 80, speed: 0.9, reward: 9, leak: 1, directMult: 0.5 },
  splitter: { hp: 60, speed: 1.0, reward: 8, leak: 1, splitInto: { type: 'mini', count: 2 } },
  mini: { hp: 20, speed: 1.4, reward: 2, leak: 1 },
  // 보스: 5웨이브마다 다른 보스가 1마리 나온다 (boss는 첫 보스 붉은 악마)
  boss: { name: '붉은 악마', boss: true, hp: 1500, speed: 0.5, reward: 200, leak: 5 },
  slimeKing: { name: '슬라임 왕', boss: true, hp: 1600, speed: 0.5, reward: 200, leak: 5 },
  lich: { name: '리치 왕', boss: true, hp: 1400, speed: 0.55, reward: 200, leak: 5 },
  lavaGolem: { name: '용암 거인', boss: true, hp: 2000, speed: 0.4, reward: 200, leak: 5 },
  shadowWolf: { name: '그림자 늑대', boss: true, hp: 1200, speed: 0.7, reward: 200, leak: 5 },
  dragon: { name: '흑룡', boss: true, hp: 3500, speed: 0.45, reward: 300, leak: 5 },
};
