import { MAPS } from './data/maps.js';
import { WAVE_COUNT } from './core/waves.js';

export const SAVE_KEY = 'td-save-v1';
// 진행 중인 한 판(이어하기). 내용 검사는 core/snapshot.js의 restoreGame이 한다
export const RUN_KEY = 'td-run-v1';

export function defaultSave() {
  return { version: 1, unlocked: 1, records: {} };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function cleanRecords(raw) {
  const records = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return records;
  for (const map of MAPS) {
    const r = raw[map.id];
    if (!r || !isNum(r.bestWave) || !isNum(r.stars)) continue;
    records[map.id] = {
      bestWave: clamp(Math.floor(r.bestWave), 0, WAVE_COUNT),
      stars: clamp(Math.floor(r.stars), 0, 3),
      // 무한 모드 최고 웨이브 (예전 저장에는 없다)
      ...(isNum(r.endlessBest) ? { endlessBest: clamp(Math.floor(r.endlessBest), 0, 99999) } : {}),
    };
  }
  return records;
}

export function loadSave(store) {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw === null || raw === undefined) return defaultSave();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return defaultSave();
    if (data.version !== 1 || !isNum(data.unlocked)) return defaultSave();
    return {
      version: 1,
      unlocked: clamp(Math.floor(data.unlocked), 1, MAPS.length),
      records: cleanRecords(data.records),
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(store, save) {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function starsFor(lives) {
  if (lives >= 15) return 3;
  if (lives >= 8) return 2;
  return 1;
}

// endless: 무한 모드 결과. 무한 모드 최고 기록만 바꾸고 별·해금·보통 판 기록은 그대로 둔다
export function recordResult(save, mapId, { wave, lives, won, endless = false }) {
  const index = MAPS.findIndex((m) => m.id === mapId);
  const next = { version: 1, unlocked: save.unlocked, records: { ...save.records } };
  if (index < 0) return next;
  const prev = save.records[mapId] ?? { bestWave: 0, stars: 0 };
  if (endless) {
    next.records[mapId] = { ...prev, endlessBest: Math.max(prev.endlessBest ?? 0, wave) };
    return next;
  }
  next.records[mapId] = {
    ...prev,
    bestWave: Math.max(prev.bestWave, wave),
    stars: won ? Math.max(prev.stars, starsFor(lives)) : prev.stars,
  };
  if (won) next.unlocked = Math.max(next.unlocked, Math.min(index + 2, MAPS.length));
  return next;
}

export function loadRun(store) {
  try {
    const raw = store.getItem(RUN_KEY);
    if (raw === null || raw === undefined) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export function writeRun(store, run) {
  try {
    store.setItem(RUN_KEY, JSON.stringify(run));
    return true;
  } catch {
    return false;
  }
}

export function clearRun(store) {
  try {
    store.removeItem(RUN_KEY);
  } catch {
    // 저장소가 막혀 있으면 지울 것도 없다
  }
}
