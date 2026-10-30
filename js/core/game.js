import { waypointPoints, pathLength, positionAt, canBuild, pathCells } from './path.js';
import { ENEMIES } from '../data/enemies.js';
import { createEnemy, stepEnemy } from './enemies.js';
import { TOWERS, MAX_LEVEL, towerStats, findTarget, fire } from './towers.js';
import { mythicStats, fireMythic, updateZones, cheonmaBuff } from './mythics.js';
import {
  rollSchedule, onWaveStart, onWaveClear, updateMission, goldenReward,
} from './missions.js';
import { buildWaves, spawnSchedule, isBossWave, BOSS_INTRO, WAVE_COUNT } from './waves.js';
import { CARDS, CARD_POWER, drawCards } from '../data/cards.js';

export const CONFIG = {
  startLives: 20,
  startGold: 250,
  sellRate: 0.7,
  summonBase: 50,
  summonStep: 5, // 5웨이브마다 오르는 소환 비용
  summonStepWaves: 5,
  firstCountdown: 10,
  waveGap: 10,
  waveClearBonus: 10, // 웨이브의 적을 모두 처리하면 받는 골드
  upgradeCosts: [80, 120, 160, 200, 240], // 동물별 강화 Lv.1~5 비용
  maxSubstep: 0.05,
};

export function createGame(map, waves = buildWaves()) {
  const points = waypointPoints(map);
  return {
    map,
    points,
    length: pathLength(points),
    waves,
    gold: CONFIG.startGold,
    lives: CONFIG.startLives,
    waveNumber: 0,
    countdown: CONFIG.firstCountdown,
    spawnQueue: [],
    enemies: [],
    towers: [],
    events: [],
    status: 'running',
    time: 0,
    nextId: 1,
    summons: 0,
    upgrades: Object.fromEntries(Object.keys(TOWERS).map((id) => [id, 0])), // 동물별 강화 레벨
    clearedWave: 0, // 보너스를 이미 준 마지막 웨이브 번호
    bossWarning: 0,
    bossWarningType: null, // 경고 중인 보스 종류 (경고 문구용)
    rng: Math.random, // 카드 뽑기·행운의 소환에 쓰는 무작위 (테스트에서 바꿔 끼운다)
    cardChoices: null, // 웨이브를 끝내고 고를 카드 id 3개. 고르는 동안 게임이 멈춘다
    cardsTaken: [],
    zones: [], // 불사조가 남긴 불길 { x, y, r, dps, left }
    // 판마다 무작위로 정하는 황금 몬스터·미션 웨이브 (core/missions.js). 테스트용 짧은 웨이브 목록에는 없다
    schedule: waves.length === WAVE_COUNT ? rollSchedule(Math.random, waves) : { golden: [], missions: [] },
    mission: null, // 진행 중인 미션
    lastMission: null,
    waveLeaked: false, // 이번 웨이브에 생명을 잃었는지 (무손실 미션)
    // 미션 진행을 세는 카운터
    counters: { kills: 0, golden: 0, skips: 0, upgrades: 0, awakens: 0, mythics: 0 },
    // 카드로 얻은 효과
    mods: {
      damage: Object.fromEntries(Object.keys(TOWERS).map((id) => [id, 1])),
      attackSpeed: 1, range: 0, bounty: 0, enemySpeed: 1, bossDamage: 1,
    }, // 보스 경고 연출이 남은 시간(초). 0이면 경고 없음
  };
}

const occupiedCells = (game) => new Set(game.towers.map((t) => `${t.col},${t.row}`));
const findTower = (game, id) => game.towers.find((t) => t.id === id);

// 소환 비용은 소환 횟수와 상관없이 웨이브 구간으로 정한다: 1~5웨이브 50, 6~10 55, 11~15 60
export function summonCost(game) {
  const tier = Math.floor(Math.max(0, game.waveNumber - 1) / CONFIG.summonStepWaves);
  return CONFIG.summonBase + CONFIG.summonStep * tier;
}

