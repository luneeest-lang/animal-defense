import { MAPS } from './data/maps.js';
import {
  createGame, summonTower, canMerge, mergeTowers, sellTower, callNextWave, step, upgradeAnimal, chooseCard,
} from './core/game.js';
import { craftMythic } from './core/mythics.js';
import { snapshotGame, restoreGame, isBetweenWaves } from './core/snapshot.js';
import {
  loadSave, writeSave, recordResult, starsFor, loadRun, writeRun, clearRun,
} from './storage.js';
import { createSound, loadSoundSettings, saveSoundSettings } from './ui/sound.js';
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
    const fail = () => { throw new Error('storage unavailable'); };
    return { getItem: fail, setItem: fail, removeItem: fail };
  }
}

const store = openStore();
let save = loadSave(store);
// 이어할 게임(웨이브 사이에 자동 저장). 되살릴 수 없는 저장은 버린다
const savedRun = loadRun(store);
let run = savedRun && restoreGame(savedRun) ? savedRun : null;
if (!run) clearRun(store);

let game = null;
let mapId = null;
let selectedTower = null;
let drag = null; // { towerId, x, y } 끌고 있는 타워와 포인터 위치(캔버스 CSS 픽셀)
// mythicOpen: 신화 조합표가 열려 있는지 (열려 있는 동안 게임이 멈춘다)
// music, sfx: 배경음·효과음을 켰는지 (따로 켜고 끈다)
const ui = { paused: false, speed: 1, mythicOpen: false, ...loadSoundSettings(store) };
const sound = createSound();
sound.setSettings(ui);
let lastBossWarning = 0;
let autoPaused = false;
let finished = false;
let lastTs = 0;

const renderer = createRenderer(document.getElementById('board'));

const hud = createHud(document.getElementById('app'), {
  onSummon: summon,
  onUpgradeAnimal: (id) => {
    if (game && upgradeAnimal(game, id)) afterAction('upgrade');
  },
  onPickCard: (id) => {
    if (game && chooseCard(game, id)) afterAction('card');
  },
  onOpenMythic: () => { if (game && game.status === 'running') { ui.mythicOpen = true; selectTower(null); } },
  onCloseMythic: () => { ui.mythicOpen = false; },
  onCraft: (id) => {
    if (!game) return;
    // 조합표가 열린 동안은 게임이 멈춰 있어 이벤트로는 연출이 안 나오므로 직접 부른다
    const tower = craftMythic(game, id);
    if (tower) {
      ui.mythicOpen = false;
      renderer.celebrate('mythic', tower);
      afterAction('mythic');
    }
  },
  onCallWave: () => { if (game) callNextWave(game); },
  onSpeed: () => { ui.speed = SPEEDS[(SPEEDS.indexOf(ui.speed) + 1) % SPEEDS.length]; },
  onPause: togglePause,
  onMenu: goMenu,
  onSell: () => {
    if (game && selectedTower && sellTower(game, selectedTower.id)) afterAction('sell');
    selectTower(null);
  },
  onCloseInfo: () => selectTower(null),
  onRetry: () => startMap(mapId),
  onStartMap: (id) => {
    // 이어할 게임이 있으면 지워도 되는지 한 번 묻는다
    if (run && !window.confirm('진행 중인 게임이 있어요. 새로 시작하면 지워져요. 새로 시작할까요?')) return;
    startMap(id);
  },
  onContinue: continueRun,
  onSound: () => toggleSound('sfx'),
  onMusic: () => toggleSound('music'),
});

function toggleSound(key) {
  ui[key] = !ui[key];
  sound.setSettings(ui);
  saveSoundSettings(store, ui);
  sound.unlock();
}

// 소환·합성·강화 같은 행동 뒤: 효과음을 내고, 웨이브 사이라면 바로 저장한다
function afterAction(soundName) {
  if (soundName) sound.play(soundName);
  autosave();
}

function autosave() {
  if (!game || !isBetweenWaves(game)) return;
  if (game.waveNumber === 0 && game.towers.length === 0) return; // 아무것도 안 한 새 게임은 저장하지 않는다
  run = snapshotGame(game);
  writeRun(store, run);
}

function menuRunInfo() {
  if (!run) return null;
  const map = MAPS.find((m) => m.id === run.mapId);
  return map ? { name: map.name, place: map.place, wave: run.waveNumber } : null;
}

function summon() {
  const tower = game && summonTower(game);
  if (tower) {
    renderer.celebrate('summon', tower);
    afterAction('summon');
  }
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
  boardRect: () => renderer.boardRect(),
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
      if (target && mergeTowers(game, drag.towerId, target.id)) {
        renderer.celebrate('merge', target);
        afterAction(target.level >= 3 ? 'awaken' : 'merge');
      }
    }
    drag = null;
  },
});

function startMap(id) {
  const map = MAPS.find((m) => m.id === id);
  if (!map || MAPS.indexOf(map) >= save.unlocked) return;
  run = null;
  clearRun(store);
  enterGame(createGame(map));
}

function continueRun() {
  const restored = run && restoreGame(run);
  if (!restored) {
    run = null;
    clearRun(store);
    hud.showMenu(save, null);
    return;
  }
  enterGame(restored);
}

function enterGame(g) {
  mapId = g.map.id;
  game = g;
  lastBossWarning = 0;
  finished = false;
  ui.paused = false;
  ui.speed = 1;
  ui.mythicOpen = false;
  autoPaused = false;
  drag = null;
  selectTower(null);
  hud.showGame();
  renderer.resize();
  lastTs = performance.now();
}

function goMenu() {
  autosave();
  game = null;
  mapId = null;
  drag = null;
  selectTower(null);
  sound.setMusic(false);
  hud.showMenu(save, menuRunInfo());
}

function finish() {
  finished = true;
  const won = game.status === 'won';
  // 끝난 게임은 이어할 수 없다
  run = null;
  clearRun(store);
  sound.play(won ? 'win' : 'lose');
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
    if (!ui.paused && !ui.mythicOpen && game.status === 'running') {
      step(game, dt * ui.speed);
      sound.playEvents(game.events);
      if (game.events.some((e) => e.type === 'waveClear')) autosave();
    }
    // 보스 경고가 막 시작되면 불길한 울림
    if (game.bossWarning > 0 && lastBossWarning === 0) sound.play('bossWarning');
    lastBossWarning = game.bossWarning;
    sound.setMusic(game.status === 'running' && !ui.paused);
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
    hud.update(game, ui, ui.mythicOpen);
    if (game.status !== 'running') ui.mythicOpen = false;
    if (game.status !== 'running' && !finished) finish();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (!game || e.repeat) return;
  if (game.cardChoices && ['1', '2', '3'].includes(e.key)) chooseCard(game, game.cardChoices[Number(e.key) - 1]);
  else if (e.key === 's' || e.key === 'S') summon();
  else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.key === 'Escape') { selectTower(null); ui.mythicOpen = false; }
  else if (e.key === 'm' || e.key === 'M') ui.mythicOpen = !ui.mythicOpen && game.status === 'running';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    autosave();
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
new ResizeObserver(() => renderer.resize()).observe(document.getElementById('stage'));

// 브라우저는 화면을 누르기 전에는 소리를 막으므로, 처음 누르거나 키를 칠 때 소리를 켠다
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => sound.unlock());

hud.showSaveWarning(!writeSave(store, save));
hud.showMenu(save, menuRunInfo());
requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(frame); });
