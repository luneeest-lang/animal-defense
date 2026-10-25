import { TOWERS } from '../data/towers.js';
import { positionAt } from './path.js';
import { damageEnemy, applySlow, applyPoison } from './enemies.js';

export { TOWERS };
export const MAX_LEVEL = 3;

const UPGRADE_COST_RATIO = [0.8, 1.4, 2.2];

export function towerStats(type, level) {
  const base = TOWERS[type].base;
  const stats = {
    ...base,
    damage: base.damage * 1.5 ** level,
    range: base.range + 0.2 * level,
    cooldown: base.cooldown * 0.9 ** level,
  };
  if (base.poisonDps !== undefined) stats.poisonDps = base.poisonDps * 1.2 ** level;
  if (base.slowFactor !== undefined) stats.slowFactor = Math.max(0.3, base.slowFactor * 0.9 ** level);
  return stats;
}

export function upgradeCost(type, level) {
  if (level >= MAX_LEVEL) return null;
  return Math.round(TOWERS[type].cost * UPGRADE_COST_RATIO[level]);
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const center = (tower) => ({ x: tower.col + 0.5, y: tower.row + 0.5 });

export function findTarget(tower, enemies, points) {
  const range = towerStats(tower.type, tower.level).range;
  const from = center(tower);
  let best = null;
  for (const e of enemies) {
    if (dist2(from, positionAt(points, e.dist)) > range * range) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

export function fire(tower, target, enemies, points) {
  const stats = towerStats(tower.type, tower.level);
  const kind = TOWERS[tower.type].kind;
  const bossBonus = stats.bossMult !== undefined && target.type === 'boss' ? stats.bossMult : 1;
  let hit = [target];
  if (kind === 'splash') {
    const at = positionAt(points, target.dist);
    hit = enemies.filter((e) => dist2(at, positionAt(points, e.dist)) <= stats.splash ** 2);
  }
  for (const e of hit) damageEnemy(e, stats.damage * bossBonus, 'direct');
  if (kind === 'slow') applySlow(target, stats.slowFactor, stats.slowDuration);
  if (kind === 'poison') applyPoison(target, stats.poisonDps, stats.poisonDuration);
  return hit;
}
