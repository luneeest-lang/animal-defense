import { waypointPoints, pathLength, positionAt, canBuild, pathCells } from './path.js';
import { ENEMIES } from '../data/enemies.js';
import { createEnemy, stepEnemy } from './enemies.js';
import { TOWERS, MAX_LEVEL, towerStats, findTarget, fire } from './towers.js';
import { buildWaves, spawnSchedule, isBossWave, BOSS_INTRO } from './waves.js';

export const CONFIG = {
  startLives: 20,
  startGold: 200,
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
    bossWarning: 0, // 보스 경고 연출이 남은 시간(초). 0이면 경고 없음
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

// 무작위 동물을 무작위 빈 칸에 아기 단계로 소환한다.
export function summonTower(game, rng = Math.random) {
  const cost = summonCost(game);
  if (game.status !== 'running' || cost > game.gold) return null;
  const cells = emptyCells(game);
  if (cells.length === 0) return null;
  const type = pick(Object.keys(TOWERS), rng);
  const [col, row] = pick(cells, rng);
  const tower = addTower(game, type, col, row);
  tower.invested = cost;
  game.gold -= cost;
  game.summons += 1;
  return tower;
}

export function canMerge(game, fromId, toId) {
  const from = findTower(game, fromId);
  const to = findTower(game, toId);
  return game.status === 'running' && !!from && !!to && from !== to
    && from.type === to.type && from.level === to.level && to.level < MAX_LEVEL;
}

// from을 to 위에 합친다. to 자리에 5종 중 무작위 동물이 한 단계 성장해 나오고 from은 사라진다.
export function mergeTowers(game, fromId, toId, rng = Math.random) {
  if (!canMerge(game, fromId, toId)) return false;
  const from = findTower(game, fromId);
  const to = findTower(game, toId);
  to.type = pick(Object.keys(TOWERS), rng);
  to.level += 1;
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
  return true;
}

function startWave(game) {
  game.waveNumber += 1;
  const wave = game.waves[game.waveNumber - 1];
  game.bossWarning = isBossWave(wave) ? BOSS_INTRO : 0;
  for (const s of spawnSchedule(wave)) {
    game.spawnQueue.push({ at: game.time + s.at, type: s.type, wave: game.waveNumber });
  }
  game.countdown = null;
}

export function callNextWave(game) {
  if (game.status !== 'running' || game.countdown === null || game.waveNumber >= game.waves.length) return 0;
  const bonus = Math.ceil(game.countdown);
  startWave(game);
  game.gold += bonus;
  return bonus;
}

function fireTowers(game, dt) {
  const targets = game.enemies.filter((e) => e.hp > 0 && e.dist < game.length);
  for (const tower of game.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const target = findTarget(tower, targets, game.points);
    if (!target) {
      tower.cooldown = 0;
      continue;
    }
    const hpBefore = new Map(targets.map((e) => [e, e.hp]));
    const hit = fire(tower, target, targets, game.points, game.upgrades[tower.type]);
    // 맞은 적마다 실제로 들어간 피해량 (화면의 데미지 숫자용)
    for (const e of hit) {
      game.events.push({ type: 'hit', enemyId: e.id, amount: hpBefore.get(e) - e.hp, ...positionAt(game.points, e.dist) });
    }
    // 남은 시간(음수)을 이월해 프레임 크기와 상관없이 공격 간격을 지킨다
    tower.cooldown += towerStats(tower.type, tower.level).cooldown;
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
      game.gold += def.reward;
      game.events.push({ type: 'death', enemy: e.type, reward: def.reward, ...positionAt(game.points, e.dist) });
      if (def.splitInto) {
        for (let i = 0; i < def.splitInto.count; i++) {
          const child = createEnemy(game.nextId++, def.splitInto.type, e.waveNumber, game.map.hpMult ?? 1);
          child.dist = e.dist;
          born.push(child);
        }
      }
    } else if (e.dist >= game.length) {
      game.lives -= def.leak;
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
    game.enemies.push(createEnemy(game.nextId++, s.type, s.wave, game.map.hpMult ?? 1));
  }
  for (const e of game.enemies) stepEnemy(e, dt);
  fireTowers(game, dt);
  resolveEnemies(game);
  // 스폰이 끝나고 필드의 적을 모두 처리하면 보너스를 주고 다음 웨이브까지 카운트다운을 시작한다
  const cleared = game.waveNumber > 0 && game.spawnQueue.length === 0 && game.enemies.length === 0;
  if (cleared && game.clearedWave < game.waveNumber && game.lives > 0) {
    game.clearedWave = game.waveNumber;
    game.gold += CONFIG.waveClearBonus;
    game.events.push({ type: 'waveClear', wave: game.waveNumber, bonus: CONFIG.waveClearBonus });
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
  if (game.status !== 'running') return;
  game.events = [];
  let left = dt;
  while (left > 1e-9 && game.status === 'running') {
    const h = Math.min(left, CONFIG.maxSubstep);
    substep(game, h);
    left -= h;
  }
}