// 길 바로 옆(대각선 포함 1칸)인 칸. 소환된 타워가 사거리 밖에서 놀지 않게 이 칸들에만 소환한다.
function nearPath(map, col, row, path) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) if (path.has(`${col + dc},${row + dr}`)) return true;
  }
  return false;
}

// 소환할 수 있는 빈 칸 [col, row] 목록 (위에서 아래, 왼쪽에서 오른쪽 순서)
export function emptyCells(game) {
  const occupied = occupiedCells(game);
  const path = pathCells(game.map);
  const cells = [];
  for (let r = 0; r < game.map.rows; r++) {
    for (let c = 0; c < game.map.cols; c++) {
      if (canBuild(game.map, c, r, occupied) && nearPath(game.map, c, r, path)) cells.push([c, r]);
    }
  }
  return cells;
}

// 비용 없이 타워를 놓는다. 소환과 테스트에서 쓴다.
export function addTower(game, typeId, col, row, level = 0) {
  if (!TOWERS[typeId] || !canBuild(game.map, col, row, occupiedCells(game))) return null;
  const tower = { id: game.nextId++, type: typeId, col, row, level, cooldown: 0, invested: 0 };
  game.towers.push(tower);
  return tower;
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// 강화와 카드 효과가 반영된 실제 능력치
export function effectiveStats(game, tower) {
  if (tower.mythic) return mythicStats(game, tower);
  const stats = towerStats(tower.type, tower.level, game.upgrades[tower.type]);
  const { mods } = game;
  stats.damage *= mods.damage[tower.type];
  if (stats.poisonDps !== undefined) stats.poisonDps *= mods.damage[tower.type];
  stats.cooldown /= mods.attackSpeed * cheonmaBuff(game, tower);
  stats.range += mods.range;
  stats.bossDamage = mods.bossDamage;
  return stats;
}

// 고른 카드의 효과를 적용한다. 지금 나와 있는 카드 중 하나여야 한다.
export function chooseCard(game, cardId) {
  if (!game.cardChoices || !game.cardChoices.includes(cardId) || !CARDS[cardId]) return false;
  const { mods } = game;
  const P = CARD_POWER;
  if (cardId.startsWith('train:')) mods.damage[cardId.slice(6)] += P.train;
  else if (cardId === 'haste') mods.attackSpeed += P.haste;
  else if (cardId === 'eye') mods.range += P.eye;
  else if (cardId === 'treasure') game.gold += P.treasure;
  else if (cardId === 'heal') addLives(game, P.heal);
  else if (cardId === 'lucky') for (let i = 0; i < P.lucky; i++) placeRandom(game, game.rng);
  else if (cardId === 'bounty') mods.bounty += P.bounty;
  else if (cardId === 'frost') mods.enemySpeed *= P.frost;
  else if (cardId === 'hunter') mods.bossDamage += P.hunter;
  game.cardsTaken.push(cardId);
  game.cardChoices = null;
  return true;
}

// 무작위 동물을 무작위 빈 칸에 아기로 놓는다 (비용 없음). 칸이 없으면 null
// 미션 보상의 무료 소환에도 쓴다
export const placeFree = (game, rng) => placeRandom(game, rng);

function placeRandom(game, rng) {
  const cells = emptyCells(game);
  if (cells.length === 0) return null;
  const type = pick(Object.keys(TOWERS), rng);
  const [col, row] = pick(cells, rng);
  return addTower(game, type, col, row);
}

// 무작위 동물을 무작위 빈 칸에 아기 단계로 소환한다.
// 생명을 얻는다(카드·미션 보상). 처음 생명(20)까지만 차고 넘치는 만큼은 사라진다
export function addLives(game, n) {
  game.lives = Math.max(game.lives, Math.min(CONFIG.startLives, game.lives + n));
}

export function summonTower(game, rng = Math.random) {
  const cost = summonCost(game);
  if (game.status !== 'running' || cost > game.gold) return null;
  const tower = placeRandom(game, rng);
  if (!tower) return null;
  tower.invested = cost;
  game.gold -= cost;
  game.summons += 1;
  return tower;
}

export function canMerge(game, fromId, toId) {
  const from = findTower(game, fromId);
  const to = findTower(game, toId);
  return game.status === 'running' && !!from && !!to && from !== to
    && !from.mythic && !to.mythic && from.type === to.type && from.level === to.level && to.level < MAX_LEVEL;
}

// from을 to 위에 합친다. to 자리에 5종 중 무작위 동물이 한 단계 성장해 나오고 from은 사라진다.
export function mergeTowers(game, fromId, toId, rng = Math.random) {
  if (!canMerge(game, fromId, toId)) return false;
  const from = findTower(game, fromId);
  const to = findTower(game, toId);
  to.type = pick(Object.keys(TOWERS), rng);
  to.level += 1;
  if (to.level === MAX_LEVEL) game.counters.awakens += 1;
  to.invested += from.invested;
  game.towers = game.towers.filter((t) => t !== from);
  return true;
}

export function sellTower(game, towerId) {
  const tower = findTower(game, towerId);
  if (game.status !== 'running' || !tower) return 0;
  const refund = Math.floor(tower.invested * CONFIG.sellRate + 1e-9);
  game.gold += refund;
  game.towers = game.towers.filter((t) => t !== tower);
  return refund;
}

// 동물별 강화 다음 레벨 비용. 최대 레벨이면 null
export function upgradeCost(game, typeId) {
  const level = game.upgrades[typeId];
  return level === undefined || level >= CONFIG.upgradeCosts.length ? null : CONFIG.upgradeCosts[level];
}

// 그 동물 전체(놓인 것과 앞으로 소환될 것)를 한 레벨 강화한다
export function upgradeAnimal(game, typeId) {
  const cost = upgradeCost(game, typeId);
  if (game.status !== 'running' || cost === null || cost > game.gold) return false;
  game.gold -= cost;
  game.upgrades[typeId] += 1;
  game.counters.upgrades += 1;
  return true;
}

// 보스 능력 상태 (중급·고급 맵에서만)
const BOSS_SKILLS = {
  boss: () => ({ rage: false }),
  slimeKing: () => ({ nextSplit: 0.75 }),
  lich: () => ({ timer: 5, summoned: 0 }),
  lavaGolem: () => ({}),
  shadowWolf: () => ({ timer: 6, dashLeft: 0 }),
  dragon: () => ({ timer: 8 }),
};

// 맵 난이도(체력 배율)는 첫 웨이브부터 바로 다 걸지 않고 HP_RAMP_WAVES 웨이브 동안 서서히 올린다.
// 어려운 맵에서 소환·합성 운이 나쁘면 2~3웨이브에 바로 지던 것을 줄인다.
const HP_RAMP_WAVES = 8;
export function mapHpMult(map, waveNumber) {
  const m = map.hpMult ?? 1;
  return 1 + (m - 1) * Math.min(1, waveNumber / HP_RAMP_WAVES);
}

// 몬스터를 길 위 dist 지점에 만든다. 맵 체력 배율과 보스 능력을 함께 정한다.
export function spawnEnemy(game, type, waveNumber, dist = 0) {
  const e = createEnemy(game.nextId++, type, waveNumber, mapHpMult(game.map, waveNumber));
  e.dist = dist;
  if (ENEMIES[type].golden) {
    e.bonusGold = goldenReward(waveNumber);
    game.events.push({ type: 'goldenSpawn', enemyId: e.id, ...positionAt(game.points, dist) });
  }
  if (game.map.bossAbilities && BOSS_SKILLS[type]) {
    e.skill = BOSS_SKILLS[type]();
    if (type === 'lavaGolem') e.armor = 0.7;
  }
  game.enemies.push(e);
  return e;
}

const skillEvent = (game, e, skill) => game.events.push({ type: 'bossSkill', skill, enemy: e.type, ...positionAt(game.points, e.dist) });

// 보스 고유 능력. 몬스터가 움직이기 전에 매 순간 확인한다.
function updateBossSkills(game, dt) {
  for (const e of [...game.enemies]) {
    const s = e.skill;
    if (!s || e.hp <= 0) continue;
    if (e.type === 'boss' && !s.rage && e.hp <= e.maxHp / 2) {
      s.rage = true;
      e.abilitySpeed = 1.5;
      skillEvent(game, e, 'rage');
    } else if (e.type === 'slimeKing') {
      while (s.nextSplit > 0 && e.hp <= e.maxHp * s.nextSplit) {
        s.nextSplit -= 0.25;
        for (let i = 0; i < 2; i++) spawnEnemy(game, 'mini', e.waveNumber, e.dist);
        skillEvent(game, e, 'split');
      }
    } else if (e.type === 'lich') {
      s.timer -= dt;
      if (s.timer <= 0 && s.summoned < 6) {
        s.timer += 5;
        s.summoned += 1;
        spawnEnemy(game, 'shield', e.waveNumber, e.dist);
        skillEvent(game, e, 'summon');
      }
    } else if (e.type === 'shadowWolf') {
      if (s.dashLeft > 0) s.dashLeft -= dt;
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer += 6;
        s.dashLeft = 1.5;
        skillEvent(game, e, 'dash');
      }
      e.abilitySpeed = s.dashLeft > 0 ? 3 : 1;
    } else if (e.type === 'dragon') {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer += 8;
        const at = positionAt(game.points, e.dist);
        for (const t of game.towers) {
          if ((t.col + 0.5 - at.x) ** 2 + (t.row + 0.5 - at.y) ** 2 <= 2.5 ** 2) t.stunUntil = game.time + 2;
        }
        skillEvent(game, e, 'roar');
      }
    }
  }
}

