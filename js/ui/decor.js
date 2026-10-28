import { pathCells } from '../core/path.js';
import { DECOR_THEMES } from '../data/decor.js';

// 맵을 풍성하게 하는 장식의 자리. 칸 좌표로 늘 같은 결과가 나오게 해시로 정한다(새로고침해도 그대로).

function hash(a, b, salt) {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
// -0.25 ~ 0.25칸 사이의 어긋남 (칸 가운데에 딱 맞춰 놓으면 줄 맞춘 것처럼 보인다)
const jitter = (h, shift) => (((h >>> shift) & 15) / 15 - 0.5) * 0.5;
const pick = (list, h) => list[h % list.length];

// 맵 안 장식 [{ c, r, name, tall, dx, dy }]. 길과 막힌 칸에는 없다.
// 키 큰 장식은 길에서 2칸 이상 떨어진 칸(동물이 소환되지 않는 칸)에만 놓아 게임을 가리지 않는다.
export function decorFor(map) {
  const set = DECOR_THEMES[map.theme] ?? DECOR_THEMES.mountain;
  const path = pathCells(map);
  const blocked = new Set(map.blocked.map(([c, r]) => `${c},${r}`));
  const nearPath = (c, r) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (path.has(`${c + dc},${r + dr}`)) return true;
    return false;
  };
  const out = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const key = `${c},${r}`;
      if (path.has(key) || blocked.has(key)) continue;
      const h = hash(c, r, 7);
      const roll = h % 100;
      const base = { c, r, dx: jitter(h, 12), dy: jitter(h, 16) * 0.6 };
      if (!nearPath(c, r) && roll < 25) out.push({ ...base, name: pick(set.tall, h >>> 8), tall: true });
      else if (roll >= 72) out.push({ ...base, name: pick(set.flat, h >>> 8), tall: false });
    }
  }
  return out;
}

// 맵 바깥 여백(화면 칸 i, j)의 장식. 없으면 null. big은 큰 나무·바위·암초(타일)다
export function marginDecor(theme, i, j) {
  const set = DECOR_THEMES[theme] ?? DECOR_THEMES.mountain;
  const h = hash(i + 1000, j + 1000, 13);
  const roll = h % 100;
  const base = { dx: jitter(h, 12), dy: jitter(h, 16) * 0.6 };
  if (roll < 7) return { ...base, name: pick(set.big, h >>> 8), tall: true, big: true };
  if (roll < 20) return { ...base, name: pick(set.tall, h >>> 8), tall: true };
  if (roll < 38) return { ...base, name: pick(set.flat, h >>> 8), tall: false };
  return null;
}
