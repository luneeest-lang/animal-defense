import { TOWERS, AURA_COLORS } from '../data/towers.js';
import { towerStats } from '../core/towers.js';
import { positionAt, pathCells } from '../core/path.js';
import { isBoss } from '../core/enemies.js';
import { fitBoard } from './layout.js';
import { reliefCells } from './relief.js';
import { ENEMY_LOOK } from '../data/sprites.js';
import {
  bakeSprites, bakeTiles, bakeAnimals, bakeSilhouettes, bakeMythics, bakeDecor, ART_SIZE, ART_SCALE,
} from './pixel.js';
import { decorFor, marginDecor } from './decor.js';
import { MYTHICS, GRADE_COLORS, gradeOf } from '../data/mythics.js';
import { MYTHIC_SIZE } from '../data/mythicSprites.js';
import { createEffects } from './effects.js';
import { towerName } from '../i18n.js';

const HIT_FLASH_MS = 90;
const WATER_FRAME_MS = 700;
const AURA_LEVEL = 3;
// 타워(동물·신화) 크기 배율 (2026-10-28: 10% 키움)
const TOWER_SCALE = 1.1;

const withAlpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
// 숲 바닥 무늬 비율: 기본, 풀포기, 버섯, 낙엽, 기본2 (버섯은 드물게)
const FOREST_GRASS_WEIGHTS = [8, 3, 1, 2, 6];
// 돌산 바닥 무늬 비율: 기본, 갈라진 틈, 자갈, 풀포기, 이끼
const MOUNTAIN_GROUND_WEIGHTS = [9, 3, 3, 2, 2];

// 칸 좌표로 정해지는 의사 난수. 같은 칸은 늘 같은 무늬가 나온다.
const cellHash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