function startWave(game) {
  game.waveNumber += 1;
  const wave = game.waves[game.waveNumber - 1];
  game.bossWarning = isBossWave(wave) ? BOSS_INTRO : 0;
  game.bossWarningType = isBossWave(wave) ? wave.groups[0].type : null;
  const schedule = spawnSchedule(wave);
  for (const s of schedule) {
    game.spawnQueue.push({ at: game.time + s.at, type: s.type, wave: game.waveNumber });
  }
  game.countdown = null;
  onWaveStart(game, schedule.length ? Math.max(...schedule.map((s) => s.at)) : 0);
}

export function callNextWave(game) {
  if (game.status !== 'running' || game.cardChoices || game.countdown === null || game.waveNumber >= game.waves.length) return 0;
  const bonus = Math.ceil(game.countdown);
  game.counters.skips += 1;
  startWave(game);
  game.gold += bonus;
  return bonus;
}

function fireTowers(game, dt) {
  const targets = game.enemies.filter((e) => e.hp > 0 && e.dist < game.length);
  for (const tower of game.towers) {
    // 흑룡의 포효에 기절한 동물은 쏘지 않는다
    if (tower.stunUntil > game.time) continue;
    if (tower.mythic) {
      fireMythic(game, tower, targets, dt);
      continue;
    }
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const stats = effectiveStats(game, tower);
    const target = findTarget(tower, targets, game.points, stats.range);
    if (!target) {
      tower.cooldown = 0;
      continue;
    }
    const hpBefore = new Map(targets.map((e) => [e, e.hp]));
    const hit = fire(tower, target, targets, game.points, stats);
    // 맞은 적마다 실제로 들어간 피해량 (화면의 데미지 숫자용)
    for (const e of hit) {
      game.events.push({ type: 'hit', enemyId: e.id, amount: hpBefore.get(e) - e.hp, ...positionAt(game.points, e.dist) });
    }
    // 남은 시간(음수)을 이월해 프레임 크기와 상관없이 공격 간격을 지킨다
    tower.cooldown += stats.cooldown;
    game.events.push({
      type: 'shot',
      tower: tower.type,
      towerId: tower.id,
      targetId: target.id,
      from: { x: tower.col + 0.5, y: tower.row + 0.5 },
      to: positionAt(game.points, target.dist),
    });
  }
}

