import { MAPS } from '../data/maps.js';
import { TOWERS, STAGE_NAMES } from '../data/towers.js';
import { WAVE_COUNT } from '../core/waves.js';
import { CONFIG, summonCost, emptyCells, upgradeCost, effectiveStats } from '../core/game.js';
import { CARDS } from '../data/cards.js';
import { ENEMIES } from '../data/enemies.js';
import { bakeAnimals, bakeMythics } from './pixel.js';
import { MYTHICS, GRADE_NAMES, gradeOf } from '../data/mythics.js';
import { findMaterials, canCraft, RECIPE_LEVELS } from '../core/mythics.js';
import { missionText } from '../core/missions.js';

// 이름 끝 글자에 받침이 있으면 '이', 없으면 '가'
const subjectParticle = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '이' : '가';
};

const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

export function createHud(root, handlers) {
  const $ = (id) => root.querySelector(`#${id}`);
  const el = {
    menu: $('screen-menu'), game: $('screen-game'), maps: $('map-list'), warning: $('save-warning'),
    lives: $('stat-lives'), gold: $('stat-gold'), wave: $('stat-wave'),
    btnContinue: $('btn-continue'), btnSound: $('btn-sound'), btnMusic: $('btn-music'),
    btnWave: $('btn-wave'), btnSpeed: $('btn-speed'), btnPause: $('btn-pause'), btnMenu: $('btn-menu'),
    pauseLabel: $('pause-label'), bossBanner: $('boss-banner'), panel: $('panel'),
    cardPick: $('card-pick'), cardList: $('card-list'), mission: $('mission'),
    mythicPick: $('mythic-pick'), mythicList: $('mythic-list'), btnCloseMythic: $('btn-close-mythic'),
    bossSub: root.querySelector('.boss-sub'), bossSkill: root.querySelector('.boss-skill'),
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
  // 신화 조합 버튼: 만들 수 있는 신화가 있으면 반짝인다
  const mythicBtn = document.createElement('button');
  mythicBtn.type = 'button';
  mythicBtn.id = 'btn-mythic';
  mythicBtn.className = 'mythic-btn';
  mythicBtn.textContent = '✨ 신화';
  mythicBtn.addEventListener('click', () => handlers.onOpenMythic());
  const leftCol = document.createElement('div');
  leftCol.className = 'panel-left';
  leftCol.append(summon, mythicBtn);
  const mythicIcons = bakeMythics();
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
  el.panel.append(leftCol, upgrades, hint);
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

  // 신화 조합표: 신화마다 재료 칸(있으면 ✔)과 만들기 버튼
  const mythicRows = {};
  for (const [id, def] of Object.entries(MYTHICS)) {
    const row = document.createElement('div');
    row.className = 'mythic-row';
    row.dataset.mythic = id;
    const mats = def.recipe.map((type, i) => {
      const stage = RECIPE_LEVELS[i] === 3 ? '각성' : '성체';
      return `<span class="mat" data-slot="${i}"><span class="icon" style="background-image:url(${icons[type][2].toDataURL()})"></span>`
        + `<span class="mat-name">${stage} ${TOWERS[type].name}</span><span class="mat-ok"></span></span>`;
    }).join('<span class="plus">+</span>');
    row.innerHTML = `<span class="m-icon" style="background-image:url(${mythicIcons[id].toDataURL()})"></span>`
      + `<span class="m-body"><span class="m-name">${def.icon} ${def.name}</span><span class="m-desc">${def.desc}</span>`
      + `<span class="mats">${mats}</span></span><button type="button" class="btn primary m-make">만들기</button>`;
    row.querySelector('.m-make').addEventListener('click', () => handlers.onCraft(id));
    el.mythicList.appendChild(row);
    mythicRows[id] = { make: row.querySelector('.m-make'), oks: [...row.querySelectorAll('.mat')] };
  }
  el.btnCloseMythic.addEventListener('click', () => handlers.onCloseMythic());

  function renderMythics(game, open) {
    el.mythicPick.hidden = !open;
    let any = false;
    for (const [id, r] of Object.entries(mythicRows)) {
      const ok = canCraft(game, id);
      any ||= ok;
      if (!open) continue;
      const { main, subs } = findMaterials(game, id);
      [main, ...subs].forEach((t, i) => {
        r.oks[i].classList.toggle('have', !!t);
        setText(r.oks[i].querySelector('.mat-ok'), t ? '✔' : '✖');
      });
      r.make.disabled = !ok;
    }
    mythicBtn.classList.toggle('ready', any);
    mythicBtn.disabled = game.status !== 'running';
  }

  // 진행 중인 미션: 맵 위쪽 띠에 목표·진행·보상·남은 웨이브
  const missionGoal = el.mission.querySelector('.m-goal');
  const missionMeta = el.mission.querySelector('.m-meta');
  const rewardText = (r) => [
    r.gold && `🪙${r.gold}`, r.lives && `❤️+${r.lives}`, r.summons && `무료 소환 ${r.summons}`, r.upgrade && '강화 1단계',
  ].filter(Boolean).join(' ');
  function renderMission(game) {
    const m = game.mission;
    el.mission.hidden = !m || game.status !== 'running';
    if (!m) return;
    setText(missionGoal, `🎯 ${missionText(m)}`);
    const left = Math.max(1, m.deadline - Math.max(1, game.waveNumber) + 1);
    setText(missionMeta, `보상 ${rewardText(m.reward)} · 남은 웨이브 ${left}`);
  }

  el.btnContinue.addEventListener('click', () => handlers.onContinue());
  el.btnSound.addEventListener('click', () => handlers.onSound());
  el.btnMusic.addEventListener('click', () => handlers.onMusic());
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
      s.range ? `사거리 ${s.range.toFixed(1)}` : '사거리 맵 전체',
      `속도 ${(1 / s.cooldown).toFixed(1)}/초`,
    ];
    if (s.splash) parts.push(`범위 ${s.splash.toFixed(1)}`);
    if (s.shots) parts.push(`여우불 ${s.shots}개`);
    if (s.burnDps) parts.push(`불길 ${Math.round(s.burnDps)}/초`);
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
    const t = shownTower;
    setText(el.infoTitle, t.mythic
      ? `${MYTHICS[t.type].icon} ${MYTHICS[t.type].name} · 신화`
      : `${TOWERS[t.type].name} · ${STAGE_NAMES[t.level]} (${GRADE_NAMES[gradeOf(t)]})`);
    setText(el.infoStats, t.mythic ? `${MYTHICS[t.type].desc}. ${statsLine(game, t)}` : statsLine(game, t));
    setText(el.btnSell, `판매 +${Math.floor(shownTower.invested * CONFIG.sellRate + 1e-9)}`);
  }

  return {
    // run: 이어할 게임 { name, place, wave } (없으면 null)
    showMenu(save, run = null) {
      el.game.hidden = true;
      el.result.hidden = true;
      el.menu.hidden = false;
      el.btnContinue.hidden = !run;
      if (run) el.btnContinue.innerHTML = `<span class="c-title">▶ 이어하기</span><span class="c-sub">${run.name} · ${run.place} · 웨이브 ${run.wave}/${WAVE_COUNT}</span>`;
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
    update(game, ui, mythicOpen = false) {
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
      // 꺼진 소리 버튼은 흐려지고 빨간 사선이 그어진다
      setText(el.btnSound, ui.sfx ? '🔊' : '🔇');
      el.btnSound.classList.toggle('off', !ui.sfx);
      el.btnSound.title = ui.sfx ? '효과음 끄기' : '효과음 켜기';
      el.btnMusic.classList.toggle('off', !ui.music);
      el.btnMusic.title = ui.music ? '배경음 끄기' : '배경음 켜기';
      setText(el.btnPause, ui.paused ? '▶' : '⏸');
      el.pauseLabel.hidden = !ui.paused || !!game.cardChoices;
      renderCards(game);
      renderMission(game);
      renderMythics(game, mythicOpen && !game.cardChoices);
      renderTaken(game);
      // 보스 경고는 남은 시간 동안 보이고, 끝나기 직전에 서서히 사라진다
      el.bossBanner.hidden = !(running && game.bossWarning > 0);
      if (game.bossWarningType) {
        const boss = ENEMIES[game.bossWarningType];
        setText(el.bossSub, `${boss.name}${subjectParticle(boss.name)} 다가온다…`);
        el.bossSkill.hidden = !game.map.bossAbilities;
        setText(el.bossSkill, `능력: ${boss.skill}`);
      }
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
