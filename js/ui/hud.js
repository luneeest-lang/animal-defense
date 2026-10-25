import { MAPS } from '../data/maps.js';
import { TOWERS } from '../data/towers.js';
import { towerStats, upgradeCost } from '../core/towers.js';
import { WAVE_COUNT } from '../core/waves.js';
import { CONFIG } from '../core/game.js';

const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

export function createHud(root, handlers) {
  const $ = (id) => root.querySelector(`#${id}`);
  const el = {
    menu: $('screen-menu'), game: $('screen-game'), maps: $('map-list'), warning: $('save-warning'),
    lives: $('stat-lives'), gold: $('stat-gold'), wave: $('stat-wave'),
    btnWave: $('btn-wave'), btnSpeed: $('btn-speed'), btnPause: $('btn-pause'), btnMenu: $('btn-menu'),
    pauseLabel: $('pause-label'), panel: $('panel'),
    info: $('tower-info'), infoTitle: $('ti-title'), infoStats: $('ti-stats'),
    btnUpgrade: $('btn-upgrade'), btnSell: $('btn-sell'), btnCloseInfo: $('btn-close-info'),
    result: $('result'), resultTitle: $('result-title'), resultStars: $('result-stars'),
    resultDetail: $('result-detail'), btnRetry: $('btn-retry'), btnResultMenu: $('btn-result-menu'),
  };
  let shownTower = null;
  const typeButtons = {};

  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  Object.entries(TOWERS).forEach(([id, def], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'animal-btn';
    b.dataset.type = id;
    b.innerHTML = `<span class="key">${i + 1}</span>`
      + `<span class="icon" style="background-image:url(assets/animals/${id}.svg)"></span>`
      + `<span class="text"><span class="name">${def.name}</span><span class="cost">🪙 ${def.cost}</span></span>`;
    b.addEventListener('click', () => handlers.onPickType(id));
    el.panel.appendChild(b);
    typeButtons[id] = b;
  });

  el.btnWave.addEventListener('click', () => handlers.onCallWave());
  el.btnSpeed.addEventListener('click', () => handlers.onSpeed());
  el.btnPause.addEventListener('click', () => handlers.onPause());
  el.btnMenu.addEventListener('click', () => handlers.onMenu());
  el.btnUpgrade.addEventListener('click', () => handlers.onUpgrade());
  el.btnSell.addEventListener('click', () => handlers.onSell());
  el.btnCloseInfo.addEventListener('click', () => handlers.onCloseInfo());
  el.btnRetry.addEventListener('click', () => handlers.onRetry());
  el.btnResultMenu.addEventListener('click', () => handlers.onMenu());

  function statsLine(tower) {
    const s = towerStats(tower.type, tower.level);
    const parts = [
      `공격력 ${Math.round(s.damage * 10) / 10}`,
      `사거리 ${s.range.toFixed(1)}`,
      `속도 ${(1 / s.cooldown).toFixed(1)}/초`,
    ];
    if (s.splash) parts.push(`범위 ${s.splash.toFixed(1)}`);
    if (s.slowFactor) parts.push(`감속 ${Math.round((1 - s.slowFactor) * 100)}%`);
    if (s.poisonDps) parts.push(`독 ${Math.round(s.poisonDps * 10) / 10}/초`);
    if (s.bossMult) parts.push(`보스 x${s.bossMult}`);
    return parts.join(' · ');
  }

  function refreshInfo(game) {
    if (!shownTower || !game.towers.includes(shownTower)) {
      shownTower = null;
      el.info.hidden = true;
      return;
    }
    el.info.hidden = false;
    setText(el.infoTitle, `${TOWERS[shownTower.type].name} Lv.${shownTower.level + 1}`);
    setText(el.infoStats, statsLine(shownTower));
    const cost = upgradeCost(shownTower.type, shownTower.level);
    setText(el.btnUpgrade, cost === null ? '최대 레벨' : `업그레이드 🪙 ${cost}`);
    el.btnUpgrade.disabled = cost === null || cost > game.gold;
    setText(el.btnSell, `판매 +${Math.floor(shownTower.invested * CONFIG.sellRate + 1e-9)}`);
  }

  return {
    showMenu(save) {
      el.game.hidden = true;
      el.result.hidden = true;
      el.menu.hidden = false;
      el.maps.replaceChildren(...MAPS.map((map, i) => {
        const locked = i >= save.unlocked;
        const rec = save.records[map.id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-card';
        b.disabled = locked;
        b.innerHTML = `<span><div class="name">${locked ? '🔒 ' : ''}${map.name}</div>`
          + `<div class="sub">${locked ? '이전 맵을 클리어하면 열려요' : rec ? `최고 웨이브 ${rec.bestWave}/${WAVE_COUNT}` : '아직 도전 전'}</div></span>`
          + `<span class="stars">${locked ? '' : stars(rec ? rec.stars : 0)}</span>`;
        b.addEventListener('click', () => handlers.onStartMap(map.id));
        return b;
      }));
    },
    showGame() {
      el.menu.hidden = true;
      el.game.hidden = false;
      el.result.hidden = true;
      shownTower = null;
      el.info.hidden = true;
    },
    showSaveWarning(on) { el.warning.hidden = !on; },
    setSelectedType(id) {
      for (const [type, b] of Object.entries(typeButtons)) b.classList.toggle('selected', type === id);
    },
    showTowerInfo(tower) {
      shownTower = tower;
      if (!tower) el.info.hidden = true;
    },
    showResult({ won, wave, lives, starCount }) {
      setText(el.resultTitle, won ? '🎉 승리!' : '💔 패배');
      setText(el.resultStars, won ? stars(starCount) : '');
      setText(el.resultDetail, won ? `남은 생명 ${lives}` : wave > 0 ? `웨이브 ${wave}/${WAVE_COUNT}까지 막았어요` : '첫 웨이브를 막지 못했어요');
      el.result.hidden = false;
    },
    hideResult() { el.result.hidden = true; },
    update(game, ui) {
      setText(el.lives, `❤️ ${game.lives}`);
      setText(el.gold, `🪙 ${Math.floor(game.gold)}`);
      setText(el.wave, `웨이브 ${game.waveNumber}/${WAVE_COUNT}`);
      const running = game.status === 'running';
      if (game.countdown !== null && running) {
        setText(el.btnWave, `▶ 다음 웨이브 (+${Math.ceil(game.countdown)}🪙)`);
        el.btnWave.disabled = false;
      } else {
        setText(el.btnWave, game.waveNumber >= game.waves.length ? '마지막 웨이브' : `웨이브 ${game.waveNumber} 진행 중`);
        el.btnWave.disabled = true;
      }
      setText(el.btnSpeed, `${ui.speed}x`);
      setText(el.btnPause, ui.paused ? '▶' : '⏸');
      el.pauseLabel.hidden = !ui.paused;
      for (const [id, b] of Object.entries(typeButtons)) b.classList.toggle('poor', TOWERS[id].cost > game.gold);
      refreshInfo(game);
    },
  };
}