function resolveEnemies(game) {
  const alive = [];
  const born = [];
  for (const e of game.enemies) {
    const def = ENEMIES[e.type];
    if (e.hp <= 0) {
      const reward = def.reward + game.mods.bounty + (e.bonusGold ?? 0);
      game.gold += reward;
      game.counters.kills += 1;
      if (def.golden) game.counters.golden += 1;
      game.events.push({ type: 'death', enemy: e.type, reward, ...positionAt(game.points, e.dist) });
      if (def.splitInto) {
        for (let i = 0; i < def.splitInto.count; i++) {
          born.push(createEnemy(game.nextId++, def.splitInto.type, e.waveNumber, mapHpMult(game.map, e.waveNumber)));
          born[born.length - 1].dist = e.dist;
        }
      }
    } else if (e.dist >= game.length && def.golden) {
      // 황금 몬스터는 블랙홀로 도망칠 뿐 생명을 깎지 않는다
      game.events.push({ type: 'goldenEscape', enemy: e.type, ...positionAt(game.points, e.dist) });
    } else if (e.dist >= game.length) {
      game.lives -= def.leak;
      game.waveLeaked = true;
      game.events.push({ type: 'leak', enemy: e.type, lives: def.leak, ...positionAt(game.points, e.dist) });
    } else {
      alive.push(e);
    }
  }
  game.enemies = alive.concat(born);
}

