import { TOWERS } from '../data/towers.js';
import { towerStats } from '../core/towers.js';
import { positionAt, pathCells, canBuild } from '../core/path.js';
import { ENEMY_LOOK, SPRITE_SIZE } from '../data/sprites.js';
import { bakeSprites } from './pixel.js';

const FRAME = 64;
const FX_MS = 160;
const TOWER_COLORS = {
  squirrel: '#ffe08a', elephant: '#ffb37a', penguin: '#9fd8ff', eagle: '#ffffff', snake: '#9bf06a',
};
export function loadAnimals() {
  const load = (id) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `assets/animals/${id}.svg`;
  });
  return Promise.all(Object.keys(TOWERS).map(load)).then((imgs) => (
    Object.fromEntries(Object.keys(TOWERS).map((id, i) => [id, imgs[i]]))
  ));
}

export function createRenderer(canvas, animals) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let fx = [];
  let lastEvents = null;
  const sprites = bakeSprites();
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

  function drawBoard(game, cell, view) {
    const { map } = game;
    const path = pathCells(map);
    const occupied = new Set(game.towers.map((t) => `${t.col},${t.row}`));
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

  function drawTower(tower, cell, selected) {
    const x = tower.col * cell;
    const y = tower.row * cell;
    if (selected) {
      const s = towerStats(tower.type, tower.level);
      rangeCircle(x + cell / 2, y + cell / 2, s.range, cell, true);
    }
    const img = animals[tower.type];
    if (img) {
      ctx.drawImage(img, tower.level * FRAME, 0, FRAME, FRAME, x, y, cell, cell);
    } else {
      ctx.font = `${cell * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TOWERS[tower.type].emoji, x + cell / 2, y + cell / 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${cell * 0.28}px sans-serif`;
      if (tower.level > 0) ctx.fillText('★'.repeat(tower.level), x + cell / 2, y + cell * 0.9);
    }
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
    for (const ev of game.events) fx.push({ ...ev, t: now });
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
    drawBoard(game, cell, view);
    if (view.selectedType && view.hover) {
      const occupied = new Set(game.towers.map((t) => `${t.col},${t.row}`));
      const ok = canBuild(game.map, view.hover.col, view.hover.row, occupied);
      const range = TOWERS[view.selectedType].base.range;
      rangeCircle((view.hover.col + 0.5) * cell, (view.hover.row + 0.5) * cell, range, cell, ok);
    }
    for (const t of game.towers) drawTower(t, cell, t.id === view.selectedTowerId);
    for (const e of game.enemies) drawEnemy(game, e, cell);
    collectEvents(game, now);
    drawEffects(cell, now);
  }

  resize();
  return { draw, resize };
}
