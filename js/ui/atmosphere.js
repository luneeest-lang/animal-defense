// 하늘빛: 웨이브가 진행될수록 맵 바닥을 낮 → 오후 → 노을빛으로 물들이고, 무한 모드 30웨이브 뒤로는 밤빛.
// 동물·몬스터는 이 빛 위에 그려서 늘 또렷하다(render.js의 drawLighting). 그리기 전용
// 반환: color('r, g, b'), alpha(덮는 진하기), night(0~1, 반딧불처럼 밤에 늘어나는 것들의 양)
const STOPS = [
  { wave: 1, color: [255, 210, 140], alpha: 0 },
  { wave: 12, color: [255, 190, 110], alpha: 0.06 },
  { wave: 22, color: [255, 130, 70], alpha: 0.13 },
  { wave: 30, color: [190, 70, 110], alpha: 0.2 },
  { wave: 38, color: [40, 50, 120], alpha: 0.26 },
];

export function skyTint(wave) {
  const w = Math.max(1, wave);
  let a = STOPS[0];
  let b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (w >= STOPS[i].wave && w <= STOPS[i + 1].wave) { a = STOPS[i]; b = STOPS[i + 1]; break; }
  }
  if (w >= b.wave) a = b;
  const k = a === b ? 0 : (w - a.wave) / (b.wave - a.wave);
  const color = a.color.map((v, i) => Math.round(v + (b.color[i] - v) * k)).join(', ');
  const alpha = a.alpha + (b.alpha - a.alpha) * k;
  const night = Math.max(0, Math.min(1, (w - 30) / 8));
  return { color, alpha, night };
}
