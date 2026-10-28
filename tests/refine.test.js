import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refine, scale2x, toGrid, luminance } from '../js/ui/refine.js';

const K = '#111111';
const R = '#cc3333';
const pal = { K, R, E: '#000000' };
// 4x4 테두리 안에 빨간 몸, 가운데 눈(E)이 있는 6x6 그림
const rows = [
  '.KKKK.',
  'KRRRRK',
  'KRREKR',
  'KRRRRK',
  'KRRRRK',
  '.KKKK.',
].map((r) => r.replace(/R$/, 'K'));

test('scale2x: 크기가 2배가 되고, 계단 모서리가 매끄러워진다', () => {
  const g = toGrid(pal, ['.K', 'KK']);
  const big = scale2x(g);
  assert.equal(big.length, 4);
  assert.equal(big[0].length, 4);
  // 왼쪽 위 투명 칸과 맞닿은 대각선 모서리가 채워져 둥글어진다
  assert.equal(big[1][1], K);
  assert.equal(big[0][0], null);
});

test('다듬기: 2배 크기, 투명한 곳은 그대로 투명, 바깥 테두리는 1픽셀로 가늘어진다', () => {
  const g = refine(pal, rows);
  assert.equal(g.length, 12);
  assert.equal(g[0].length, 12);
  assert.equal(g[0][0], null);
  // 왼쪽 테두리: 바깥 1픽셀만 진하고, 그 안쪽 픽셀은 더 이상 테두리 색이 아니다
  const row = g[6];
  assert.equal(row[0], K);
  assert.notEqual(row[1], K);
  assert.ok(luminance(row[1]) > luminance(K));
});

test('다듬기: 몸 안쪽의 진한 점(눈)은 지우지 않는다', () => {
  const g = refine(pal, rows);
  let eye = 0;
  for (const r of g) for (const c of r) if (c === '#000000') eye++;
  assert.equal(eye, 4);
});

test('명암: 왼쪽 위 가장자리는 밝게, 오른쪽 아래 가장자리는 어둡게', () => {
  const g = refine(pal, rows);
  const lit = luminance(g[3][2]);
  const shaded = luminance(g[8][9]);
  assert.ok(lit > luminance(R) && shaded < luminance(R), `${g[3][2]} ${g[8][9]}`);
});

test('밝은 바깥 테두리(rim)는 그림 바로 바깥 투명 칸에만 생긴다', () => {
  const g = refine(pal, rows, { rim: '#ffffffaa' });
  assert.equal(g[0][2], '#ffffffaa');
  assert.equal(g[0][0], null);
});

test('바닥 결(grain)과 차분하게(mute)는 늘 같은 결과이고 색만 조금 바꾼다', () => {
  const tile = ['RRRR', 'RRRR', 'RRRR', 'RRRR'];
  const a = refine(pal, tile, { outline: false, shade: false, grain: 0.3 });
  assert.deepEqual(a, refine(pal, tile, { outline: false, shade: false, grain: 0.3 }));
  const changed = a.flat().filter((c) => c !== R).length;
  assert.ok(changed > 0 && changed < 64);
  const m = refine(pal, tile, { outline: false, shade: false, mute: 0.3 });
  assert.ok(m.flat().every((c) => c !== R));
});

test('바닥 타일(tile)은 다듬어도 빈 픽셀이 생기지 않는다 (모서리에 검은 점이 찍히지 않게)', () => {
  const tile = ['RK', 'KR'];
  assert.ok(refine(pal, tile, { outline: false, shade: false, tile: true }).flat().every((c) => c !== null));
  assert.ok(refine(pal, tile, { outline: false, shade: false }).flat().some((c) => c === null), '물체 그림은 바깥이 투명');
});
