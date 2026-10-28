import { buildWaves, isBossWave, spawnSchedule } from './waves.js';
import { CONFIG, placeFree } from './game.js';

// 판마다 무작위로 정하는 이벤트: 황금 몬스터 1번(3~25웨이브의 일반 웨이브), 판 중 미션 1번(2~24웨이브에 시작).
export const GOLDEN_LAST_WAVE = 25;
export const MISSION_LAST_WAVE = 25;
const GOLDEN_PER_GAME = 1;
const MISSIONS_PER_GAME = 1;

export const goldenReward = (wave) => 50 + 5 * wave;

function pickN(pool, n, rng) {
  const left = [...pool];
  const out = [];
  while (out.length < n && left.length) out.push(left.splice(Math.min(left.length - 1, Math.floor(rng() * left.length)), 1)[0]);
  return out.sort((a, b) => a - b);
}

export function rollSchedule(rng = Math.random, waves = buildWaves()) {
  const goldenPool = [];
  for (let w = 3; w <= Math.min(GOLDEN_LAST_WAVE, waves.length); w++) if (!isBossWave(waves[w - 1])) goldenPool.push(w);
  const missionPool = [];
  for (let w = 2; w <= Math.min(MISSION_LAST_WAVE - 1, waves.length); w++) missionPool.push(w);
  return { golden: pickN(goldenPool, GOLDEN_PER_GAME, rng), missions: pickN(missionPool, MISSIONS_PER_GAME, rng) };
}

// track: 진행을 세는 카운터(game.counters)의 이름, waves: 기한(시작한 웨이브 포함 몇 웨이브 안에)
export const MISSIONS = {
  // 처치: 기한 동안 나올 몬스터의 85% (거의 놓치지 않아야 깬다)
  kill: { track: 'kills', goal: 0, waves: 2, text: (m) => `몬스터 ${m.goal}마리 처치`, reward: (w) => ({ gold: 60 + 6 * w }) },
  noLeak: { goal: 1, waves: 2, text: '생명을 잃지 않고 웨이브 클리어', reward: () => ({ lives: 2 }) },
  awaken: { track: 'awakens', goal: 1, waves: 4, text: '각성 동물 만들기', reward: () => ({ summons: 2 }) },
  trio: { goal: 3, waves: 3, text: '같은 동물 3마리 모으기', reward: () => ({ upgrade: true }) },
  golden: { track: 'golden', goal: 1, waves: 5, text: '황금 몬스터 잡기', reward: (w) => ({ gold: 100 + 10 * w }) },
  skip: { track: 'skips', goal: 3, waves: 4, text: '웨이브 바로 시작 3번', reward: (w) => ({ gold: 40 + 4 * w }) },
  upgrade: { track: 'upgrades', goal: 2, waves: 4, text: '동물 강화 2번', reward: (w) => ({ gold: 50 + 5 * w }) },
  mythic: { track: 'mythics', goal: 1, waves: 6, text: '신화 동물 만들기', reward: (w) => ({ gold: 150 + 10 * w, lives: 3 }) },
};

// 지금 고를 수 있는 미션: 황금 몬스터 미션은 기한 안에 황금 몬스터가 남아 있을 때만, 신화 미션은 8웨이브부터
function eligible(game, id) {
  const def = MISSIONS[id];
  if (id === game.lastMission) return false;
  if (id === 'golden') return game.schedule.golden.some((w) => w >= game.waveNumber && w <= game.waveNumber + def.waves - 1);
  if (id === 'mythic') return game.waveNumber >= 8;
  return true;
}

export function missionText(m) {
  const def = MISSIONS[m.id];
  const text = typeof def.text === 'function' ? def.text(m) : def.text;
  return `${text} (${Math.min(m.progress, m.goal)}/${m.goal})`;
}

// 처치 미션의 목표: 기한 안의 웨이브들에 나올 몬스터 수의 85%
function killGoal(game, waves) {
  let count = 0;
  const first = Math.max(1, game.waveNumber);
  for (let w = first; w < first + waves && w <= game.waves.length; w++) count += spawnSchedule(game.waves[w - 1]).length;
  return Math.max(5, Math.round(count * 0.85));
}

export function startMission(game, id) {
  const def = MISSIONS[id];
  game.mission = {
    id,
    goal: id === 'kill' ? killGoal(game, def.waves) : def.goal,
    progress: 0,
    base: def.track ? game.counters[def.track] : 0,
    deadline: game.waveNumber + def.waves - 1 + (game.waveNumber === 0 ? 1 : 0),
    reward: def.reward(Math.max(1, game.waveNumber)),
  };
  game.lastMission = id;
  game.events.push({ type: 'missionStart', mission: id });
  return game.mission;
}

// 같은 동물(신화 제외) 중 가장 많은 동물과 그 수
function mostCommon(game) {
  const count = {};
  for (const t of game.towers) if (!t.mythic) count[t.type] = (count[t.type] ?? 0) + 1;
  let best = null;
  for (const [type, n] of Object.entries(count)) if (!best || n > best.n) best = { type, n };
  return best ?? { type: null, n: 0 };
}

function giveReward(game, m) {
  const r = m.reward;
  if (r.gold) game.gold += r.gold;
  if (r.lives) game.lives += r.lives;
  if (r.summons) for (let i = 0; i < r.summons; i++) placeFree(game, game.rng);
  if (r.upgrade) {
    const { type } = mostCommon(game);
    if (type && game.upgrades[type] < CONFIG.upgradeCosts.length) game.upgrades[type] += 1;
    else game.gold += 80;
    r.upgradeType = type;
  }
}

// 매 순간: 진행을 다시 세고, 목표에 닿으면 보상을 준다
export function updateMission(game) {
  const m = game.mission;
  if (!m) return;
  const def = MISSIONS[m.id];
  if (def.track) m.progress = game.counters[def.track] - m.base;
  else if (m.id === 'trio') m.progress = mostCommon(game).n;
  if (m.progress >= m.goal) {
    giveReward(game, m);
    game.events.push({ type: 'missionDone', mission: m.id, reward: m.reward });
    game.mission = null;
  }
}

// 웨이브가 시작될 때: 기한이 지난 미션은 실패, 정해진(또는 미뤄진) 미션 시작, 황금 몬스터 예약
export function onWaveStart(game, waveEnd) {
  const w = game.waveNumber;
  game.waveLeaked = false;
  if (game.mission && w > game.mission.deadline) {
    game.events.push({ type: 'missionFail', mission: game.mission.id });
    game.mission = null;
  }
  if (!game.mission && w <= MISSION_LAST_WAVE && game.schedule.missions.length && game.schedule.missions[0] <= w) {
    game.schedule.missions.shift();
    const ids = Object.keys(MISSIONS).filter((id) => eligible(game, id));
    if (ids.length) startMission(game, ids[Math.min(ids.length - 1, Math.floor(game.rng() * ids.length))]);
  }
  if (game.schedule.golden.includes(w)) {
    game.schedule.golden = game.schedule.golden.filter((x) => x !== w);
    game.spawnQueue.push({ at: game.time + 1 + game.rng() * Math.max(0, waveEnd - 1), type: 'golden', wave: w });
    game.spawnQueue.sort((a, b) => a.at - b.at);
  }
}

// 웨이브를 끝냈을 때: 생명을 잃지 않았으면 무손실 미션 달성
export function onWaveClear(game) {
  if (game.mission?.id === 'noLeak' && !game.waveLeaked) game.mission.progress = 1;
  updateMission(game);
}

