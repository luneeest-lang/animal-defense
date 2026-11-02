// 기록 옮기기: 폰과 컴퓨터처럼 다른 기기(브라우저)의 기록을 저장 코드로 옮겨 합친다. 서버 없이 쓴다.
// 코드 = 'TMS1.' + 기록(JSON)을 base64url로 바꾼 글자. 이어하던 판(td-run)은 담지 않는다.
import { loadSave, defaultSave } from './storage.js';

export const CODE_PREFIX = 'TMS1.';

const toB64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (code) => {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

// 코드 끝에 붙이는 짧은 검사 값 (중간이 잘린 코드를 알아본다)
const check = (s) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(7, '0').slice(-6);
};

export function exportCode(save) {
  const body = toB64(JSON.stringify({
    unlocked: save.unlocked, records: save.records, collection: save.collection ?? {}, achievements: save.achievements ?? {}, totals: save.totals,
  }));
  return `${CODE_PREFIX}${body}.${check(body)}`;
}

// 코드 → 기록 (storage.js의 loadSave와 같은 검사로 이상한 값은 거른다). 읽을 수 없으면 null
export function importCode(code) {
  const text = String(code ?? '').trim();
  if (!text.startsWith(CODE_PREFIX)) return null;
  const [body, sum] = text.slice(CODE_PREFIX.length).split('.');
  if (!body || sum !== check(body)) return null;
  try {
    const data = JSON.parse(fromB64(body));
    if (!data || typeof data !== 'object' || typeof data.unlocked !== 'number') return null;
    const raw = JSON.stringify({
      version: 1, unlocked: data.unlocked, records: data.records, collection: data.collection, achievements: data.achievements, totals: data.totals,
    });
    return loadSave({ getItem: () => raw });
  } catch {
    return null;
  }
}

const max = (a, b) => Math.max(a ?? 0, b ?? 0);

// 두 기록을 합친다: 해금·최고 웨이브·별·무한 기록은 더 좋은 쪽, 도감 카드는 더 많은 쪽 (더하면 같은 코드를 두 번 불러올 때 늘어난다)
export function mergeSaves(a, b) {
  const out = { ...defaultSave(), version: 1, unlocked: max(a.unlocked, b.unlocked), records: {}, collection: {} };
  for (const id of new Set([...Object.keys(a.records ?? {}), ...Object.keys(b.records ?? {})])) {
    const x = a.records?.[id] ?? {};
    const y = b.records?.[id] ?? {};
    const r = { bestWave: max(x.bestWave, y.bestWave), stars: max(x.stars, y.stars) };
    if (x.endlessBest !== undefined || y.endlessBest !== undefined) r.endlessBest = max(x.endlessBest, y.endlessBest);
    out.records[id] = r;
  }
  for (const id of new Set([...Object.keys(a.collection ?? {}), ...Object.keys(b.collection ?? {})])) {
    out.collection[id] = max(a.collection?.[id], b.collection?.[id]);
  }
  // 업적은 어느 한쪽이라도 이뤘으면, 누적 기록은 더 큰 쪽(싸워 본 신화는 합집합)
  out.achievements = { ...(a.achievements ?? {}), ...(b.achievements ?? {}) };
  out.totals = {
    kills: max(a.totals?.kills, b.totals?.kills),
    golden: max(a.totals?.golden, b.totals?.golden),
    mythicsUsed: [...new Set([...(a.totals?.mythicsUsed ?? []), ...(b.totals?.mythicsUsed ?? [])])],
  };
  return out;
}