// 단차 블록의 앞면 벽 색. wall: 벽 높이(칸 비율), face: 벽, stripe: 벽 무늬, top: 벽 윗단, low: 낮은 칸을 살짝 어둡게
const RELIEF = {
  mountain: { wall: 0.4, face: '#544940', stripe: '#3d342d', top: '#a99a88', low: 0.14, strata: '#665a50' },
  forest: { wall: 0.4, face: '#6b4529', stripe: '#4d2f1a', top: '#5c9a3a', low: 0.14, grass: '#3d7228', strata: '#7d5535' },
  sea: { wall: 0.24, face: '#6e4522', stripe: '#4d2f14', top: '#a8763f', low: 0, post: '#36210e' },
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let lastEvents = null;
  const effects = createEffects();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let shakeX = 0;
  let shakeY = 0;
  const sprites = bakeSprites();
  const silhouettes = bakeSilhouettes();
  const tiles = bakeTiles();
  const animals = bakeAnimals();
  const mythics = bakeMythics();
  const decor = bakeDecor();
  const decorCache = new Map(); // 맵 id → 장식 목록
  const towerFacing = new Map();
  const facing = new WeakMap();
  // 세로 화면에서는 맵을 90도 돌려 그린다(길이 위에서 아래로). boardH는 돌리기 전 맵의 세로 길이(px)
  let rotated = false;
  // 캔버스는 맵 자리 전체를 덮고, 실제 맵(board)은 그 가운데에 놓인다. 바깥은 같은 배경으로 채운다
  const board = { x: 0, y: 0, width: 0, height: 0 };
  let boardH = 0;

  // 그림(base 픽셀)을 target(CSS px) 크기에 맞출 때 그림 픽셀 하나의 크기(CSS px).
  // 도트가 고르게 보이도록 화면 픽셀 기준 0.5배 단위로 맞춘다(32픽셀 그림은 정수 배만 쓰면 크기 오차가 크다)
  const artUnit = (target, base, dpr) => Math.max(1, Math.round(((target * dpr) / base) * 2) / 2) / dpr;

  // 맵 좌표(px)의 점을 화면 기준으로 똑바로 서 있게 그린다. draw(sx, sy)는 화면 좌표를 받는다
  function upright(x, y, draw) {
    if (!rotated) {
      draw(x, y);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, (board.x + shakeX) * dpr, (board.y + shakeY) * dpr);
    draw(boardH - y, x);
    ctx.restore();
  }

  // 맵 방향(dx, dy)이 화면에서 왼쪽(-1)인지 오른쪽(1)인지, 거의 수직이면 0
  function screenSide(dx, dy) {
    const v = rotated ? -dy : dx;
    return v > 0.001 ? 1 : v < -0.001 ? -1 : 0;
  }

  // 칸 하나 크기의 그림(나무, 암초)을 똑바로 세워 그린다
  function drawUprightTile(img, c, r, cell) {
    upright((c + 0.5) * cell, (r + 0.5) * cell, (sx, sy) => {
      ctx.drawImage(img, Math.floor(sx - cell / 2), Math.floor(sy - cell / 2), Math.ceil(cell), Math.ceil(cell));
    });
  }

  // 맵 자리(부모 요소)의 크기를 재서 맵을 비율대로 맞춘다. 브라우저마다 다른 CSS 단위 지원에 기대지 않는다
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const box = canvas.parentElement;
    width = box.clientWidth;
    height = box.clientHeight;
    const fit = fitBoard(width, height);
    rotated = fit.portrait;
    Object.assign(board, {
      x: Math.floor((width - fit.width) / 2), y: Math.floor((height - fit.height) / 2), width: fit.width, height: fit.height,
    });
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  // 칸 하나를 타일로 덮는다. 칸 경계에 틈이 생기지 않도록 정수 좌표로 맞춘다.
  function drawTile(img, c, r, cell, rotate = false) {
    const x0 = Math.floor(c * cell);
    const y0 = Math.floor(r * cell);
    const w = Math.floor((c + 1) * cell) - x0;
    const h = Math.floor((r + 1) * cell) - y0;
    if (!rotate) {
      ctx.drawImage(img, x0, y0, w, h);
      return;
    }
    ctx.save();
    ctx.translate(x0 + w / 2, y0 + h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -h / 2, -w / 2, h, w);
    ctx.restore();
  }

  // 여러 무늬 중 하나를 고른다. weights가 있으면 그 비율대로, 없으면 첫 무늬가 절반쯤 나온다.
  function pickVariant(variants, c, r, weights) {
    const w = weights ?? variants.map((_, i) => (i === 0 ? variants.length - 1 || 1 : 1));
    let h = cellHash(c, r) % w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) {
      if (h < w[i]) return variants[i];
      h -= w[i];
    }
    return variants[0];
  }

  function drawMountain(map, path, cell) {
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const frames = path.has(`${c},${r}`)
          ? pickVariant(tiles.mountainPath, c, r)
          : pickVariant(tiles.mountainGround, c, r, MOUNTAIN_GROUND_WEIGHTS);
        drawTile(frames[0], c, r, cell);
      }
    }
    drawRelief(map, cell);
    drawDecor(map, cell);
    for (const [c, r] of map.blocked) drawObject(tiles.mountainBoulder[0][0], c, r, cell);
  }

  function drawForest(map, path, cell) {
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const frames = path.has(`${c},${r}`)
          ? pickVariant(tiles.forestPath, c, r)
          : pickVariant(tiles.forestGrass, c, r, FOREST_GRASS_WEIGHTS);
        drawTile(frames[0], c, r, cell);
      }
    }
    drawRelief(map, cell);
    drawDecor(map, cell);
    for (const [c, r] of map.blocked) drawObject(tiles.forestTree[0][0], c, r, cell);
  }

  function drawSea(map, path, cell, now) {
    const tick = Math.floor(now / WATER_FRAME_MS);
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (path.has(`${c},${r}`)) {
          // 세로로 이어진 길이면 판자를 돌려서 진행 방향과 엇갈리게 놓는다
          const horizontal = path.has(`${c - 1},${r}`) || path.has(`${c + 1},${r}`);
          drawTile(tiles.seaPlank[0][0], c, r, cell, !horizontal);
        } else {
          const frames = pickVariant(tiles.seaWater, c, r);
          drawTile(frames[(tick + c + r) % frames.length], c, r, cell);
        }
      }
    }
    drawRelief(map, cell);
    drawDecor(map, cell);
    for (const [c, r] of map.blocked) drawObject(tiles.seaReef[0][0], c, r, cell);
  }

  // 화면 좌표(돌리기 전, 흔들림만 적용)로 그린다
  function inScreen(draw) {
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, (board.x + shakeX) * dpr, (board.y + shakeY) * dpr);
    draw();
    ctx.restore();
  }

  // 발밑 그림자. 빛이 왼쪽 위에서 오므로 오른쪽 아래로 살짝 비낀다 (화면 좌표)
  function dropShadow(sx, sy, rx, ry, alpha = 0.3) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(sx + rx * 0.15, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 바위·나무·암초: 그림자를 깔고 세워 그린다
  function drawObject(img, c, r, cell) {
    upright((c + 0.5) * cell, (r + 0.5) * cell, (sx, sy) => dropShadow(sx, sy + cell * 0.36, cell * 0.4, cell * 0.12));
    drawUprightTile(img, c, r, cell);
  }

  // 단차 블록: 높은 칸의 앞면 벽, 옆 그림자, 모서리 빛을 화면 기준으로 그린다
  function drawRelief(map, cell) {
    const look = RELIEF[map.theme] ?? RELIEF.mountain;
    const u = cell / 16; // 원본 도트 한 칸 (벽 높이·기둥 같은 큰 모양)
    const f = u / ART_SCALE; // 다듬은 해상도의 도트 한 칸 (가는 선과 무늬)
    const wallH = Math.round(cell * look.wall / u) * u;
    inScreen(() => {
      for (const k of reliefCells(map, rotated)) {
        const x0 = Math.floor(k.i * cell);
        const y0 = Math.floor(k.j * cell);
        const w = Math.floor((k.i + 1) * cell) - x0;
        const h = Math.floor((k.j + 1) * cell) - y0;
        if (!k.high && look.low) {
          ctx.fillStyle = `rgba(0,0,0,${look.low})`;
          ctx.fillRect(x0, y0, w, h);
        }
        if (k.shadeLeft) {
          const g = ctx.createLinearGradient(x0, 0, x0 + cell * 0.28, 0);
          g.addColorStop(0, 'rgba(0,0,0,0.42)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x0, y0, cell * 0.28, h);
        }
        if (k.edgeRight) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x0 + w - u * 2, y0, u * 2, h);
        }
        if (k.lipBottom) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(x0, y0 + h - f, w, f);
        }
        if (k.wallTop) {
          // 벽 아래로 떨어지는 그림자
          const g = ctx.createLinearGradient(0, y0 + wallH, 0, y0 + wallH + cell * 0.26);
          g.addColorStop(0, 'rgba(0,0,0,0.45)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x0, y0 + wallH, w, cell * 0.26);
          // 벽 면과 세로 무늬 (칸마다 조금씩 다르게)
          ctx.fillStyle = look.face;
          ctx.fillRect(x0, y0, w, wallH);
          ctx.fillStyle = look.stripe;
          const hash = cellHash(k.i, k.j);
          for (let n = 0; n < 16 * ART_SCALE; n += 3) {
            const len = 0.45 + ((hash >> (n % 29)) & 3) * 0.15;
            ctx.fillRect(x0 + (n + ((hash >> ((n + 2) % 29)) & 1)) * f, y0 + wallH * (1 - len), f, wallH * len);
          }
          // 지층: 벽 가운데쯤 밝은 가로줄이 끊겨 가며 지나간다
          if (look.strata) {
            ctx.fillStyle = look.strata;
            for (let n = 0; n < 16 * ART_SCALE; n += 4) if ((hash >> ((n + 1) % 29)) & 1) ctx.fillRect(x0 + n * f, y0 + Math.round(wallH * 0.55 / f) * f, f * 3, f);
          }
          // 바다 다리: 기둥
          if (look.post) {
            ctx.fillStyle = look.post;
            ctx.fillRect(x0 + 3 * u, y0, 2 * u, wallH + u * 2);
            ctx.fillRect(x0 + 11 * u, y0, 2 * u, wallH + u * 2);
          }
          // 벽 윗단(모서리) 밝은 띠, 숲은 풀이 늘어진다
          ctx.fillStyle = look.top;
          ctx.fillRect(x0, y0, w, u * 2);
          if (look.grass) {
            ctx.fillStyle = look.grass;
            for (let n = 0; n < 16 * ART_SCALE; n += 2) if ((hash >> (n % 29)) & 1) ctx.fillRect(x0 + n * f, y0 + u * 2, f, f * (2 + 2 * ((hash >> ((n + 1) % 29)) & 1)));
          }
          // 벽 아래 어두운 접지선
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x0, y0 + wallH - f, w, f);
        }
        if (k.rimTop) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x0, y0, w, f);
        }
        if (k.rimLeft) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(x0, y0, f, h);
        }
        if (k.rimBottom) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x0, y0 + h - f, w, f);
        }
      }
    });
  }

  // 맵 바깥(화면을 꽉 채우는 여백)을 같은 배경 타일로 채우고, 놀 수 없는 곳이라 살짝 어둡게 한다.
  // 좌표는 맵 왼쪽 위가 (0, 0)인 화면 기준이다
  function drawMargins(map, cell, now) {
    const sc = rotated ? map.rows : map.cols;
    const sr = rotated ? map.cols : map.rows;
    const i0 = Math.floor(-board.x / cell) - 1;
    const j0 = Math.floor(-board.y / cell) - 1;
    const i1 = Math.ceil((width - board.x) / cell) + 1;
    const j1 = Math.ceil((height - board.y) / cell) + 1;
    const tick = Math.floor(now / WATER_FRAME_MS);
    ctx.imageSmoothingEnabled = false;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        // 맵 안쪽까지 바닥을 깐다: 맵을 돌려 그릴 때 가장자리에 생기는 1픽셀 미만의 틈을 메운다
        const inside = i >= 0 && j >= 0 && i < sc && j < sr;
        if (inside && i > 0 && j > 0 && i < sc - 1 && j < sr - 1) continue;
        const hc = i + 1000;
        const hr = j + 1000;
        let img;
        if (map.theme === 'sea') {
          const frames = pickVariant(tiles.seaWater, hc, hr);
          img = frames[(tick + hc + hr) % frames.length];
        } else if (map.theme === 'forest') img = pickVariant(tiles.forestGrass, hc, hr, FOREST_GRASS_WEIGHTS)[0];
        else img = pickVariant(tiles.mountainGround, hc, hr, MOUNTAIN_GROUND_WEIGHTS)[0];
        drawTile(img, i, j, cell);
      }
    }
    // 장식은 바닥을 다 깐 뒤에 위에서 아래 줄 순서로 놓아, 아래 줄 물체가 위 줄 물체를 가리게 한다
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        if (i >= 0 && j >= 0 && i < sc && j < sr) continue;
        const d = marginDecor(map.theme, i, j);
        if (d) drawDecorAt(d.big ? tiles[d.name][0][0] : decor[d.name], (i + 0.5 + d.dx) * cell, (j + 0.5 + d.dy) * cell, cell, d.tall);
      }
    }
  }

  // 장식 하나를 (화면 좌표 x, y가 칸 가운데) 그린다. 키 큰 장식은 발밑 그림자를 깐다
  function drawDecorAt(img, x, y, cell, tall) {
    if (tall) dropShadow(x, y + cell * 0.36, cell * 0.36, cell * 0.1, 0.25);
    ctx.drawImage(img, Math.floor(x - cell / 2), Math.floor(y - cell / 2), Math.ceil(cell), Math.ceil(cell));
  }

  // 맵 안 장식: 맵 좌표에서 위치를 정하고, 세로 화면에서도 똑바로 서게 그린다
  function drawDecor(map, cell) {
    if (!decorCache.has(map.id)) decorCache.set(map.id, decorFor(map));
    for (const d of decorCache.get(map.id)) {
      upright((d.c + 0.5 + d.dx) * cell, (d.r + 0.5 + d.dy) * cell, (sx, sy) => drawDecorAt(decor[d.name], sx, sy, cell, d.tall));
    }
  }

  // 살아 있는 맵: 시간에 따라 움직이는 것들. 좌표는 맵 왼쪽 위가 (0, 0)인 화면 기준이고, 화면 전체(여백 포함)를 쓴다.
  // 동작 줄이기 설정이면 그리지 않는다
  const screenBox = () => ({ x0: -board.x, y0: -board.y, W: width, H: height });

  // 낮은 층(동물·몬스터 아래): 바다의 물고기 그림자와 물결 반짝임. 다리(길) 아래로 지나가면 보이지 않는다
  function drawAmbientLow(map, cell, now) {
    if (reduceMotion || map.theme !== 'sea') return;
    const path = pathCells(map);
    const onRoad = (sx, sy) => {
      const mx = rotated ? sy : sx;
      const my = rotated ? boardH - sx : sy;
      return path.has(`${Math.floor(mx / cell)},${Math.floor(my / cell)}`);
    };
    const t = now / 1000;
    const { x0, y0, W, H } = screenBox();
    inScreen(() => {
      ctx.fillStyle = 'rgba(10, 45, 85, 0.3)';
      for (let k = 0; k < 6; k++) {
        const dir = k % 2 ? 1 : -1;
        const span = W + cell * 4;
        const along = (t * cell * (0.35 + (k % 3) * 0.12) + (k * span) / 6) % span;
        const x = dir > 0 ? x0 - cell * 2 + along : x0 + W + cell * 2 - along;
        const y = y0 + H * ((k * 0.37 + 0.12) % 1) + Math.sin(t * 1.3 + k) * cell * 0.25;
        if (onRoad(x, y)) continue;
        const wag = Math.sin(t * 8 + k) * cell * 0.04;
        const tail = x - dir * cell * 0.2;
        ctx.beginPath();
        ctx.ellipse(x, y, cell * 0.2, cell * 0.075, 0, 0, Math.PI * 2);
        ctx.moveTo(tail, y);
        ctx.lineTo(tail - dir * cell * 0.13, y - cell * 0.07 + wag);
        ctx.lineTo(tail - dir * cell * 0.13, y + cell * 0.07 + wag);
        ctx.closePath();
        ctx.fill();
      }
      const u = Math.max(1, Math.round(cell / 16));
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 16; k++) {
        const h = cellHash(k, 99);
        const twinkle = Math.sin(t * 2.2 + k * 1.9);
        if (twinkle < 0.55) continue;
        const x = Math.round(x0 + ((h % 1000) / 1000) * W);
        const y = Math.round(y0 + (((h >>> 10) % 1000) / 1000) * H);
        if (onRoad(x, y)) continue;
        const len = u * (1 + (twinkle - 0.55) * 5);
        ctx.globalAlpha = (twinkle - 0.55) / 0.45;
        ctx.fillRect(x - len, y - u / 2, len * 2, u);
        ctx.fillRect(x - u / 2, y - len, u, len * 2);
      }
      ctx.globalAlpha = 1;
    });
  }

  // 높은 층(모든 것 위): 천천히 지나가는 구름 그림자, 숲의 나비, 돌산의 새와 바다의 갈매기
  function drawAmbientHigh(map, cell, now) {
    if (reduceMotion) return;
    const t = now / 1000;
    const { x0, y0, W, H } = screenBox();
    const u = Math.max(1, Math.round(cell / 24));
    inScreen(() => {
      ctx.fillStyle = 'rgba(0, 0, 25, 0.07)';
      for (let k = 0; k < 2; k++) {
        const r = cell * (1.6 + k * 0.6);
        const span = W + r * 4;
        const x = x0 - r * 2 + ((t * cell * 0.18 + k * span * 0.55) % span);
        const y = y0 + H * (0.25 + k * 0.45);
        ctx.beginPath();
        for (const [ox, oy, sz] of [[0, 0, 1], [r * 0.7, r * 0.15, 0.75], [-r * 0.65, r * 0.2, 0.7]]) {
          ctx.moveTo(x + ox + r * sz, y + oy);
          ctx.ellipse(x + ox, y + oy, r * sz, r * sz * 0.55, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      if (map.theme === 'forest') {
        const colors = ['#ffffff', '#ffd23f', '#ff9fd0', '#9fe0ff'];
        for (let k = 0; k < 4; k++) {
          const x = Math.round(x0 + W * (0.5 + 0.42 * Math.sin(t * 0.13 + k * 1.7)));
          const y = Math.round(y0 + H * (0.5 + 0.42 * Math.sin(t * 0.17 + k * 2.3)) + Math.sin(t * 3 + k) * cell * 0.08);
          const w = u * (1 + Math.round(2 * Math.abs(Math.sin(t * 12 + k))));
          ctx.fillStyle = colors[k];
          ctx.fillRect(x - w - u, y - u * 2, w, u * 2);
          ctx.fillRect(x + u, y - u * 2, w, u * 2);
          ctx.fillRect(x - w - u + u, y, w - u || u, u);
          ctx.fillRect(x + u, y, w - u || u, u);
          ctx.fillStyle = '#2a1d10';
          ctx.fillRect(x - u / 2, y - u * 2, u, u * 3);
        }
      } else {
        // 돌산은 검은 새, 바다는 하얀 갈매기. 땅에는 흐린 그림자가 따라간다
        const color = map.theme === 'sea' ? '#ffffff' : '#2a2420';
        for (let k = 0; k < 2; k++) {
          const span = W + cell * 2;
          const x = x0 - cell + ((t * cell * 0.9 + k * span * 0.6) % span);
          const y = y0 + H * (0.2 + k * 0.35) + Math.sin(t * 0.8 + k) * cell * 0.3;
          const s = cell * 0.22;
          const flap = Math.sin(t * 9 + k * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.beginPath();
          ctx.ellipse(x + cell * 0.6, y + cell * 1.2, s * 0.9, s * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1.5, u * 1.2);
          ctx.beginPath();
          ctx.moveTo(x - s, y - flap * s * 0.5);
          ctx.lineTo(x, y);
          ctx.lineTo(x + s, y - flap * s * 0.5);
          ctx.stroke();
        }
      }
    });
  }

  // 전체 조명: 왼쪽 위는 밝고 오른쪽 아래로 갈수록 살짝 어둡게 (캔버스 전체)
  function drawLighting() {
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, 'rgba(255,240,200,0.07)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,30,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawBoard(game, cell, now) {
    const { map } = game;
    const path = pathCells(map);
    ctx.imageSmoothingEnabled = false;
    if (map.theme === 'forest') drawForest(map, path, cell);
    else if (map.theme === 'sea') drawSea(map, path, cell, now);
    else drawMountain(map, path, cell);
    drawPortal(game.points[game.points.length - 1], cell, now);
  }

  // 길 끝(몬스터가 도착하는 곳)의 빨간 블랙홀: 붉은 빛무리, 도는 나선 팔, 빨려 드는 불티, 검은 핵.
  // 몬스터를 삼키면 크게 꿀렁이며 밝아진다
  function drawPortal(end, cell, now) {
    const pulse = effects.portalPulse(now);
    const breathe = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 500);
    const R = cell * (0.55 + 0.05 * breathe + 0.25 * pulse);
    const spin = reduceMotion ? 0 : now / 650;
    upright(end.x * cell, end.y * cell, (cx, cy) => {
      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.7);
      glow.addColorStop(0, `rgba(255, 60, 40, ${0.55 + 0.35 * pulse})`);
      glow.addColorStop(0.5, `rgba(200, 0, 30, ${0.25 + 0.25 * pulse})`);
      glow.addColorStop(1, 'rgba(120, 0, 20, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.7, 0, Math.PI * 2);
      ctx.fill();
      // 소용돌이 원반: 바깥은 밝은 빨강, 안쪽으로 갈수록 검붉게
      const disk = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
      disk.addColorStop(0, '#2a0004');
      disk.addColorStop(0.45, '#9a0018');
      disk.addColorStop(0.8, '#ff3b2f');
      disk.addColorStop(1, 'rgba(255, 90, 60, 0)');
      ctx.fillStyle = disk;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // 나선 팔 세 개가 돌며 안으로 말려 든다
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, cell * 0.045);
      ctx.strokeStyle = `rgba(255, ${150 + Math.round(80 * pulse)}, 120, 0.8)`;
      for (let a = 0; a < 3; a++) {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const ang = -spin + (a * Math.PI * 2) / 3 + t * Math.PI * 1.6;
          const r = R * (0.95 - 0.68 * t);
          if (i) ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          else ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        }
        ctx.stroke();
      }
      // 빨려 드는 불티: 바깥에서 나타나 돌면서 핵으로 떨어진다
      for (let i = 0; i < 10; i++) {
        const ph = reduceMotion ? i / 10 : (now / 900 + i / 10) % 1;
        const r = R * 1.35 * (1 - ph) + R * 0.2;
        const ang = i * 2.4 - ph * Math.PI * 2.5 - spin;
        const size = Math.max(1.5, cell * 0.05 * (1 - ph * 0.5));
        ctx.globalAlpha = Math.min(1, ph * 3) * (1 - ph * 0.3);
        ctx.fillStyle = ph < 0.5 ? '#ffb070' : '#ff4030';
        ctx.fillRect(Math.round(cx + Math.cos(ang) * r - size / 2), Math.round(cy + Math.sin(ang) * r - size / 2), size, size);
      }
      ctx.globalAlpha = 1;
      // 검은 핵과 붉은 테두리
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 80, 60, ${0.7 + 0.3 * pulse})`;
      ctx.lineWidth = Math.max(1, cell * 0.03);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function rangeCircle(cx, cy, range, cell, ok) {
    ctx.beginPath();
    ctx.arc(cx, cy, range * cell, 0, Math.PI * 2);
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.18)' : 'rgba(231,76,60,0.2)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : 'rgba(231,76,60,0.8)';
    ctx.stroke();
  }

  // 각성 오라: 몸 뒤에서 맥동하는 빛과 발밑 고리
  function drawAuraGlow(tower, cx, cy, s, now) {
    const color = AURA_COLORS[tower.type];
    const t = now / 1000 + tower.id * 0.37;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const r = s * (0.72 + 0.08 * pulse);
    const glow = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    glow.addColorStop(0, withAlpha(color, 0.6 + 0.25 * pulse));
    glow.addColorStop(0.55, withAlpha(color, 0.28 + 0.12 * pulse));
    glow.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = withAlpha(color, 0.75 + 0.25 * pulse);
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.42, s * 0.46, s * 0.13, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 각성 오라: 위로 떠오르며 사라지는 네모난 빛 조각 (도트 느낌)
  function drawAuraSparkles(tower, cx, cy, s, unit, now) {
    const color = AURA_COLORS[tower.type];
    const t = now / 1000 + tower.id * 0.37;
    const size = Math.max(3, unit * 2);
    for (let i = 0; i < 6; i++) {
      const phase = (t * 0.6 + i / 6) % 1;
      const angle = i * 1.7 + tower.id;
      ctx.fillStyle = withAlpha(color, 1 - phase);
      ctx.fillRect(
        Math.round(cx + Math.cos(angle) * s * 0.42 - size / 2),
        Math.round(cy + s * 0.4 - phase * s * 0.95 - size / 2),
        size,
        size,
      );
    }
  }

  // 합칠 수 있는 타워: 칸 테두리가 맥동한다
  function drawMergeHint(tower, cell, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 150);
    const x = tower.col * cell;
    const y = tower.row * cell;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + 0.15 * pulse})`;
    ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255, 236, 140, ${0.6 + 0.4 * pulse})`;
    ctx.strokeRect(x + 2.5, y + 2.5, cell - 5, cell - 5);
  }

  // 손가락(마우스)을 따라오는 타워. 손가락에 가리지 않게 조금 위에 그린다
  function drawDragged(tower, x, y, cell) {
    const dpr = window.devicePixelRatio || 1;
    const unit = artUnit(1.1 * TOWER_SCALE * cell, ART_SIZE, dpr);
    const s = unit * ART_SIZE;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(animals[tower.type][tower.level], Math.round(x - s / 2), Math.round(y - s * 0.75), s, s);
    ctx.globalAlpha = 1;
  }

  // 등급 받침: 발밑에 희귀는 파랑, 전설은 보라 고리 (일반은 없음)
  function drawGradeRing(grade, cx, feetY, s) {
    if (grade < 1) return;
    ctx.save();
    ctx.strokeStyle = GRADE_COLORS[grade];
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.globalAlpha *= 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, feetY, s * 0.4, s * 0.13, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 신화 동물: 더 큰 20x20 그림, 돌아가는 무지개 오라와 반짝이, 위아래로 살짝 떠 있다
  function drawMythic(tower, cx, cy, cell, dpr, now, theme, stunned) {
    const unit = artUnit(1.15 * TOWER_SCALE * cell, (MYTHIC_SIZE * ART_SCALE), dpr);
    const s = unit * MYTHIC_SIZE * ART_SCALE;
    const bob = Math.round(Math.sin(now / 400 + tower.id) * s * 0.03 * dpr) / dpr;
    const feet = cy + s * 0.4;
    if (theme !== 'sea') dropShadow(cx, feet, s * 0.38, s * 0.11, 0.35);
    const pulse = 0.5 + 0.5 * Math.sin(now / 320 + tower.id);
    const hue = now / 6;
    ctx.save();
    // 빛이 겹치는 곳은 더 밝아지게 더해서 그린다
    ctx.globalCompositeOperation = 'lighter';
    // 발밑에서 솟는 무지개 빛기둥
    const pillar = ctx.createLinearGradient(0, feet, 0, feet - s * 1.4);
    pillar.addColorStop(0, `hsla(${hue % 360}, 100%, 65%, ${0.3 + 0.15 * pulse})`);
    pillar.addColorStop(0.5, `hsla(${(hue + 120) % 360}, 100%, 65%, ${0.12 + 0.08 * pulse})`);
    pillar.addColorStop(1, `hsla(${(hue + 240) % 360}, 100%, 65%, 0)`);
    ctx.fillStyle = pillar;
    ctx.beginPath();
    ctx.ellipse(cx, feet - s * 0.6, s * 0.4, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // 몸 뒤의 빛 (신화마다 색이 다르다)
    const glow = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.75);
    glow.addColorStop(0, `${MYTHICS[tower.type].color}${pulse > 0.5 ? '88' : '66'}`);
    glow.addColorStop(1, `${MYTHICS[tower.type].color}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
    // 고리의 뒤쪽 절반 (몸에 가려지는 쪽)
    rainbowRing(cx, feet, s, hue, pulse, Math.PI, Math.PI * 2);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(cx, cy - s * 0.06 + bob);
    if (towerFacing.get(tower.id) === -1) ctx.scale(-1, 1);
    if (stunned) ctx.globalAlpha *= 0.55;
    ctx.drawImage(mythics[tower.type], -s / 2, -s / 2, s, s);
    ctx.restore();
    if (tower.type === 'phoenix') drawEmbers(tower, cx, cy, s, unit, now);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 고리의 앞쪽 절반 (발 앞을 감싼다)
    rainbowRing(cx, feet, s, hue, pulse, 0, Math.PI);
    // 별빛: 십자 모양 반짝이가 깜빡이며 몸 주위를 돈다
    for (let i = 0; i < 6; i++) {
      const a = now / 700 + (i * Math.PI) / 3;
      const twinkle = 0.5 + 0.5 * Math.sin(now / 140 + i * 1.7 + tower.id);
      const len = Math.max(2, unit * ART_SCALE * (1.5 + 2.5 * twinkle));
      const w = Math.max(1, unit * ART_SCALE * 0.8);
      const x = Math.round(cx + Math.cos(a) * s * 0.55);
      const y = Math.round(cy - s * 0.1 + Math.sin(a) * s * 0.35);
      ctx.globalAlpha = 0.5 + 0.5 * twinkle;
      ctx.fillStyle = `hsl(${(hue * 1.5 + i * 60) % 360}, 100%, 75%)`;
      ctx.fillRect(x - len, y - w / 2, len * 2, w);
      ctx.fillRect(x - w / 2, y - len, w, len * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - w, y - w, w * 2, w * 2);
    }
    ctx.restore();
  }

  // 신화 발밑의 무지개 고리 [from, to] 구간. 넓고 흐린 선을 겹쳐 빛이 번지고, 가운데는 밝은 선이다
  function rainbowRing(cx, cy, s, hue, pulse, from, to) {
    const SEGMENTS = 24;
    const step = (Math.PI * 2) / SEGMENTS;
    // 번지는 빛 두 겹은 더해서 밝게, 가운데 고리는 색이 바래지 않게 보통으로 칠한다
    const passes = [[0.24, 0.1 + 0.06 * pulse, 'lighter', 60], [0.14, 0.22 + 0.1 * pulse, 'lighter', 60], [0.065, 1, 'source-over', 58]];
    for (const [width, alpha, mode, light] of passes) {
      ctx.globalCompositeOperation = mode;
      ctx.lineWidth = Math.max(2, s * width);
      for (let a = from; a < to - 1e-6; a += step) {
        ctx.strokeStyle = `hsla(${(hue + (a / (Math.PI * 2)) * 360) % 360}, 100%, ${light}%, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, s * 0.48, s * 0.16, 0, a, a + step + 0.02);
        ctx.stroke();
      }
    }
    // 반짝이는 하얀 심지
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.48, s * 0.16, 0, from, to);
    ctx.stroke();
  }

  // 불사조: 몸에서 불티가 피어오르고, 몸을 감싼 불빛이 일렁인다
  function drawEmbers(tower, cx, cy, s, unit, now) {
    const flicker = 0.75 + Math.sin(now / 90 + tower.id) * 0.15 + Math.sin(now / 37) * 0.1;
    const glow = ctx.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.6);
    glow.addColorStop(0, `rgba(255, 200, 60, ${0.35 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
    const size = Math.max(2, Math.round(unit * ART_SCALE * 1.2));
    for (let i = 0; i < 7; i++) {
      const life = (now / 900 + i / 7 + (tower.id % 7) / 7) % 1;
      const x = cx + (((i * 37) % 13) / 13 - 0.5) * s * 0.8 + Math.sin(now / 200 + i) * s * 0.05;
      const y = cy + s * 0.25 - life * s * 0.9;
      ctx.globalAlpha = 1 - life;
      ctx.fillStyle = life < 0.3 ? '#fff4b0' : life < 0.6 ? '#ffc21f' : '#ff6a00';
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // 불사조가 남긴 불길: 깜빡이는 주황 원과 불티
  function drawZones(game, cell, now) {
    for (const z of game.zones) {
      const fade = Math.min(1, z.left / 0.6);
      const flicker = 0.85 + Math.sin(now / 70 + z.x * 7) * 0.15;
      const g = ctx.createRadialGradient(z.x * cell, z.y * cell, 0, z.x * cell, z.y * cell, z.r * cell);
      g.addColorStop(0, `rgba(255, 230, 120, ${0.55 * fade * flicker})`);
      g.addColorStop(0.5, `rgba(255, 110, 20, ${0.4 * fade * flicker})`);
      g.addColorStop(1, 'rgba(200, 30, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(z.x * cell, z.y * cell, z.r * cell, 0, Math.PI * 2);
      ctx.fill();
      const u = Math.max(2, cell * 0.06);
      for (let i = 0; i < 5; i++) {
        const h = cellHash(i, Math.floor(z.x * 13 + z.y * 7));
        const ang = (h % 628) / 100;
        const rise = ((now / 600 + i / 5) % 1);
        upright((z.x + Math.cos(ang) * z.r * 0.6) * cell, (z.y + Math.sin(ang) * z.r * 0.6) * cell, (sx, sy) => {
          ctx.globalAlpha = fade * (1 - rise);
          ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff7a1a';
          ctx.fillRect(Math.round(sx), Math.round(sy - rise * cell * 0.6), u, u);
          ctx.globalAlpha = 1;
        });
      }
    }
  }

  function drawTower(tower, cell, selected, theme, stunned = false) {
    const x = tower.col * cell;
    const y = tower.row * cell;
    if (selected) {
      // 사거리 원: 강화는 사거리를 바꾸지 않는다. 해태는 맵 전체라 원이 없다
      const range = tower.mythic ? MYTHICS[tower.type].base.range : towerStats(tower.type, tower.level).range;
      if (range) rangeCircle(x + cell / 2, y + cell / 2, range, cell, true);
    }
    upright(x + cell / 2, y + cell / 2, (px, py) => {
      // 바다에서는 발밑에 뗏목을 띄운다. 몸에 가려지지 않도록 조금 아래로 내려 그린다
      if (theme === 'sea') {
        const k = TOWER_SCALE;
        ctx.drawImage(tiles.seaRaft[0][0], px - cell * 0.55 * k, py - cell * 0.3 * k, cell * 1.1 * k, cell * 0.95 * k);
      }
      // 도트가 뭉개지지 않도록 화면 픽셀 기준 정수 배율로 그린다
      const dpr = window.devicePixelRatio || 1;
      const unit = artUnit(0.95 * TOWER_SCALE * cell, ART_SIZE, dpr);
      const s = unit * ART_SIZE;
      const cx = Math.round(px * dpr) / dpr;
      const cy = Math.round(py * dpr) / dpr;
      const now = performance.now();
      if (tower.mythic) {
        drawMythic(tower, cx, cy, cell, dpr, now, theme, stunned);
        return;
      }
      const awakened = tower.level >= AURA_LEVEL;
      if (theme !== 'sea') dropShadow(cx, cy + s * 0.38, s * 0.36, s * 0.11, 0.32);
      drawGradeRing(gradeOf(tower), cx, cy + s * 0.38, s);
      if (awakened) drawAuraGlow(tower, cx, cy, s, now);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(cx, cy);
      if (towerFacing.get(tower.id) === -1) ctx.scale(-1, 1);
      if (stunned) ctx.globalAlpha *= 0.55;
      ctx.drawImage(animals[tower.type][tower.level], -s / 2, -s / 2, s, s);
      ctx.restore();
      if (awakened) drawAuraSparkles(tower, cx, cy, s, unit, now);
      // 기절: 머리 위에서 별이 돈다
      if (stunned) {
        ctx.font = `${Math.round(cell * 0.32)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        for (let i = 0; i < 3; i++) {
          const a = now / 250 + (i * Math.PI * 2) / 3;
          ctx.fillText('💫', cx + Math.cos(a) * s * 0.3, cy - s * 0.55 + Math.sin(a) * s * 0.08);
        }
      }
    });
    if (selected) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffd23f';
      ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
    }
  }

  function drawEnemy(game, e, cell) {
    const look = ENEMY_LOOK[e.type];
    const p = positionAt(game.points, e.dist);
    const prev = positionAt(game.points, Math.max(0, e.dist - 0.08));
    const side = screenSide(p.x - prev.x, p.y - prev.y);
    const face = side || (facing.get(e) ?? 1);
    facing.set(e, face);
    upright(p.x * cell, p.y * cell, (px, py) => drawEnemyAt(e, look, face, px, py, cell));
  }

  function drawEnemyAt(e, look, face, px, py, cell) {
    // 도트가 뭉개지지 않도록 화면 픽셀 기준 정수 배율로 그린다
    const dpr = window.devicePixelRatio || 1;
    const unit = artUnit(look.size * cell, ART_SIZE, dpr);
    const s = unit * ART_SIZE;
    const cx = Math.round(px * dpr) / dpr;
    const cy = Math.round(py * dpr) / dpr;
    const feet = cy + s * 0.32;

    // 웨이브가 높을수록 강해진 몬스터: 11웨이브부터 주황, 21웨이브부터 보라 기운
    const tier = e.waveNumber >= 21 ? 'rgba(170, 80, 255, 0.55)' : e.waveNumber >= 11 ? 'rgba(255, 140, 40, 0.5)' : null;
    ctx.fillStyle = tier && !isBoss(e.type) ? tier : 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, feet, s * (tier ? 0.42 : 0.36), s * (tier ? 0.13 : 0.1), 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.poison || e.slow) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = e.poison ? '#58d65c' : '#7fd0ff';
      ctx.beginPath();
      ctx.ellipse(cx, feet, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 황금 몬스터: 금빛 후광과 몸 주위에서 반짝이는 금가루
    if (e.type === 'golden') {
      const now = performance.now();
      const glow = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.75);
      glow.addColorStop(0, 'rgba(255, 220, 80, 0.55)');
      glow.addColorStop(1, 'rgba(255, 200, 40, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      const size = Math.max(2, Math.round(unit * ART_SCALE));
      for (let i = 0; i < 6; i++) {
        const life = (now / 600 + i / 6 + e.id * 0.37) % 1;
        const ang = i * 1.05 + e.id;
        const x = cx + Math.cos(ang) * s * (0.25 + 0.3 * life) - face * life * s * 0.4;
        const y = cy + Math.sin(ang) * s * 0.3 - life * s * 0.2;
        ctx.globalAlpha = 1 - life;
        ctx.fillStyle = i % 2 ? '#fff3b0' : '#ffd23f';
        ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      }
      ctx.globalAlpha = 1;
    }
    const frameIndex = Math.floor(e.dist * 4) % 2;
    const frame = sprites[look.sprite][frameIndex];
    // 슬라임은 몸이 눌리는 프레임이 있어서 위아래 통통거림은 다른 적에게만 준다
    const bob = frameIndex === 1 && look.sprite !== 'splitter' ? unit : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(cx, cy - s * 0.12 - bob);
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(frame, -s / 2, -s / 2, s, s);
    // 방금 맞았으면 하얗게 번쩍인다
    if (performance.now() - effects.hitTime(e.id) < HIT_FLASH_MS) {
      ctx.globalAlpha = 0.75;
      ctx.drawImage(silhouettes[look.sprite][frameIndex], -s / 2, -s / 2, s, s);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

  }

  // 체력바는 몬스터 그림을 모두 그린 뒤에 그려서 다른 몬스터 그림에 가려지지 않게 한다
  function drawEnemyHp(game, e, cell) {
    const p = positionAt(game.points, e.dist);
    upright(p.x * cell, p.y * cell, (px, py) => drawHpBarAt(e, ENEMY_LOOK[e.type], px, py, cell));
  }

  function drawHpBarAt(e, look, px, py, cell) {
    const dpr = window.devicePixelRatio || 1;
    const unit = artUnit(look.size * cell, ART_SIZE, dpr);
    const s = unit * ART_SIZE;
    const cx = Math.round(px * dpr) / dpr;
    const cy = Math.round(py * dpr) / dpr;
    // 체력바: 두꺼운 빨간 바 (어두운 테두리와 배경)
    const w = Math.round(Math.max(cell * 0.7, s * 0.8));
    const h = Math.max(5, Math.round(cell * 0.16));
    const ratio = Math.max(0, e.hp / e.maxHp);
    const barX = Math.round(cx - w / 2);
    const barY = Math.round(cy - s * 0.62 - cell * 0.12 - h / 2);
    ctx.fillStyle = '#1a0606';
    ctx.fillRect(barX - 1, barY - 1, w + 2, h + 2);
    ctx.fillStyle = '#4a1414';
    ctx.fillRect(barX, barY, w, h);
    ctx.fillStyle = '#e8262b';
    ctx.fillRect(barX, barY, Math.round(w * ratio), h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(barX, barY, Math.round(w * ratio), Math.max(1, Math.round(h * 0.3)));
  }

  function collectEvents(game, now) {
    if (game.events === lastEvents) return;
    lastEvents = game.events;
    for (const ev of game.events) {
      effects.fromEvent(ev, now, { x: game.map.cols / 2, y: game.map.rows / 2 });
      if (ev.type === 'waveClear') effects.waveClear(game.map.cols / 2, game.map.rows / 2, ev.bonus, now);
      // 타워는 마지막으로 쏜 적 쪽을 바라본다
      if (ev.type === 'shot' || ev.type === 'mythicShot') {
        const side = screenSide(ev.to.x - ev.from.x, ev.to.y - ev.from.y);
        if (side) towerFacing.set(ev.towerId, side);
      }
    }
  }

  // 동물마다 다른 발사체 (맵 좌표에서 그린다)
  function drawProjectile(f, k, cell) {
    const at = (t) => ({ x: (f.from.x + (f.to.x - f.from.x) * t) * cell, y: (f.from.y + (f.to.y - f.from.y) * t) * cell });
    const p = at(k);
    const u = cell * 0.08;
    if (f.tower === 'eagle') {
      const tail = at(Math.max(0, k - 0.45));
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - u, p.y - u, u * 2, u * 2);
    } else if (f.tower === 'penguin') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#bff0ff';
      ctx.fillRect(-u * 1.2, -u * 1.2, u * 2.4, u * 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-u * 0.5, -u * 0.5, u, u);
      ctx.restore();
    } else if (f.tower === 'snake') {
      for (let i = 2; i >= 0; i--) {
        const q = at(Math.max(0, k - i * 0.12));
        ctx.fillStyle = i ? 'rgba(125, 255, 106, 0.45)' : '#7dff6a';
        ctx.beginPath();
        ctx.arc(q.x, q.y, u * (1.3 - i * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.tower === 'phoenix') {
      // 불꽃 깃털: 꼬리가 긴 불덩이
      for (let i = 4; i >= 0; i--) {
        const q = at(Math.max(0, k - i * 0.08));
        ctx.fillStyle = ['#fff3b0', '#ffd23f', '#ffae3b', '#ff7a1a', '#e8341c'][i];
        ctx.globalAlpha = 1 - i * 0.15;
        ctx.beginPath();
        ctx.arc(q.x, q.y, u * (2 - i * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (f.tower === 'gumiho') {
      // 여우불: 푸른 불꽃이 살짝 흔들리며 날아간다
      const wob = Math.sin(k * Math.PI * 3) * cell * 0.15;
      ctx.fillStyle = 'rgba(79, 195, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(p.x, p.y + wob, u * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bff0ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y + wob, u * 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.tower === 'girin') {
      const tail = at(Math.max(0, k - 0.5));
      ctx.strokeStyle = '#7dffb0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - u, p.y - u, u * 2, u * 2);
    } else if (f.tower === 'elephant') {
      ctx.fillStyle = '#e8d2a6';
      ctx.fillRect(p.x - u * 1.2, p.y - u * 1.2, u * 2.4, u * 2.4);
    } else {
      // 다람쥐: 도토리
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(p.x - u, p.y - u * 0.6, u * 2, u * 1.6);
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(p.x - u * 1.2, p.y - u * 1.2, u * 2.4, u * 0.7);
    }
  }

  // 블랙홀에 빨려 드는 몬스터: 블랙홀 주위를 돌며 비틀리고 작아지다 사라진다 (k: 0→1)
  function drawSucked(f, k, cell) {
    const look = ENEMY_LOOK[f.enemy];
    if (!look) return;
    const img = sprites[look.sprite][0];
    const dpr = window.devicePixelRatio || 1;
    const s = artUnit(look.size * cell, ART_SIZE, dpr) * ART_SIZE;
    const orbit = Math.sin(k * Math.PI) * cell * 0.3;
    const ang = f.spin * k * Math.PI * 3;
    const shrink = Math.max(0.02, 1 - k * k);
    upright(f.x * cell, f.y * cell, (sx, sy) => {
      ctx.save();
      ctx.translate(sx + Math.cos(ang) * orbit, sy + Math.sin(ang) * orbit * 0.6);
      ctx.rotate(f.spin * k * Math.PI * 4);
      ctx.scale(shrink * (1 + 0.3 * k), shrink * (1 - 0.4 * k));
      ctx.globalAlpha = 1 - k * k * k;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    });
  }

  // 화면 기준으로 똑바로 쓰는 떠오르는 글자 (보상 숫자, 성장 문구)
  function floatingText(f, k, cell) {
    const big = f.kind === 'text' && f.big;
    const damage = f.kind === 'damage';
    const size = damage ? cell * 0.34 : f.kind === 'coin' ? cell * 0.38 : cell * (big ? 0.8 : 0.52);
    const pop = (f.kind === 'text' || damage) && k < 0.12 ? 0.6 + (k / 0.12) * 0.4 : 1;
    const rise = cell * (damage ? 0.55 : f.kind === 'coin' ? 0.8 : 1.0) * (1 - (1 - k) ** 2);
    upright(f.x * cell, f.y * cell, (sx, sy) => {
      ctx.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1;
      ctx.font = `900 ${Math.round(size * pop)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, size * 0.16);
      ctx.strokeStyle = f.warn ? '#3a0000' : big ? '#5a0d00' : '#2a1c00';
      ctx.strokeText(f.text, sx, sy - cell * 0.35 - rise);
      // 데미지는 노란색, 보상(+골드)은 주황빛 금색, 문구는 금색
      ctx.fillStyle = damage ? '#fff200' : f.kind === 'coin' ? '#ffb020' : f.stun ? '#ff8fd0' : f.warn ? '#ff5a3c' : big ? '#ffe066' : '#ffd23f';
      ctx.fillText(f.text, sx, sy - cell * 0.35 - rise);
    });
  }

  function drawEffects(cell, now) {
    for (const f of effects.active(now)) {
      const age = now - f.t;
      const k = age / f.life;
      ctx.globalAlpha = 1;
      if (f.kind === 'projectile') {
        drawProjectile(f, k, cell);
      } else if (f.kind === 'suck') {
        drawSucked(f, k, cell);
      } else if (f.kind === 'beam') {
        // 천마의 날개 바람: 굵은 하얀 줄기가 빠르게 사라진다
        ctx.globalAlpha = 1 - k;
        ctx.lineCap = 'round';
        for (const [w, c] of [[cell * 0.5, 'rgba(127, 200, 255, 0.5)'], [cell * 0.2, '#ffffff']]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w * (1 - k * 0.5);
          ctx.beginPath();
          ctx.moveTo(f.from.x * cell, f.from.y * cell);
          ctx.lineTo(f.to.x * cell, f.to.y * cell);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      } else if (f.kind === 'shock') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#f3e3bf';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x * cell, f.y * cell, cell * (0.2 + 0.9 * k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = f.big ? 5 : 3;
        ctx.beginPath();
        ctx.arc(f.x * cell, f.y * cell, cell * (0.2 + (f.reach ?? (f.big ? 1.5 : 0.6)) * k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'particle') {
        // 파편은 화면 아래로 떨어져야 하므로 화면 좌표에서 움직인다
        const a = age / 1000;
        upright(f.x * cell, f.y * cell, (sx, sy) => {
          const size = Math.max(2, f.size * cell);
          ctx.globalAlpha = 1 - k * k;
          ctx.fillStyle = f.color;
          ctx.fillRect(
            Math.round(sx + f.vx * a * cell - size / 2),
            Math.round(sy + (f.vy * a + 5 * a * a) * cell - size / 2),
            size,
            size,
          );
        });
      } else {
        floatingText(f, k, cell);
      }
    }
    ctx.globalAlpha = 1;
  }

  // 적이 집에 도착하면 화면 가장자리가 붉게 번쩍인다 (화면 좌표)
  function drawLeakFlash(now) {
    const k = effects.flash(now);
    if (!k) return;
    const glow = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.7);
    glow.addColorStop(0, 'rgba(255, 0, 0, 0)');
    glow.addColorStop(1, `rgba(220, 20, 20, ${0.55 * k})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // 소환과 합성 연출 (main.js에서 부른다)
  function celebrate(kind, tower) {
    const now = performance.now();
    const x = tower.col + 0.5;
    const y = tower.row + 0.5;
    if (kind === 'summon') effects.summon(x, y, now);
    else if (kind === 'mythic') effects.fromEvent({ type: 'mythic', mythic: tower.type, x, y }, now);
    else effects.merge(x, y, tower.level, now, towerName(tower.type));
  }

  function draw(game, view) {
    const { cols, rows } = game.map;
    const dpr = window.devicePixelRatio || 1;
    const cell = rotated ? board.height / cols : board.width / cols;
    boardH = rows * cell;
    const now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    // 보스 처치, 각성 때 화면이 흔들린다 (동작 줄이기 설정이면 흔들지 않는다)
    const shake = reduceMotion ? 0 : effects.shake(now);
    shakeX = shake ? Math.sin(now * 0.09) * shake * cell * 0.18 : 0;
    shakeY = shake ? Math.cos(now * 0.113) * shake * cell * 0.18 : 0;
    ctx.translate(board.x + shakeX, board.y + shakeY);
    drawMargins(game.map, cell, now);
    if (rotated) {
      ctx.translate(boardH, 0);
      ctx.rotate(Math.PI / 2);
    }
    drawBoard(game, cell, now);
    drawAmbientLow(game.map, cell, now);
    drawLighting();
    drawZones(game, cell, now);
    for (const t of game.towers) {
      if (view.mergeTargets?.has(t.id)) drawMergeHint(t, cell, now);
      // 끌고 있는 타워는 원래 자리에 흐리게 남긴다
      ctx.globalAlpha = view.drag?.towerId === t.id ? 0.35 : 1;
      drawTower(t, cell, t.id === view.selectedTowerId, game.map.theme, t.stunUntil > game.time);
      ctx.globalAlpha = 1;
    }
    for (const e of game.enemies) drawEnemy(game, e, cell);
    drawAmbientHigh(game.map, cell, now);
    for (const e of game.enemies) drawEnemyHp(game, e, cell);
    collectEvents(game, now);
    drawEffects(cell, now);
    // 끄는 타워는 손가락 위치(화면 좌표)를 그대로 따라간다
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLeakFlash(now);
    if (view.drag) {
      const t = game.towers.find((x) => x.id === view.drag.towerId);
      if (t) drawDragged(t, view.drag.x, view.drag.y, cell);
    }
  }

  resize();
  // 캔버스 안에서 실제 맵이 차지하는 자리(CSS 픽셀). 터치 좌표를 맵 칸으로 바꿀 때 쓴다
  const boardRect = () => ({ ...board });
  return { draw, resize, celebrate, boardRect };
}
