import { MAPS } from '../data/maps.js';
import { MYTHICS } from '../data/mythics.js';
import { CARDS } from '../data/cards.js';
import { TOWERS, MAX_LEVEL } from './towers.js';
import { canBuild } from './path.js';
import { WAVE_COUNT } from './waves.js';
import { createGame, CONFIG } from './game.js';

// 이어하기: 웨이브와 웨이브 사이의 상태만 저장한다(움직이는 몬스터는 저장하지 않는다).
// 웨이브 도중에 나가면 그 웨이브가 시작되기 직전으로 돌아간다.
export const RUN_VERSION = 1;

export function isBetweenWaves(game) {
  return game.status === 'running' && game.enemies.length === 0 && game.spawnQueue.length === 0
    && (game.countdown !== null || !!game.cardChoices);
}

export function snapshotGame(game) {
  return {
    version: RUN_VERSION,
    mapId: game.map.id,
    gold: game.gold,
    lives: game.lives,
    waveNumber: game.waveNumber,
    clearedWave: game.clearedWave,
    summons: game.summons,
    nextId: game.nextId,
    upgrades: { ...game.upgrades },
    mods: { ...game.mods, damage: { ...game.mods.damage } },
    cardsTaken: [...game.cardsTaken],
    cardChoices: game.cardChoices ? [...game.cardChoices] : null,
    towers: game.towers.map((t) => ({
      id: t.id, type: t.type, level: t.level, col: t.col, row: t.row, invested: t.invested, mythic: !!t.mythic,
    })),
  };
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function validTowers(map, towers) {
  if (!Array.isArray(towers)) return false;
  const occupied = new Set();
  const ids = new Set();
  for (const t of towers) {
    if (!t || typeof t !== 'object') return false;
    const known = t.mythic ? MYTHICS[t.type] : TOWERS[t.type];
    if (!known || !int(t.level, 0, t.mythic ? 0 : MAX_LEVEL) || !num(t.invested) || t.invested < 0) return false;
    if (!int(t.id, 1, Number.MAX_SAFE_INTEGER) || ids.has(t.id)) return false;
    if (!canBuild(map, t.col, t.row, occupied)) return false;
    occupied.add(`${t.col},${t.row}`);
    ids.add(t.id);
  }
  return true;
}

// 저장을 게임으로 되살린다. 이상한 값이 하나라도 있으면 null
export function restoreGame(snap) {
  if (!snap || typeof snap !== 'object' || snap.version !== RUN_VERSION) return null;
  const map = MAPS.find((m) => m.id === snap.mapId);
  if (!map) return null;
  const { gold, lives, waveNumber, clearedWave, summons, upgrades, mods, cardsTaken, cardChoices } = snap;
  if (!num(gold) || gold < 0 || !int(lives, 1, 999) || !int(waveNumber, 0, WAVE_COUNT - 1)) return null;
  if (!int(clearedWave, 0, WAVE_COUNT) || !int(summons, 0, 1e6) || !validTowers(map, snap.towers)) return null;
  if (!upgrades || Object.keys(TOWERS).some((id) => !int(upgrades[id], 0, CONFIG.upgradeCosts.length))) return null;
  if (!mods || !mods.damage || Object.keys(TOWERS).some((id) => !num(mods.damage[id]))) return null;
  if (['attackSpeed', 'range', 'bounty', 'enemySpeed', 'bossDamage'].some((k) => !num(mods[k]))) return null;
  if (!Array.isArray(cardsTaken) || cardsTaken.some((id) => !CARDS[id])) return null;
  if (cardChoices !== null && (!Array.isArray(cardChoices) || cardChoices.length !== 3 || cardChoices.some((id) => !CARDS[id]))) return null;

  const game = createGame(map);
  Object.assign(game, { gold, lives, waveNumber, clearedWave, summons });
  game.upgrades = { ...upgrades };
  game.mods = { ...mods, damage: { ...mods.damage } };
  game.cardsTaken = [...cardsTaken];
  game.cardChoices = cardChoices ? [...cardChoices] : null;
  game.towers = snap.towers.map((t) => ({
    id: t.id, type: t.type, level: t.level, col: t.col, row: t.row, invested: t.invested, cooldown: 0,
    ...(t.mythic ? { mythic: true } : {}),
  }));
  game.nextId = Math.max(num(snap.nextId) ? snap.nextId : 1, ...game.towers.map((t) => t.id + 1), 1);
  // 카운트다운은 처음부터 다시 센다. 카드를 고르는 중이면 고른 뒤에 시작된다
  game.countdown = game.cardChoices ? null : waveNumber === 0 ? CONFIG.firstCountdown : CONFIG.waveGap;
  return game;
}
