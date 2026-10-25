import { MAPS } from './data/maps.js';
import { TOWERS } from './data/towers.js';
import { createGame, placeTower, upgradeTower, sellTower, callNextWave, step } from './core/game.js';
import { canBuild } from './core/path.js';
import { loadSave, writeSave, recordResult, starsFor } from './storage.js';
import { loadAnimals, createRenderer } from './ui/render.js';
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
let selectedType = null;
let selectedTower = null;
let hover = null;
const ui = { paused: false, speed: 1 };
let autoPaused = false;
let finished = false;
let lastTs = 0;

const animals = await loadAnimals();
const renderer = createRenderer(document.getElementById('board'), animals);

const hud = createHud(document.getElementById('app'), {
  onPickType: pickType,
  onCallWave: () => { if (game) callNextWave(game); },
  onSpeed: () => { ui.speed = SPEEDS[(SPEEDS.indexOf(ui.speed) + 1) % SPEEDS.length]; },
  onPause: togglePause,
  onMenu: goMenu,
  onUpgrade: () => { if (game && selectedTower) upgradeTower(game, selectedTower.id); },
  onSell: () => {
    if (game && selectedTower) sellTower(game, selectedTower.id);
    selectTower(null);
  },
  onCloseInfo: () => selectTower(null),
  onRetry: () => startMap(mapId),
  onStartMap: startMap,
});

function pickType(id) {
  if (!game || game.status !== 'running') return;
  if (selectedType === id) { selectType(null); return; }
  if (TOWERS[id].cost > game.gold) return;
  selectTower(null);
  selectType(id);
}

function selectType(id) {
  selectedType = id;
  hud.setSelectedType(id);
}

function selectTower(tower) {
  selectedTower = tower;
  hud.showTowerInfo(tower);
  if (tower) selectType(null);
}

function togglePause() {
  if (!game || game.status !== 'running') return;
  ui.paused = !ui.paused;
  autoPaused = false;
}

function cancelSelection() {
  selectType(null);
  selectTower(null);
}

function onCell(col, row) {
  if (!game || game.status !== 'running') return;
  const tower = game.towers.find((t) => t.col === col && t.row === row);
  if (tower) {
    selectTower(selectedTower === tower ? null : tower);
    return;
  }
  if (selectedType) {
    const placed = placeTower(game, selectedType, col, row);
    if (placed) {
      if (TOWERS[selectedType].cost > game.gold) selectType(null);
    } else if (!canBuild(game.map, col, row, new Set())) {
      cancelSelection();
    }
    return;
  }
  selectTower(null);
}

attachInput(document.getElementById('board'), {
  cols: MAPS[0].cols,
  rows: MAPS[0].rows,
  onCell,
  onCancel: cancelSelection,
  onHover: (cell) => { hover = cell; },
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
  cancelSelection();
  hud.showGame();
  renderer.resize();
  lastTs = performance.now();
}

function goMenu() {
  game = null;
  mapId = null;
  cancelSelection();
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
    renderer.draw(game, {
      selectedType,
      selectedTowerId: selectedTower ? selectedTower.id : null,
      hover,
    });
    hud.update(game, ui);
    if (game.status !== 'running' && !finished) finish();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (!game || e.repeat) return;
  const n = Number(e.key);
  if (n >= 1 && n <= Object.keys(TOWERS).length) pickType(Object.keys(TOWERS)[n - 1]);
  else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.key === 'Escape') cancelSelection();
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
