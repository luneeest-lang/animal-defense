export const WAVE_COUNT = 15;
const GROUP_GAP = 1.5;
// 보스 웨이브(5, 10, 15)는 보스 1마리만, 나머지는 정확히 20마리. 열: 병사, 달리기, 분열체, 탱크, 방패병, 보스
const TYPES = ['soldier', 'runner', 'splitter', 'tank', 'shield', 'boss'];
const INTERVALS = { soldier: 0.7, runner: 0.4, splitter: 0.8, tank: 1.3, shield: 1.0, boss: 3.0 };
const COMPOSITION = [
  [20, 0, 0, 0, 0, 0],
  [20, 0, 0, 0, 0, 0],
  [15, 5, 0, 0, 0, 0],
  [12, 5, 3, 0, 0, 0],
  [0, 0, 0, 0, 0, 1],
  [9, 5, 3, 3, 0, 0],
  [8, 5, 4, 3, 0, 0],
  [6, 5, 3, 3, 3, 0],
  [5, 5, 3, 3, 4, 0],
  [0, 0, 0, 0, 0, 1],
  [3, 5, 4, 4, 4, 0],
  [2, 5, 4, 4, 5, 0],
  [2, 4, 4, 5, 5, 0],
  [1, 4, 5, 5, 5, 0],
  [0, 0, 0, 0, 0, 1],
];

// 보스가 나오기 전 경고 연출 시간(초)
export const BOSS_INTRO = 3;

export const isBossWave = (wave) => wave.groups.some((g) => g.type === 'boss');

export function buildWaves() {
  return COMPOSITION.map((counts, i) => ({
    number: i + 1,
    groups: TYPES
      .map((type, k) => ({ type, count: counts[k], interval: INTERVALS[type] }))
      .filter((g) => g.count > 0),
  }));
}

export function spawnSchedule(wave) {
  const schedule = [];
  let start = isBossWave(wave) ? BOSS_INTRO : 0;
  for (const g of wave.groups) {
    for (let k = 0; k < g.count; k++) schedule.push({ at: start + k * g.interval, type: g.type });
    start += (g.count - 1) * g.interval + GROUP_GAP;
  }
  return schedule;
}
