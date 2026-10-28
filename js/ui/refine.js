// 16x16 원본 도트를 2배 해상도(32x32)로 정교하게 다듬는다. 원본 그림 데이터는 그대로 두고 그림을 구울 때 쓴다.
// 1) scale2x: 도트를 4조각으로 나누며 계단 모양 사선·곡선을 매끄럽게 잇는다
// 2) 바깥 테두리를 1픽셀로 가늘게: 두꺼워진 테두리의 안쪽 줄을 옆 몸 색과 섞은 색으로 바꾼다
// 3) 명암: 왼쪽 위 가장자리는 밝게, 오른쪽 아래 가장자리는 어둡게 1픽셀씩
// 4) 선택: rim(밝은 바깥 테두리로 배경에서 돋보이게), grain(바닥 결), mute(배경 장식을 차분하게)
// 색은 '#rrggbb'(또는 알파가 붙은 '#rrggbbaa'), 투명은 null이다.

const DARK = 0.2;

const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => toHex(parse(a).map((v, i) => v + (parse(b)[i] - v) * t));
export const luminance = (hex) => {
  const [r, g, b] = parse(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);

export function toGrid(palette, rows) {
  return rows.map((row) => [...row].map((ch) => (ch === '.' ? null : palette[ch])));
}

// scale2x(EPX): 각 픽셀을 2x2로 나누고, 위·오른쪽·왼쪽·아래 이웃이 맞으면 모서리를 이웃 색으로 채운다.
// clamp: 그림 바깥을 가장자리와 같은 색으로 본다(칸을 꽉 채우는 바닥 타일. 아니면 모서리에 빈 픽셀이 생긴다)
export function scale2x(grid, clamp = false) {
  const h = grid.length;
  const w = grid[0].length;
  const at = (x, y) => {
    if (clamp) return grid[Math.min(h - 1, Math.max(0, y))][Math.min(w - 1, Math.max(0, x))];
    return x < 0 || y < 0 || x >= w || y >= h ? null : grid[y][x];
  };
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill(null));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = grid[y][x];
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      out[y * 2][x * 2] = c === a && c !== d && a !== b ? a : p;
      out[y * 2][x * 2 + 1] = a === b && a !== c && b !== d ? b : p;
      out[y * 2 + 1][x * 2] = d === c && d !== b && c !== a ? c : p;
      out[y * 2 + 1][x * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  return out;
}

// 결정적인 작은 난수 (같은 그림은 늘 같게 다듬어진다)
const noise = (x, y, seed) => {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function refine(palette, rows, {
  outline = true, shade = true, rim = null, grain = 0, mute = 0, seed = 0, tile = false, scale = true,
} = {}) {
  // scale: false면 이미 2배 해상도로 그린 그림이라 크기를 바꾸지 않는다
  const g = scale ? scale2x(toGrid(palette, rows), tile) : toGrid(palette, rows);
  const h = g.length;
  const w = g[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : g[y][x]);
  const clear = (x, y) => at(x, y) === null;
  const isDark = (c) => c !== null && luminance(c) < DARK;
  // 바깥 테두리: 투명한 곳에서 2픽셀 안에 있는 진한 픽셀 (몸 안쪽의 눈·무늬는 포함하지 않는다)
  const nearClear = (x, y, r) => {
    for (let k = 1; k <= r; k++) if (clear(x - k, y) || clear(x + k, y) || clear(x, y - k) || clear(x, y + k)) return true;
    return false;
  };
  const outer = g.map((row, y) => row.map((c, x) => isDark(c) && nearClear(x, y, 2)));
  const out = g.map((row) => [...row]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (c === null) continue;
      if (outer[y][x]) {
        if (!outline || nearClear(x, y, 1)) continue;
        // 두꺼운 테두리의 안쪽 줄: 옆의 몸 색과 섞어 테두리를 1픽셀로 가늘게
        const inside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
          .find(([nx, ny]) => at(nx, ny) !== null && !outer[ny][nx]);
        if (inside) out[y][x] = mix(c, g[inside[1]][inside[0]], 0.55);
        continue;
      }
      if (!shade || isDark(c)) continue;
      const edge = (nx, ny) => clear(nx, ny) || (outer[ny]?.[nx] ?? true);
      const lit = edge(x, y - 1) || edge(x - 1, y);
      const dim = edge(x, y + 1) || edge(x + 1, y);
      if (lit && !dim) out[y][x] = lighten(c, 0.18);
      else if (dim && !lit) out[y][x] = darken(c, 0.18);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = out[y][x];
      if (c === null) continue;
      if (grain) {
        const n = noise(x, y, seed);
        if (n < grain / 2) out[y][x] = lighten(c, 0.07);
        else if (n < grain) out[y][x] = darken(c, 0.07);
      }
      if (mute) {
        const l = luminance(out[y][x]) * 255;
        out[y][x] = mix(mix(out[y][x], toHex([l, l, l]), mute), '#808080', mute * 0.25);
      }
    }
  }
  if (rim) {
    const solid = out.map((row) => row.map((c) => c !== null));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid[y][x]) continue;
        if (solid[y - 1]?.[x] || solid[y + 1]?.[x] || solid[y][x - 1] || solid[y][x + 1]) out[y][x] = rim;
      }
    }
  }
  return out;
}
