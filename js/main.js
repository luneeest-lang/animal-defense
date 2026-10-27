import { MAPS } from './data/maps.js';
import {
  createGame, summonTower, canMerge, mergeTowers, sellTower, callNextWave, step, upgradeAnimal, chooseCard,
} from './core/game.js';
import { loadSave, writeSave, recordResult, starsFor } from './storage.js';
import { createRenderer } from './ui/render.js';
import { attachInput } from './ui/input.js';
import { createHud } from './ui/hud.js';

const MAX_FRAME_DT = 0.25;
const SPEEDS = [1, 2];

function openStore() {
  try {
    const s = window.localStorage;
    s.getItem('td-probe');
    return s;
  } catch {
    return { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); } };
  }
}

const store = openStore();
let save = loadSave(store);

let game = null;
let mapId = null;
let selectedTower = null;
let drag = null; // { towerId, x, y } 끌고 있는 타워와 포인터 위치(캔버스 CSS 픽셀)
const ui = { paused: false, speed: 1 };
let autoPaused = false;
let finished = false;
let lastTs = 0;

const renderer = createRenderer(document.getElementById('board'));

const hud = createHud(document.getElementById('app'), {
  onSummon: summon,
  onUpgradeAnimal: (id) => { if (game) upgradeAnimal(game, id); },
  onPickCard: (id) => { if (game) chooseCard(game, id); },
  onCallWave: () => { if (game) callNextWave(game); },
  onSpeed: () => { ui.speed = SPEEDS[(SPEEDS.indexOf(ui.speed) + 1) % SPEEDS.length]; },
  onPause: togglePause,
  onMenu: goMenu,
  onSell: () => {
    if (game && selectedTower) sellTower(game, selectedTower.id);
    selectTower(null);
  },
  onCloseInfo: () => selectTower(null),
  onRetry: () => startMap(mapId),
  onStartMap: startMap,
});

function summon() {
  const tower = game && summonTower(game);
  if (tower) renderer.celebrate('summon', tower);
}

function selectTower(tower) {
  selectedTower = tower;
  hud.showTowerInfo(tower);
}

function togglePause() {
  if (!game || game.status !== 'running') return;
  ui.paused = !ui.paused;
  autoPaused = false;
}

const towerAt = (col, row) => game.towers.find((t) => t.col === col && t.row === row);

attachInput(document.getElementById('board'), {
  cols: MAPS[0].cols,
  rows: MAPS[0].rows,
  onTap(col, row) {
    if (!game || game.status !== 'running') return;
    const tower = towerAt(col, row);
    selectTower(tower && tower !== selectedTower ? tower : null);
  },
  onCancel: () => selectTower(null),
  onDragStart(col, row) {
    if (!game || game.status !== 'running') return false;
    const tower = towerAt(col, row);
    if (!tower) return false;
    selectTower(null);
    drag = { towerId: tower.id, x: 0, y: 0 };
    return true;
  },
  onDragMove(x, y) {
    if (drag) Object.assign(drag, { x, y });
  },
  onDrop(cell) {
    if (drag && game && cell) {
      const target = towerAt(cell.col, cell.row);
      if (target && mergeTowers(game, drag.towerId, target.id)) renderer.celebrate('merge', target);
    }
    drag = null;
  },
});

function startMap(id) {
  const map = MAPS.find((m) => m.id === id);
  if (!map || MAPS.indexOf(map) >= save.unlocked) return;
  mapId = id;
  game = createGame(map);
  finished = false;
  ui.paused = false;
  ui.speed = 1;
  autoPaused = false;
  drag = null;
  selectTower(null);
  hud.showGame();
  renderer.resize();
  lastTs = performance.now();
}

function goMenu() {
  game = null;
  mapId = null;
  drag = null;
  selectTower(null);
  hud.showMenu(save);
}

function finish() {
  finished = true;
  const won = game.status === 'won';
  // 패배한 웨이브는 막지 못한 것이므로 직전 웨이브까지만 기록한다
  const wave = won ? game.waveNumber : Math.max(0, game.waveNumber - 1);
  save = recordResult(save, mapId, { wave, lives: game.lives, won });
  hud.showSaveWarning(!writeSave(store, save));
  hud.showResult({ won, wave, lives: game.lives, starCount: won ? starsFor(game.lives) : 0 });
}

function frame(ts) {
  const dt = Math.min(Math.max((ts - lastTs) / 1000, 0), MAX_FRAME_DT);
  lastTs = ts;
  if (game) {
    if (!ui.paused && game.status === 'running') step(game, dt * ui.speed);
    // 끌고 있는 타워가 사라졌으면(판매, 게임 종료) 드래그를 끝낸다
    if (drag && !game.towers.some((t) => t.id === drag.towerId)) drag = null;
    const mergeTargets = drag
      ? new Set(game.towers.filter((t) => canMerge(game, drag.towerId, t.id)).map((t) => t.id))
      : new Set();
    renderer.draw(game, {
      selectedTowerId: selectedTower ? selectedTower.id : null,
      drag,
      mergeTargets,
    });
    hud.update(game, ui);
    if (game.status !== 'running' && !finished) finish();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (!game || e.repeat) return;
  if (game.cardChoices && ['1', '2', '3'].includes(e.key)) chooseCard(game, game.cardChoices[Number(e.key) - 1]);
  else if (e.key === 's' || e.key === 'S') summon();
  else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.key === 'Escape') selectTower(null);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game && game.status === 'running' && !ui.paused) {
      ui.paused = true;
      autoPaused = true;
    }
  } else {
    lastTs = performance.now();
    if (autoPaused) {
      ui.paused = false;
      autoPaused = false;
    }
  }
});

// 화면 가로 크기가 크게 바뀌면(회전, 창 크기 조절) 자동 일시정지한다.
// 모바일 주소창 때문에 세로만 바뀌는 경우는 무시한다.
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  renderer.resize();
  if (Math.abs(window.innerWidth - lastWidth) > 40 && game && game.status === 'running') {
    ui.paused = true;
    autoPaused = false;
  }
  lastWidth = window.innerWidth;
});
new ResizeObserver(() => renderer.resize()).observe(document.getElementById('board'));

hud.showSaveWarning(!writeSave(store, save));
hud.showMenu(save);
requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(frame); });
