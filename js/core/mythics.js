import { MYTHICS } from '../data/mythics.js';
import { MAX_LEVEL } from './towers.js';
import { positionAt } from './path.js';
import { damageEnemy, applySlow, isBoss } from './enemies.js';
import { credit } from './stats.js';
import { dexDamage } from './dex.js';

const UPGRADE_DAMAGE = 0.2;
const center = (t) => ({ x: t.col + 0.5, y: t.row + 0.5 });
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// 재료 단계: 주재료 각성, 둘째 재료 각성, 셋째 재료 성체
export const RECIPE_LEVELS = [MAX_LEVEL, MAX_LEVEL, MAX_LEVEL - 1];

// 재료 칸마다 쓸 수 있는 동물(없으면 null). main은 주재료(이 자리에 신화가 생긴다), subs는 나머지
export function findMaterials(game, id) {
  const free = game.towers.filter((t) => !t.mythic);
  const [main, ...subs] = MYTHICS[id].recipe.map((type, i) => free.find((t) => t.type === type && t.level === RECIPE_LEVELS[i]) ?? null);
  return { main, subs };
}

export function canCraft(game, id) {
  if (game.status !== 'running' || !MYTHICS[id]) return false;
  const { main, subs } = findMaterials(game, id);
  return !!main && subs.every(Boolean);
}

// 재료 셋을 써서 각성 동물 자리에 신화를 만든다
export function craftMythic(game, id) {
  if (!canCraft(game, id)) return null;
  const { main, subs } = findMaterials(game, id);
  game.towers = game.towers.filter((t) => !subs.includes(t));
  main.invested += subs.reduce((s, t) => s + t.invested, 0);
  Object.assign(main, { type: id, mythic: true, level: 0, cooldown: 0 });
  if (game.counters) game.counters.mythics += 1;
  game.events.push({ type: 'mythic', mythic: id, towerId: main.id, ...center(main) });
  return main;
}

// 주재료 동물의 강화·카드(공격력)와 공통 카드(공격 속도, 사거리, 보스 피해)를 반영한 능력치
export function mythicStats(game, tower) {
  const def = MYTHICS[tower.type];
  const owner = def.recipe[0];
  const { mods } = game;
  const stats = { ...def.base };
  // 도감 레벨은 신화 자신의 것 (주재료 동물의 도감과 따로)
  const mult = (1 + UPGRADE_DAMAGE * game.upgrades[owner]) * mods.damage[owner] * dexDamage(game, tower.type);
  stats.damage *= mult;
  if (stats.burnDps !== undefined) stats.burnDps *= mult;
  stats.cooldown /= mods.attackSpeed;
  if (stats.range) stats.range += mods.range;
  stats.bossDamage = mods.bossDamage;
  return stats;
}

// 천마 근처(사거리 buffRange 안)의 일반 동물이 받는 공격 속도 배율
export function cheonmaBuff(game, tower) {
  const { buffRange, buffSpeed } = MYTHICS.cheonma.base;
  const near = game.towers.some((t) => t.type === 'cheonma' && t !== tower && dist2(center(t), center(tower)) <= buffRange ** 2);
  return near ? buffSpeed : 1;
}

function hitEnemy(game, e, amount, stats, by) {
  const bonus = isBoss(e.type) ? (stats.bossMult ?? 1) * (stats.bossDamage ?? 1) : 1;
  const before = e.hp;
  damageEnemy(e, amount * bonus, 'direct');
  credit(game, e, by, before);
  game.events.push({ type: 'hit', enemyId: e.id, amount: before - e.hp, ...positionAt(game.points, e.dist) });
}

// 사거리 안의 적을 길을 많이 간 순서로
function inRange(game, tower, targets, range) {
  const from = center(tower);
  return targets
    .filter((e) => e.hp > 0 && dist2(from, positionAt(game.points, e.dist)) <= range * range)
    .sort((a, b) => b.dist - a.dist);
}

// 신화 한 번 공격. 쏠 적이 없으면 false
function attack(game, tower, targets, stats) {
  const from = center(tower);
  const shot = (to, extra = {}) => game.events.push({ type: 'mythicShot', mythic: tower.type, towerId: tower.id, from, to, ...extra });
  if (tower.type === 'haetae') {
    const alive = targets.filter((e) => e.hp > 0);
    if (!alive.length) return false;
    for (const e of alive) {
      hitEnemy(game, e, stats.damage, stats, tower.type);
      applySlow(e, stats.slowFactor, stats.slowDuration);
    }
    game.events.push({ type: 'quake', towerId: tower.id, ...from });
    return true;
  }
  const near = inRange(game, tower, targets, stats.range);
  if (!near.length) return false;
  const first = near[0];
  const at = positionAt(game.points, first.dist);
  if (tower.type === 'phoenix') {
    hitEnemy(game, first, stats.damage, stats, tower.type);
    game.zones.push({ ...at, r: stats.burnRadius, dps: stats.burnDps, left: stats.burnTime, from: 'phoenix' });
    shot(at);
  } else if (tower.type === 'gumiho') {
    for (const e of near.slice(0, stats.shots)) {
      const p = positionAt(game.points, e.dist);
      hitEnemy(game, e, stats.damage, stats, tower.type);
      shot(p);
      // 가끔 기절: 그 자리에 stunTime초 멈춘다 (보스는 기절하지 않는다)
      if (!isBoss(e.type) && e.hp > 0 && game.rng() < stats.stunChance) {
        e.stun = Math.max(e.stun ?? 0, stats.stunTime);
        game.events.push({ type: 'stun', enemyId: e.id, ...p });
      }
    }
  } else if (tower.type === 'cheonma') {
    // 천마에서 첫 적 쪽으로 사거리 끝까지 뻗는 바람 줄기
    const len = Math.hypot(at.x - from.x, at.y - from.y) || 1;
    const dir = { x: (at.x - from.x) / len, y: (at.y - from.y) / len };
    for (const e of targets) {
      if (e.hp <= 0) continue;
      const p = positionAt(game.points, e.dist);
      const along = (p.x - from.x) * dir.x + (p.y - from.y) * dir.y;
      const side = Math.abs((p.x - from.x) * dir.y - (p.y - from.y) * dir.x);
      if (along >= 0 && along <= stats.range && side <= stats.width) hitEnemy(game, e, stats.damage, stats, tower.type);
    }
    shot({ x: from.x + dir.x * stats.range, y: from.y + dir.y * stats.range });
  } else if (tower.type === 'girin') {
    hitEnemy(game, first, stats.damage, stats, tower.type);
    if (first.hp <= 0) first.bonusGold = stats.killGold;
    shot(at);
  }
  return true;
}

export function fireMythic(game, tower, targets, dt) {
  tower.cooldown -= dt;
  if (tower.cooldown > 0) return;
  const stats = mythicStats(game, tower);
  if (!attack(game, tower, targets, stats)) {
    tower.cooldown = 0;
    return;
  }
  tower.cooldown += stats.cooldown;
}

// 불사조의 불길: 안에 있는 적을 계속 태운다
export function updateZones(game, dt) {
  for (const z of game.zones) {
    const t = Math.min(dt, z.left);
    for (const e of game.enemies) {
      if (e.hp > 0 && dist2(z, positionAt(game.points, e.dist)) <= z.r * z.r) {
        const before = e.hp;
        damageEnemy(e, z.dps * t, 'burn');
        credit(game, e, z.from, before);
      }
    }
    z.left -= dt;
  }
  game.zones = game.zones.filter((z) => z.left > 0);
}
