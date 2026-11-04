// 첫 화면 위쪽 그림: 밤하늘 언덕 위에 신수 다섯이 숨 쉬며 서 있고, 앞에서 아기 동물들이 통통 뛴다.
// 메뉴가 보일 때만 움직인다(start/stop). 움직임 줄이기 설정이면 한 장만 그린다.
import { bakeMythics, bakeAnimals } from './pixel.js';
import { MYTHICS } from '../data/mythics.js';
import { HERO_LINEUP } from './menuPlay.js';

const W = 520;
const H = 230;
const BABIES = ['squirrel', 'penguin', 'elephant', 'eagle', 'snake'];
// 신수 자리: 가운데가 가장 크고 앞, 양옆은 조금 작고 뒤
const SPOTS = [
  { x: 0.12, y: 0.50, s: 74 },
  { x: 0.30, y: 0.42, s: 84 },
  { x: 0.50, y: 0.50, s: 104 },
  { x: 0.70, y: 0.42, s: 84 },
  { x: 0.88, y: 0.50, s: 74 },
];

function stars(seed = 7) {
  const out = [];
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 38; i++) out.push({ x: r() * W, y: r() * H * 0.55, r: r() < 0.2 ? 1.6 : 1, p: r() * 6 });
  return out;
}

export function createMenuHero(canvas, reduceMotion = false) {
  const ctx = canvas.getContext('2d');
  const sky = stars();
  let raf = 0;
  let dpr = 1;

  function size() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function hill(y0, amp, color, phase) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin(x / 90 + phase) * amp);
    ctx.lineTo(W, H);
    ctx.fill();
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1640');
    g.addColorStop(0.55, '#2c3f6b');
    g.addColorStop(1, '#3d6b4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 별 반짝임
    for (const st of sky) {
      const a = reduceMotion ? 0.7 : 0.45 + 0.45 * Math.sin(now / 700 + st.p);
      ctx.fillStyle = `rgba(255,248,214,${a})`;
      ctx.fillRect(st.x, st.y, st.r * 1.5, st.r * 1.5);
    }
    // 달빛
    const moon = ctx.createRadialGradient(W * 0.5, H * 0.3, 4, W * 0.5, H * 0.3, 150);
    moon.addColorStop(0, 'rgba(255,236,160,0.35)');
    moon.addColorStop(1, 'rgba(255,236,160,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, W, H);
    hill(H * 0.66, 10, '#24452f', 0.4);
    hill(H * 0.76, 7, '#2f5c37', 2.1);

    const mythics = bakeMythics();
    const animals = bakeAnimals();
    ctx.imageSmoothingEnabled = false;
    HERO_LINEUP.forEach((id, i) => {
      const sp = SPOTS[i];
      const bob = reduceMotion ? 0 : Math.sin(now / 520 + i * 1.3) * 3;
      const cx = sp.x * W;
      const foot = sp.y * H + sp.s / 2;
      // 후광과 그림자
      const glow = ctx.createRadialGradient(cx, foot - sp.s / 2, 4, cx, foot - sp.s / 2, sp.s * 0.75);
      glow.addColorStop(0, `${MYTHICS[id].color}66`);
      glow.addColorStop(1, `${MYTHICS[id].color}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - sp.s, foot - sp.s * 1.3, sp.s * 2, sp.s * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, foot - 2, sp.s * 0.34, sp.s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(mythics[id], Math.round(cx - sp.s / 2), Math.round(foot - sp.s + bob - 2), sp.s, sp.s);
    });
    // 앞줄 아기 동물: 차례로 통통 뛴다
    BABIES.forEach((id, i) => {
      const s = 34;
      const x = W * 0.5 + (i - 2) * 46;
      const phase = ((now / 1600 + i * 0.18) % 1);
      const hop = reduceMotion || phase > 0.25 ? 0 : Math.sin((phase / 0.25) * Math.PI) * 9;
      const foot = H - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, foot - 1, s * 0.3 * (1 - hop / 30), s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(animals[id][0], Math.round(x - s / 2), Math.round(foot - s - hop), s, s);
    });
  }

  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (raf) return;
      size();
      if (reduceMotion) { draw(0); return; }
      raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
