import { ENEMIES } from '../data/enemies.js';

// 모든 몬스터 체력 보정 (2026-10-26: 약 5% 상향)
export const HP_BONUS = 1.05;

// 체력 증가: 웨이브마다 기본 체력의 30%씩, lateFrom 웨이브 뒤로는 웨이브마다 late 배씩 더 (동물·신화가 강해지는 후반 대응)
export const HP_GROWTH = { late: 1.07, lateFrom: 10 };

export function hpScale(waveNumber) {
  const late = HP_GROWTH.late ** Math.max(0, waveNumber - HP_GROWTH.lateFrom);
  return HP_BONUS * (1 + 0.3 * (waveNumber - 1)) * late;
}

// 웨이브가 높을수록 조금씩 빨라진다 (웨이브마다 1%, 무한 모드에서 너무 빨라지지 않게 최대 1.5배)
export function speedScale(waveNumber) {
  return Math.min(1.5, 1 + 0.01 * (waveNumber - 1));
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
  e.hp -= amount * mult * (e.armor ?? 1);
}

export function applySlow(e, factor, duration) {
  if (!e.slow || factor <= e.slow.factor) e.slow = { factor, left: duration };
  else e.slow.left = Math.max(e.slow.left, duration);
}

// by: 독을 건 동물 종류 (결과 통계용)
export function applyPoison(e, dps, duration, by) {
  if (!e.poison || dps >= e.poison.dps) e.poison = { dps, left: duration, by };
  else e.poison.left = Math.max(e.poison.left, duration);
}

// speedFactor: 카드(서리 바람) 같은 전체 이동 속도 배율
export function stepEnemy(e, dt, speedFactor = 1) {
  const speed = ENEMIES[e.type].speed * (e.speedMult ?? 1) * (e.abilitySpeed ?? 1) * speedFactor;
  if (e.poison) {
    const t = Math.min(dt, e.poison.left);
    e.hp -= e.poison.dps * t;
    e.poison.left -= t;
    if (e.poison.left <= 0) e.poison = null;
  }
  // 기절(구미호): 남은 기절 시간만큼은 걷지 않는다
  if (e.stun > 0) {
    const t = Math.min(dt, e.stun);
    e.stun -= t;
    dt -= t;
    if (dt <= 0) return;
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
