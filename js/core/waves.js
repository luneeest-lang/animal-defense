export const WAVE_COUNT = 30;
const GROUP_GAP = 1.5;
// 일반 웨이브는 정확히 20마리. 열: 병사, 달리기, 분열체, 탱크, 방패병
const TYPES = ['soldier', 'runner', 'splitter', 'tank', 'shield'];
// 같은 무리끼리 최소 약 1칸(간격 x 속도) 떨어져 나오게 해서 체력바가 겹치지 않게 한다
const INTERVALS = { soldier: 0.95, runner: 0.5, splitter: 0.95, tank: 1.6, shield: 1.1 };
// 빠른 무리가 먼저 나와야 뒤 무리가 앞 무리를 따라잡지 않는다
const SPAWN_ORDER = ['runner', 'soldier', 'splitter', 'shield', 'tank'];
// 5웨이브마다 나오는 보스 (5, 10, 15, 20, 25, 30)
const BOSSES = ['boss', 'slimeKing', 'lich', 'lavaGolem', 'shadowWolf', 'dragon'];
const BOSS_INTERVAL = 3.0;
// 일반 웨이브 구성 (보스 웨이브는 null)
const COMPOSITION = [
  [20, 0, 0, 0, 0], [20, 0, 0, 0, 0], [15, 5, 0, 0, 0], [12, 5, 3, 0, 0], null,
  [9, 5, 3, 3, 0], [8, 5, 4, 3, 0], [6, 5, 3, 3, 3], [5, 5, 3, 3, 4], null,
  [3, 5, 4, 4, 4], [2, 5, 4, 4, 5], [2, 4, 4, 5, 5], [1, 4, 5, 5, 5], null,
  [1, 4, 5, 5, 5], [0, 4, 5, 5, 6], [0, 4, 5, 6, 5], [0, 3, 5, 6, 6], null,
  [0, 3, 5, 6, 6], [0, 3, 4, 7, 6], [0, 3, 4, 7, 6], [0, 2, 5, 7, 6], null,
  [0, 2, 4, 7, 7], [0, 2, 4, 7, 7], [0, 2, 4, 8, 6], [0, 2, 3, 8, 7], null,
];

// 보스가 나오기 전 경고 연출 시간(초)
export const BOSS_INTRO = 3;

export const isBossWave = (wave) => wave.groups.some((g) => BOSSES.includes(g.type));

export function buildWaves() {
  return COMPOSITION.map((counts, i) => {
    const number = i + 1;
    if (!counts) return { number, groups: [{ type: BOSSES[number / 5 - 1], count: 1, interval: BOSS_INTERVAL }] };
    return {
      number,
      groups: SPAWN_ORDER
        .map((type) => ({ type, count: counts[TYPES.indexOf(type)], interval: INTERVALS[type] }))
        .filter((g) => g.count > 0),
    };
  });
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
