// 새 몬스터 첫 등장 안내: 처음 보는 일반 몬스터가 섞인 웨이브가 시작되면 맵 위쪽에 카드로 알려 준다(한 번 본 몬스터는 다시 알리지 않는다)
export const SEEN_KEY = 'td-seen-enemies';
export const INTRO_TYPES = ['runner', 'splitter', 'tank', 'shield', 'bat', 'healer'];

// 이 웨이브에서 처음 보는 안내 대상 몬스터 (나오는 순서대로)
export function newEnemies(wave, seen) {
  const out = [];
  for (const g of wave?.groups ?? []) if (INTRO_TYPES.includes(g.type) && !seen.has(g.type) && !out.includes(g.type)) out.push(g.type);
  return out;
}

export function loadSeen(store) {
  try {
    const list = JSON.parse(store.getItem(SEEN_KEY) ?? '[]');
    return new Set(Array.isArray(list) ? list.filter((id) => INTRO_TYPES.includes(id)) : []);
  } catch {
    return new Set();
  }
}

export function saveSeen(store, seen) {
  try { store.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* 저장이 안 되면 다음에 또 알려 준다 */ }
}
