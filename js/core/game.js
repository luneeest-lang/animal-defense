import { waypointPoints, pathLength, positionAt, canBuild, pathCells } from './path.js';
import { ENEMIES } from '../data/enemies.js';
import { createEnemy, stepEnemy } from './enemies.js';
import { TOWERS, MAX_LEVEL, towerStats, findTarget, fire } from './towers.js';
import { buildWaves, spawnSchedule } from './waves.js';

export const CONFIG = {
  startLives: 20,
  startGold: 200,
  sellRate: 0.7,
  summonBase: 50,
  summonStep: 5,
  firstCountdown: 10,
  waveGap: 10,
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
  };
}

const occupiedCells = (game) => new Set(game.towers.map((t) => `${t.col},${t.row}`));
const findTower = (game, id) => game.towers.find((t) => t.id === id);

export function summonCost(game) {
  return CONFIG.summonBase + CONFIG.summonStep * game.summons;
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

// from을 to 위에 합친다. to가 한 단계 성장하고 from은 사라진다.
export function mergeTowers(game, fromId, toId) {
  if (!canMerge(game, fromId, toId)) return false;
  const from = findTower(game, fromId);
  const to = findTower(game, toId);
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

function startWave(game) {
  game.waveNumber += 1;
  const wave = game.waves[game.waveNumber - 1];
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
    fire(tower, target, targets, game.points);
    // 남은 시간(음수)을 이월해 프레임 크기와 상관없이 공격 간격을 지킨다
    tower.cooldown += towerStats(tower.type, tower.level).cooldown;
    game.events.push({
      type: 'shot',
      tower: tower.type,
      towerId: tower.id,
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
      game.events.push({ type: 'death', ...positionAt(game.points, e.dist) });
      if (def.splitInto) {
        for (let i = 0; i < def.splitInto.count; i++) {
          const child = createEnemy(game.nextId++, def.splitInto.type, e.waveNumber);
          child.dist = e.dist;
          born.push(child);
        }
      }
    } else if (e.dist >= game.length) {
      game.lives -= def.leak;
    } else {
      alive.push(e);
    }
  }
  game.enemies = alive.concat(born);
}

function substep(game, dt) {
  game.time += dt;
  if (game.countdown !== null) {
    game.countdown -= dt;
    if (game.countdown <= 0) startWave(game);
  }
  while (game.spawnQueue.length && game.spawnQueue[0].at <= game.time) {
    const s = game.spawnQueue.shift();
    game.enemies.push(createEnemy(game.nextId++, s.type, s.wave));
  }
  for (const e of game.enemies) stepEnemy(e, dt);
  fireTowers(game, dt);
  resolveEnemies(game);
  // 스폰이 끝나고 필드의 적을 모두 처리하면 다음 웨이브까지 카운트다운을 시작한다
  if (game.countdown === null && game.spawnQueue.length === 0 && game.enemies.length === 0
      && game.waveNumber > 0 && game.waveNumber < game.waves.length) {
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
