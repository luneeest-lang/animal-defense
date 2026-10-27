import { MAPS } from '../data/maps.js';
import { TOWERS, STAGE_NAMES } from '../data/towers.js';
import { WAVE_COUNT } from '../core/waves.js';
import { CONFIG, summonCost, emptyCells, upgradeCost, effectiveStats } from '../core/game.js';
import { CARDS } from '../data/cards.js';
import { bakeAnimals } from './pixel.js';

const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

export function createHud(root, handlers) {
  const $ = (id) => root.querySelector(`#${id}`);
  const el = {
    menu: $('screen-menu'), game: $('screen-game'), maps: $('map-list'), warning: $('save-warning'),
    lives: $('stat-lives'), gold: $('stat-gold'), wave: $('stat-wave'),
    btnWave: $('btn-wave'), btnSpeed: $('btn-speed'), btnPause: $('btn-pause'), btnMenu: $('btn-menu'),
    pauseLabel: $('pause-label'), bossBanner: $('boss-banner'), panel: $('panel'),
    cardPick: $('card-pick'), cardList: $('card-list'),
    info: $('tower-info'), infoTitle: $('ti-title'), infoStats: $('ti-stats'),
    btnSell: $('btn-sell'), btnCloseInfo: $('btn-close-info'),
    result: $('result'), resultTitle: $('result-title'), resultStars: $('result-stars'),
    resultDetail: $('result-detail'), btnRetry: $('btn-retry'), btnResultMenu: $('btn-result-menu'),
  };
  let shownTower = null;
  let lastLives = null;
  let lastGold = null;

  // 같은 애니메이션을 연달아 다시 재생할 수 있도록 클래스를 뺐다가 다시 넣는다
  const replay = (node, cls) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };
  const icons = bakeAnimals();

  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  // 패널: 소환 버튼과, 무엇이 나올 수 있는지 보여주는 동물 안내
  const summon = document.createElement('button');
  summon.type = 'button';
  summon.id = 'btn-summon';
  summon.className = 'summon-btn';
  summon.innerHTML = '<span class="label">🎲 소환</span><span class="cost"></span>';
  summon.addEventListener('click', () => handlers.onSummon());
  const summonCostEl = summon.querySelector('.cost');
  // 동물별 강화 버튼: 누르면 그 동물 전체가 강해진다
  const upgrades = document.createElement('div');
  upgrades.className = 'upgrades';
  const upgradeButtons = {};
  for (const [id, def] of Object.entries(TOWERS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'upgrade-btn';
    b.dataset.type = id;
    b.title = `${def.name} 강화`;
    b.innerHTML = `<span class="icon" style="background-image:url(${icons[id][2].toDataURL()})"></span>`
      + `<span class="up-text"><span class="up-name">${def.name}</span><span class="up-level"></span><span class="up-cost"></span></span>`;
    b.addEventListener('click', () => handlers.onUpgradeAnimal(id));
    upgrades.appendChild(b);
    upgradeButtons[id] = { button: b, level: b.querySelector('.up-level'), cost: b.querySelector('.up-cost') };
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  const HINT = '같은 동물·같은 단계를 끌어다 겹치면 무작위 동물로 성장해요';
  hint.textContent = HINT;
  el.panel.append(summon, upgrades, hint);
  let shownChoices = '';
  let shownTaken = '';

  // 웨이브 사이 카드 3장. 같은 카드가 계속 나와 있으면 다시 만들지 않는다
  function renderCards(game) {
    const key = game.cardChoices ? game.cardChoices.join(',') : '';
    el.cardPick.hidden = !key;
    if (key === shownChoices) return;
    shownChoices = key;
    el.cardList.replaceChildren(...(game.cardChoices ?? []).map((id, i) => {
      const card = CARDS[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.dataset.card = id;
      b.innerHTML = `<span class="card-key">${i + 1}</span><span class="card-icon">${card.icon}</span>`
        + `<span class="card-name">${card.name}</span><span class="card-desc">${card.desc}</span>`;
      b.addEventListener('click', () => handlers.onPickCard(id));
      return b;
    }));
  }

  // 고른 카드는 패널 아래 안내 문구 자리에 아이콘과 개수로 보여준다
  function renderTaken(game) {
    const counts = {};
    for (const id of game.cardsTaken) counts[id] = (counts[id] ?? 0) + 1;
    const text = Object.entries(counts).map(([id, n]) => `${CARDS[id].icon}${n > 1 ? `×${n}` : ''}`).join(' ');
    if (text === shownTaken) return;
    shownTaken = text;
    hint.textContent = text ? `카드: ${text}` : HINT;
    hint.title = Object.keys(counts).map((id) => CARDS[id].name).join(', ');
  }

  el.btnWave.addEventListener('click', () => handlers.onCallWave());
  el.btnSpeed.addEventListener('click', () => handlers.onSpeed());
  el.btnPause.addEventListener('click', () => handlers.onPause());
  el.btnMenu.addEventListener('click', () => handlers.onMenu());
  el.btnSell.addEventListener('click', () => handlers.onSell());
  el.btnCloseInfo.addEventListener('click', () => handlers.onCloseInfo());
  el.btnRetry.addEventListener('click', () => handlers.onRetry());
  el.btnResultMenu.addEventListener('click', () => handlers.onMenu());

  function statsLine(game, tower) {
    const s = effectiveStats(game, tower);
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
    setText(el.infoTitle, `${TOWERS[shownTower.type].name} · ${STAGE_NAMES[shownTower.level]}`);
    setText(el.infoStats, statsLine(game, shownTower));
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
        b.innerHTML = `<span><div class="name">${locked ? '🔒 ' : ''}${map.name} · ${map.place}</div>`
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
      lastLives = null;
      lastGold = null;
      shownChoices = '';
      shownTaken = null;
      el.info.hidden = true;
    },
    showSaveWarning(on) { el.warning.hidden = !on; },
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
      const gold = Math.floor(game.gold);
      if (lastLives !== null && game.lives < lastLives) replay(el.lives, 'hurt');
      if (lastGold !== null && gold > lastGold) replay(el.gold, 'gain');
      lastLives = game.lives;
      lastGold = gold;
      setText(el.lives, `❤️ ${game.lives}`);
      setText(el.gold, `🪙 ${gold}`);
      setText(el.wave, `웨이브 ${game.waveNumber}/${WAVE_COUNT}`);
      const running = game.status === 'running';
      if (game.countdown !== null && running && !game.cardChoices) {
        const left = Math.ceil(game.countdown);
        setText(el.btnWave, `⏭ 바로 시작 ${left}초 +${left}🪙`);
        el.btnWave.disabled = false;
      } else {
        const label = game.cardChoices ? '카드를 골라 주세요'
          : game.waveNumber >= game.waves.length ? '마지막 웨이브' : `웨이브 ${game.waveNumber} 진행 중`;
        setText(el.btnWave, label);
        el.btnWave.disabled = true;
      }
      setText(el.btnSpeed, `${ui.speed}x`);
      setText(el.btnPause, ui.paused ? '▶' : '⏸');
      el.pauseLabel.hidden = !ui.paused || !!game.cardChoices;
      renderCards(game);
      renderTaken(game);
      // 보스 경고는 남은 시간 동안 보이고, 끝나기 직전에 서서히 사라진다
      el.bossBanner.hidden = !(running && game.bossWarning > 0);
      el.bossBanner.classList.toggle('leaving', game.bossWarning > 0 && game.bossWarning < 0.4);
      const cost = summonCost(game);
      setText(summonCostEl, `🪙 ${cost}`);
      summon.disabled = !running || cost > game.gold || emptyCells(game).length === 0;
      for (const [id, ui2] of Object.entries(upgradeButtons)) {
        const next = upgradeCost(game, id);
        setText(ui2.level, `Lv.${game.upgrades[id]}`);
        setText(ui2.cost, next === null ? 'MAX' : `🪙${next}`);
        ui2.button.disabled = !running || next === null || next > game.gold;
      }
      refreshInfo(game);
    },
  };
}
