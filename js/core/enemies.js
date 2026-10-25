import { ENEMIES } from '../data/enemies.js';

export function hpScale(waveNumber) {
  return 1 + 0.2 * (waveNumber - 1);
}

export function createEnemy(id, type, waveNumber) {
  const maxHp = ENEMIES[type].hp * hpScale(waveNumber);
  return { id, type, waveNumber, hp: maxHp, maxHp, dist: 0, slow: null, poison: null };
}

export function damageEnemy(e, amount, kind) {
  const mult = kind === 'direct' ? (ENEMIES[e.type].directMult ?? 1) : 1;
  e.hp -= amount * mult;
}

export function applySlow(e, factor, duration) {
  if (!e.slow || factor <= e.slow.factor) e.slow = { factor, left: duration };
  else e.slow.left = Math.max(e.slow.left, duration);
}

export function applyPoison(e, dps, duration) {
  if (!e.poison || dps >= e.poison.dps) e.poison = { dps, left: duration };
  else e.poison.left = Math.max(e.poison.left, duration);
}

export function stepEnemy(e, dt) {
  const speed = ENEMIES[e.type].speed;
  if (e.poison) {
    const t = Math.min(dt, e.poison.left);
    e.hp -= e.poison.dps * t;
    e.poison.left -= t;
    if (e.poison.left <= 0) e.poison = null;
  }
  if (e.slow) {
    const t = Math.min(dt, e.slow.left);
    e.dist += speed * e.slow.factor * t + speed * (dt - t);
    e.slow.left -= t;
    if (e.slow.left <= 0) e.slow = null;
  } else {
    e.dist += speed * dt;
  }
}
