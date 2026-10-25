export const WAVE_COUNT = 15;
const GROUP_GAP = 1.5;
const BOSS_WAVES = [5, 10, 15];

export function buildWaves() {
  const waves = [];
  for (let n = 1; n <= WAVE_COUNT; n++) {
    const groups = [{ type: 'soldier', count: 6 + 2 * (n - 1), interval: 0.7 }];
    if (n >= 3) groups.push({ type: 'runner', count: 5 + (n - 3), interval: 0.4 });
    if (n >= 4) groups.push({ type: 'splitter', count: 3 + (n - 4), interval: 0.8 });
    if (n >= 6) groups.push({ type: 'tank', count: Math.ceil(2 + 0.5 * (n - 6)), interval: 1.3 });
    if (n >= 8) groups.push({ type: 'shield', count: 3 + (n - 8), interval: 1.0 });
    if (BOSS_WAVES.includes(n)) groups.push({ type: 'boss', count: 1, interval: 3.0 });
    waves.push({ number: n, groups });
  }
  return waves;
}

export function spawnSchedule(wave) {
  const schedule = [];
  let start = 0;
  for (const g of wave.groups) {
    for (let k = 0; k < g.count; k++) schedule.push({ at: start + k * g.interval, type: g.type });
    start += (g.count - 1) * g.interval + GROUP_GAP;
  }
  return schedule;
}
