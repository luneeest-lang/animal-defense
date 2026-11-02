export const WAVE_COUNT = 30;
const GROUP_GAP = 1.5;
// 일반 웨이브는 정확히 20마리. 열: 병사, 달리기, 분열체, 탱크, 방패병, 박쥐(7웨이브부터), 치유사(12웨이브부터)
const TYPES = ['soldier', 'runner', 'splitter', 'tank', 'shield', 'bat', 'healer'];
// 같은 무리끼리 최소 약 1칸(간격 x 속도) 떨어져 나오게 해서 체력바가 겹치지 않게 한다
const INTERVALS = { soldier: 0.95, runner: 0.5, splitter: 0.95, tank: 1.6, shield: 1.1, bat: 0.65, healer: 1.2 };
// 빠른 무리가 먼저 나와야 뒤 무리가 앞 무리를 따라잡지 않는다
const SPAWN_ORDER = ['runner', 'bat', 'soldier', 'splitter', 'shield', 'healer', 'tank'];
// 5웨이브마다 나오는 보스 (5, 10, 15, 20, 25, 30)
const BOSSES = ['boss', 'slimeKing', 'lich', 'lavaGolem', 'shadowWolf', 'dragon'];
const BOSS_INTERVAL = 3.0;
// 일반 웨이브 구성 (보스 웨이브는 null)
const COMPOSITION = [
  [20, 0, 0, 0, 0, 0, 0], [20, 0, 0, 0, 0, 0, 0], [15, 5, 0, 0, 0, 0, 0], [12, 5, 3, 0, 0, 0, 0], null,
  [9, 5, 3, 3, 0, 0, 0], [8, 3, 4, 3, 0, 2, 0], [6, 3, 3, 3, 3, 2, 0], [5, 3, 3, 3, 4, 2, 0], null,
  [3, 3, 4, 4, 4, 2, 0], [2, 3, 3, 4, 5, 2, 1], [2, 2, 3, 5, 5, 2, 1], [1, 2, 4, 5, 5, 2, 1], null,
  [1, 2, 4, 5, 5, 2, 1], [0, 2, 4, 5, 6, 2, 1], [0, 2, 4, 6, 5, 2, 1], [0, 2, 3, 6, 6, 2, 1], null,
  [0, 1, 4, 6, 6, 2, 1], [0, 1, 3, 7, 6, 2, 1], [0, 1, 3, 7, 6, 2, 1], [0, 1, 3, 7, 6, 2, 1], null,
  [0, 1, 2, 7, 7, 2, 1], [0, 1, 2, 7, 7, 2, 1], [0, 1, 2, 8, 6, 2, 1], [0, 1, 1, 8, 7, 2, 1], null,
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

// 무한 모드: 30웨이브 뒤로도 끝없이 이어지는 웨이브. 30까지는 보통 판과 같다.
// 31부터 일반 웨이브는 달리기 5%, 분열체 10%, 탱크 40%, 방패병 30%, 박쥐 10%, 치유사 5% 비율로 웨이브마다 0.7마리씩 늘어 최대 40마리,
// 5웨이브마다 보스가 나오고 35부터는 서로 다른 보스 2마리가 함께 나온다
const ENDLESS_MIX = [0, 0.05, 0.1, 0.4, 0.3, 0.1, 0.05];
const ENDLESS_MAX = 40;
export function waveAt(n) {
  if (n <= WAVE_COUNT) return buildWaves()[n - 1];
  if (n % 5 === 0) {
    const k = n / 5 - 1;
    const types = [BOSSES[k % BOSSES.length], ...(n >= 35 ? [BOSSES[(k + 3) % BOSSES.length]] : [])];
    return { number: n, groups: types.map((type) => ({ type, count: 1, interval: BOSS_INTERVAL })) };
  }
  const total = Math.min(ENDLESS_MAX, 20 + Math.ceil((n - WAVE_COUNT) * 0.7));
  const counts = ENDLESS_MIX.map((r) => Math.round(total * r));
  counts[3] += total - counts.reduce((a, b) => a + b, 0); // 반올림 차이는 탱크로 맞춘다
  return {
    number: n,
    groups: SPAWN_ORDER
      .map((type) => ({ type, count: counts[TYPES.indexOf(type)], interval: INTERVALS[type] }))
      .filter((g) => g.count > 0),
  };
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