function substep(game, dt) {
  game.time += dt;
  game.bossWarning = Math.max(0, game.bossWarning - dt);
  if (game.countdown !== null) {
    game.countdown -= dt;
    if (game.countdown <= 0) startWave(game);
  }
  while (game.spawnQueue.length && game.spawnQueue[0].at <= game.time) {
    const s = game.spawnQueue.shift();
    spawnEnemy(game, s.type, s.wave);
  }
  updateBossSkills(game, dt);
  for (const e of game.enemies) stepEnemy(e, dt, game.mods.enemySpeed);
  fireTowers(game, dt);
  updateZones(game, dt);
  resolveEnemies(game);
  updateMission(game);
  // 스폰이 끝나고 필드의 적을 모두 처리하면 보너스를 주고 다음 웨이브까지 카운트다운을 시작한다
  const cleared = game.waveNumber > 0 && game.spawnQueue.length === 0 && game.enemies.length === 0;
  if (cleared && game.clearedWave < game.waveNumber && game.lives > 0) {
    game.clearedWave = game.waveNumber;
    game.gold += CONFIG.waveClearBonus;
    game.events.push({ type: 'waveClear', wave: game.waveNumber, bonus: CONFIG.waveClearBonus });
    onWaveClear(game);
    // 보스 웨이브(5·10·15·20·25)를 깨면 카드 3장 중 1장을 고른다 (고를 때까지 게임이 멈춘다). 마지막 웨이브는 없다
    const wave = game.waves[game.waveNumber - 1];
    if (game.waveNumber < game.waves.length && isBossWave(wave)) game.cardChoices = drawCards(game.rng);
  }
  if (cleared && game.countdown === null && game.waveNumber < game.waves.length) {
    game.countdown = CONFIG.waveGap;
  }
  if (game.lives <= 0) {
    game.lives = 0;
    game.status = 'lost';
  } else if (game.waveNumber === game.waves.length && game.spawnQueue.length === 0 && game.enemies.length === 0) {
    game.status = 'won';
  }
}

export function step(game, dt) {
  if (game.status !== 'running' || game.cardChoices) return;
  game.events = [];
  let left = dt;
  while (left > 1e-9 && game.status === 'running' && !game.cardChoices) {
    const h = Math.min(left, CONFIG.maxSubstep);
    substep(game, h);
    left -= h;
  }
}
