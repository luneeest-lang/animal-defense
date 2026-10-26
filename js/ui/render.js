import { TOWERS, AURA_COLORS } from '../data/towers.js';
import { towerStats } from '../core/towers.js';
import { positionAt, pathCells, canBuild } from '../core/path.js';
import { ENEMY_LOOK, SPRITE_SIZE } from '../data/sprites.js';
import { bakeSprites, bakeTiles, bakeAnimals } from './pixel.js';

const FX_MS = 160;
const TOWER_COLORS = {
  squirrel: '#ffe08a', elephant: '#ffb37a', penguin: '#9fd8ff', eagle: '#ffffff', snake: '#9bf06a',
};
const WATER_FRAME_MS = 700;
const AURA_LEVEL = 3;

const withAlpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
// 숲 바닥 무늬 비율: 기본, 풀포기, 버섯, 낙엽, 기본2 (버섯은 드물게)
const FOREST_GRASS_WEIGHTS = [8, 3, 1, 2, 6];

// 칸 좌표로 정해지는 의사 난수. 같은 칸은 늘 같은 무늬가 나온다.
const cellHash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let fx = [];
  let lastEvents = null;
  const sprites = bakeSprites();
  const tiles = bakeTiles();
  const animals = bakeAnimals();
  const towerFacing = new Map();
  const facing = new WeakMap();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
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

  function drawMeadow(map, path, cell) {
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const onPath = path.has(`${c},${r}`);
        ctx.fillStyle = onPath ? '#e8cf9c' : (c + r) % 2 ? '#a5d36f' : '#9bcb65';
        ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
      }
    }
    for (const [c, r] of map.blocked) {
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.ellipse((c + 0.5) * cell, (r + 0.58) * cell, cell * 0.36, cell * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a6b1b2';
      ctx.beginPath();
      ctx.ellipse((c + 0.42) * cell, (r + 0.5) * cell, cell * 0.14, cell * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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
    for (const [c, r] of map.blocked) drawTile(tiles.forestTree[0][0], c, r, cell);
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
    for (const [c, r] of map.blocked) drawTile(tiles.seaReef[0][0], c, r, cell);
  }

  function drawBoard(game, cell, view, now) {
    const { map } = game;
    const path = pathCells(map);
    const occupied = new Set(game.towers.map((t) => `${t.col},${t.row}`));
    ctx.imageSmoothingEnabled = false;
    if (map.theme === 'forest') drawForest(map, path, cell);
    else if (map.theme === 'sea') drawSea(map, path, cell, now);
    else drawMeadow(map, path, cell);
    const end = game.points[game.points.length - 1];
    ctx.font = `${cell * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', end.x * cell, end.y * cell);
    if (view.selectedType) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
          if (canBuild(map, c, r, occupied)) ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
        }
      }
    }
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

  function drawTower(tower, cell, selected, theme) {
    const x = tower.col * cell;
    const y = tower.row * cell;
    // 바다에서는 발밑에 모래섬을 깐다. 몸에 가려지지 않도록 조금 아래로 내려 그린다
    if (theme === 'sea') ctx.drawImage(tiles.seaIslet[0][0], x - cell * 0.05, y + cell * 0.2, cell * 1.1, cell * 0.95);
    if (selected) {
      const s = towerStats(tower.type, tower.level);
      rangeCircle(x + cell / 2, y + cell / 2, s.range, cell, true);
    }
    // 도트가 뭉개지지 않도록 화면 픽셀 기준 정수 배율로 그린다
    const dpr = window.devicePixelRatio || 1;
    const unit = Math.max(1, Math.round((0.95 * cell * dpr) / SPRITE_SIZE)) / dpr;
    const s = unit * SPRITE_SIZE;
    const cx = Math.round((x + cell / 2) * dpr) / dpr;
    const cy = Math.round((y + cell / 2) * dpr) / dpr;
    const awakened = tower.level >= AURA_LEVEL;
    const now = performance.now();
    if (awakened) drawAuraGlow(tower, cx, cy, s, now);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(cx, cy);
    if (towerFacing.get(tower.id) === -1) ctx.scale(-1, 1);
    ctx.drawImage(animals[tower.type][tower.level], -s / 2, -s / 2, s, s);
    ctx.restore();
    if (awakened) drawAuraSparkles(tower, cx, cy, s, unit, now);
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
    let face = facing.get(e) ?? 1;
    if (p.x - prev.x > 0.001) face = 1;
    else if (p.x - prev.x < -0.001) face = -1;
    facing.set(e, face);

    // 도트가 뭉개지지 않도록 화면 픽셀 기준 정수 배율로 그린다
    const dpr = window.devicePixelRatio || 1;
    const unit = Math.max(1, Math.round((look.size * cell * dpr) / SPRITE_SIZE)) / dpr;
    const s = unit * SPRITE_SIZE;
    const cx = Math.round(p.x * cell * dpr) / dpr;
    const cy = Math.round(p.y * cell * dpr) / dpr;
    const feet = cy + s * 0.32;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, feet, s * 0.36, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.poison || e.slow) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = e.poison ? '#58d65c' : '#7fd0ff';
      ctx.beginPath();
      ctx.ellipse(cx, feet, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
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
    ctx.restore();

    const w = Math.max(cell * 0.6, s * 0.7);
    const ratio = Math.max(0, e.hp / e.maxHp);
    const barY = cy - s * 0.62 - cell * 0.1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - w / 2, barY, w, cell * 0.09);
    ctx.fillStyle = ratio > 0.5 ? '#4cd964' : ratio > 0.25 ? '#ffcc00' : '#ff3b30';
    ctx.fillRect(cx - w / 2, barY, w * ratio, cell * 0.09);
  }

  function collectEvents(game, now) {
    if (game.events === lastEvents) return;
    lastEvents = game.events;
    for (const ev of game.events) {
      fx.push({ ...ev, t: now });
      // 타워는 마지막으로 쏜 적 쪽을 바라본다
      if (ev.type === 'shot' && Math.abs(ev.to.x - ev.from.x) > 0.05) towerFacing.set(ev.towerId, ev.to.x < ev.from.x ? -1 : 1);
    }
    if (fx.length > 200) fx = fx.slice(-200);
  }

  function drawEffects(cell, now) {
    fx = fx.filter((f) => now - f.t < FX_MS);
    for (const f of fx) {
      const k = (now - f.t) / FX_MS;
      ctx.globalAlpha = 1 - k;
      if (f.type === 'shot') {
        ctx.strokeStyle = TOWER_COLORS[f.tower] ?? '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.from.x * cell, f.from.y * cell);
        ctx.lineTo(f.to.x * cell, f.to.y * cell);
        ctx.stroke();
      } else if (f.type === 'death') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x * cell, f.y * cell, cell * (0.2 + 0.4 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(game, view) {
    const cell = width / game.map.cols;
    const now = performance.now();
    ctx.clearRect(0, 0, width, height);
    drawBoard(game, cell, view, now);
    if (view.selectedType && view.hover) {
      const occupied = new Set(game.towers.map((t) => `${t.col},${t.row}`));
      const ok = canBuild(game.map, view.hover.col, view.hover.row, occupied);
      const range = TOWERS[view.selectedType].base.range;
      rangeCircle((view.hover.col + 0.5) * cell, (view.hover.row + 0.5) * cell, range, cell, ok);
    }
    for (const t of game.towers) drawTower(t, cell, t.id === view.selectedTowerId, game.map.theme);
    for (const e of game.enemies) drawEnemy(game, e, cell);
    collectEvents(game, now);
    drawEffects(cell, now);
  }

  resize();
  return { draw, resize };
}
