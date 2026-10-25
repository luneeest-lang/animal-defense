import { waypointPoints, pathLength, positionAt, canBuild } from './path.js';
import { ENEMIES } from '../data/enemies.js';
import { createEnemy, stepEnemy } from './enemies.js';
import { TOWERS, towerStats, upgradeCost, findTarget, fire } from './towers.js';
import { buildWaves, spawnSchedule } from './waves.js';

export const CONFIG = {
  startLives: 20,
  startGold: 150,
  sellRate: 0.7,
  firstCountdown: 10,
  waveGap: 8,
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
  };
}

const occupiedCells = (game) => new Set(game.towers.map((t) => `${t.col},${t.row}`));
const findTower = (game, id) => game.towers.find((t) => t.id === id);

export function placeTower(game, typeId, col, row) {
  const def = TOWERS[typeId];
  if (game.status !== 'running' || !def || def.cost > game.gold) return null;
  if (!canBuild(game.map, col, row, occupiedCells(game))) return null;
  const tower = { id: game.nextId++, type: typeId, col, row, level: 0, cooldown: 0, invested: def.cost };
  game.gold -= def.cost;
  game.towers.push(tower);
  return tower;
}

export function upgradeTower(game, towerId) {
  const tower = findTower(game, towerId);
  if (game.status !== 'running' || !tower) return false;
  const cost = upgradeCost(tower.type, tower.level);
  if (cost === null || cost > game.gold) return false;
  game.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
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
  if (game.countdown === null && game.spawnQueue.length === 0
      && game.waveNumber > 0 && game.waveNumber < game.waves.length) {
    game.countdown = CONFIG.waveGap;
  }
  for (const e of game.enemies) stepEnemy(e, dt);
  fireTowers(game, dt);
  resolveEnemies(game);
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
