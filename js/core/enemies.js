import { ENEMIES } from '../data/enemies.js';

// 모든 몬스터 체력 보정 (2026-10-26: 약 5% 상향)
export const HP_BONUS = 1.05;

export function hpScale(waveNumber) {
  return HP_BONUS * (1 + 0.3 * (waveNumber - 1));
}

// 웨이브가 높을수록 조금씩 빨라진다 (웨이브마다 1%)
export function speedScale(waveNumber) {
  return 1 + 0.01 * (waveNumber - 1);
}

export const isBoss = (type) => !!ENEMIES[type]?.boss;

// 방패병의 직접 피해 배율: 1웨이브 50%에서 30웨이브 35%까지 단단해진다
function directMultAt(type, waveNumber) {
  const base = ENEMIES[type].directMult;
  if (base === undefined) return 1;
  return Math.max(0.35, base - (0.15 / 29) * (waveNumber - 1));
}

// hpMult: 맵 난이도에 따른 체력 배율
export function createEnemy(id, type, waveNumber, hpMult = 1) {
  const maxHp = ENEMIES[type].hp * hpScale(waveNumber) * hpMult;
  return {
    id, type, waveNumber, hp: maxHp, maxHp, dist: 0, slow: null, poison: null,
    speedMult: speedScale(waveNumber), directMult: directMultAt(type, waveNumber),
  };
}

export function damageEnemy(e, amount, kind) {
  const mult = kind === 'direct' ? e.directMult ?? 1 : 1;
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

// speedFactor: 카드(서리 바람) 같은 전체 이동 속도 배율
export function stepEnemy(e, dt, speedFactor = 1) {
  const speed = ENEMIES[e.type].speed * (e.speedMult ?? 1) * speedFactor;
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
