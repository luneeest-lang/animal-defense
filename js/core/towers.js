import { TOWERS } from '../data/towers.js';
import { positionAt } from './path.js';
import { damageEnemy, applySlow, applyPoison, isBoss } from './enemies.js';

export { TOWERS };
export const MAX_LEVEL = 3;

// 합성은 타워 두 개를 하나로 줄이므로, 한 단계마다 공격력을 2배보다 크게 올린다
const LEVEL_DAMAGE = 2.2;
// 동물별 강화(골드) 1레벨마다: 공격력·독 피해 +20%, 감속 시간 +10%
const UPGRADE_DAMAGE = 0.2;
const UPGRADE_SLOW_TIME = 0.1;

export function towerStats(type, level, upgrade = 0) {
  const base = TOWERS[type].base;
  const stats = {
    ...base,
    damage: base.damage * LEVEL_DAMAGE ** level,
    range: base.range + 0.25 * level,
    cooldown: base.cooldown * 0.9 ** level,
  };
  if (base.poisonDps !== undefined) stats.poisonDps = base.poisonDps * LEVEL_DAMAGE ** level;
  if (base.slowFactor !== undefined) stats.slowFactor = Math.max(0.3, base.slowFactor * 0.85 ** level);
  if (upgrade > 0) {
    stats.damage *= 1 + UPGRADE_DAMAGE * upgrade;
    if (stats.poisonDps !== undefined) stats.poisonDps *= 1 + UPGRADE_DAMAGE * upgrade;
    if (stats.slowDuration !== undefined) stats.slowDuration *= 1 + UPGRADE_SLOW_TIME * upgrade;
  }
  return stats;
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const center = (tower) => ({ x: tower.col + 0.5, y: tower.row + 0.5 });

export function findTarget(tower, enemies, points, range = towerStats(tower.type, tower.level).range) {
  const from = center(tower);
  let best = null;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (dist2(from, positionAt(points, e.dist)) > range * range) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

// stats: 강화·카드가 반영된 능력치 (기본은 강화 없는 능력치)
export function fire(tower, target, enemies, points, stats = towerStats(tower.type, tower.level)) {
  const kind = TOWERS[tower.type].kind;
  const bossBonus = isBoss(target.type) ? (stats.bossMult ?? 1) * (stats.bossDamage ?? 1) : 1;
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
