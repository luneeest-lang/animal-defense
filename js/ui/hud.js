import { MAPS } from '../data/maps.js';
import { TOWERS } from '../data/towers.js';
import { WAVE_COUNT } from '../core/waves.js';
import { CONFIG, summonCost, emptyCells, upgradeCost, effectiveStats } from '../core/game.js';
import { CARDS } from '../data/cards.js';
import { ENEMIES } from '../data/enemies.js';
import { bakeAnimals, bakeMythics } from './pixel.js';
import { MYTHICS, gradeOf } from '../data/mythics.js';
import { findMaterials, canCraft, RECIPE_LEVELS } from '../core/mythics.js';
import {
  t, lang, towerName, mythicName, mythicDesc, unitName, enemyName, bossSkill, mapName, mapPlace, cardName, cardDesc,
  stageName, gradeName, missionLabel,
} from '../i18n.js';
import { DEX_IDS, DEX_MAX, DEX_BONUS, dexProgress } from '../core/dex.js';

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
    resultDetail: $('result-detail'), resultStats: $('result-stats'), resultRewards: $('result-rewards'),
    btnDex: $('btn-dex'), dex: $('dex'), dexList: $('dex-list'), btnCloseDex: $('btn-close-dex'), btnRetry: $('btn-retry'), btnResultMenu: $('btn-result-menu'),
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
  summon.innerHTML = `<span class="label">${t('hud.summon')}</span><span class="cost"></span>`;
  summon.addEventListener('click', () => handlers.onSummon());
  const summonCostEl = summon.querySelector('.cost');
  // 신화 조합 버튼: 만들 수 있는 신화가 있으면 반짝인다
  const mythicBtn = document.createElement('button');
  mythicBtn.type = 'button';
  mythicBtn.id = 'btn-mythic';
  mythicBtn.className = 'mythic-btn';
  mythicBtn.textContent = t('hud.mythic');
  mythicBtn.addEventListener('click', () => handlers.onOpenMythic());
  const leftCol = document.createElement('div');
  leftCol.className = 'panel-left';
  leftCol.append(summon, mythicBtn);
  const mythicIcons = bakeMythics();
  // 동물별 강화 버튼: 누르면 그 동물 전체가 강해진다
  const upgrades = document.createElement('div');
  upgrades.className = 'upgrades';
  const upgradeButtons = {};
  for (const id of Object.keys(TOWERS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'upgrade-btn';
    b.dataset.type = id;
    b.title = t('hud.upgrade', { name: towerName(id) });
    b.innerHTML = `<span class="icon" style="background-image:url(${icons[id][2].toDataURL()})"></span>`
      + `<span class="up-text"><span class="up-name">${towerName(id)}</span><span class="up-level"></span><span class="up-cost"></span></span>`;
    b.addEventListener('click', () => handlers.onUpgradeAnimal(id));
    upgrades.appendChild(b);
    upgradeButtons[id] = { button: b, level: b.querySelector('.up-level'), cost: b.querySelector('.up-cost') };
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  const HINT = t('hud.hint');
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
        + `<span class="card-name">${cardName(id)}</span><span class="card-desc">${cardDesc(id)}</span>`;
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
    hint.textContent = text ? t('hud.cardsTaken', { list: text }) : HINT;
    hint.title = Object.keys(counts).map(cardName).join(', ');
  }

  // 신화 조합표: 신화마다 재료 칸(있으면 ✔)과 만들기 버튼
  const mythicRows = {};
  for (const [id, def] of Object.entries(MYTHICS)) {
    const row = document.createElement('div');
    row.className = 'mythic-row';
    row.dataset.mythic = id;
    const mats = def.recipe.map((type, i) => {
      const stage = stageName(RECIPE_LEVELS[i]);
      return `<span class="mat" data-slot="${i}"><span class="icon" style="background-image:url(${icons[type][2].toDataURL()})"></span>`
        + `<span class="mat-name">${t('mythic.material', { stage, animal: towerName(type) })}</span><span class="mat-ok"></span></span>`;
    }).join('<span class="plus">+</span>');
    row.innerHTML = `<span class="m-icon" style="background-image:url(${mythicIcons[id].toDataURL()})"></span>`
      + `<span class="m-body"><span class="m-name">${def.icon} ${mythicName(id)}</span><span class="m-desc">${mythicDesc(id)}</span>`
      + `<span class="mats">${mats}</span></span><button type="button" class="btn primary m-make">${t('mythic.make')}</button>`;
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
      [main, ...subs].forEach((tw, i) => {
        r.oks[i].classList.toggle('have', !!tw);
        setText(r.oks[i].querySelector('.mat-ok'), tw ? '✔' : '✖');
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
    r.gold && `🪙${r.gold}`, r.lives && `❤️+${r.lives}`, r.summons && t('mission.summons', { n: r.summons }), r.upgrade && t('mission.upgrade'),
  ].filter(Boolean).join(' ');
  function renderMission(game) {
    const m = game.mission;
    el.mission.hidden = !m || game.status !== 'running';
    if (!m) return;
    setText(missionGoal, `🎯 ${missionLabel(m)}`);
    const left = Math.max(1, m.deadline - Math.max(1, game.waveNumber) + 1);
    setText(missionMeta, t('mission.reward', { reward: rewardText(m.reward), left }));
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
      t('stat.damage', { value: Math.round(s.damage * 10) / 10 }),
      s.range ? t('stat.range', { value: s.range.toFixed(1) }) : t('stat.rangeAll'),
      t('stat.speed', { value: (1 / s.cooldown).toFixed(1) }),
    ];
    if (s.splash) parts.push(t('stat.splash', { value: s.splash.toFixed(1) }));
    if (s.shots) parts.push(t('stat.shots', { value: s.shots }));
    if (s.burnDps) parts.push(t('stat.burn', { value: Math.round(s.burnDps) }));
    if (s.slowFactor) parts.push(t('stat.slow', { value: Math.round((1 - s.slowFactor) * 100) }));
    if (s.poisonDps) parts.push(t('stat.poison', { value: Math.round(s.poisonDps * 10) / 10 }));
    if (s.bossMult) parts.push(t('stat.boss', { value: s.bossMult }));
    return parts.join(' · ');
  }

  function refreshInfo(game) {
    if (!shownTower || !game.towers.includes(shownTower)) {
      shownTower = null;
      el.info.hidden = true;
      return;
    }
    el.info.hidden = false;
    const tw = shownTower;
    setText(el.infoTitle, tw.mythic
      ? t('info.mythic', { icon: MYTHICS[tw.type].icon, name: mythicName(tw.type) })
      : t('info.animal', { name: towerName(tw.type), stage: stageName(tw.level), grade: gradeName(gradeOf(tw)) }));
    setText(el.infoStats, tw.mythic ? `${mythicDesc(tw.type)}. ${statsLine(game, tw)}` : statsLine(game, tw));
    setText(el.btnSell, t('info.sell', { gold: Math.floor(tw.invested * CONFIG.sellRate + 1e-9) }));
  }

  const nameOf = unitName;
  const iconOf = (id) => MYTHICS[id]?.icon ?? TOWERS[id].emoji;
  // 도감 그림: 동물은 성체, 신화는 신화 그림
  function dexArt(id, size) {
    const src = MYTHICS[id] ? bakeMythics()[id] : bakeAnimals()[id][2];
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, size, size);
    return c;
  }

  // 메뉴의 도감 창: 동물 5종과 신화 5종의 레벨, 다음 레벨까지 모은 장수, 지금 피해 보너스
  let dexCollection = {};
  function renderDex() {
    el.dexList.replaceChildren(...DEX_IDS.map((id) => {
      const count = dexCollection[id] ?? 0;
      const { level, have, need } = dexProgress(id, count);
      const row = document.createElement('div');
      row.className = `dex-row${MYTHICS[id] ? ' mythic' : ''}${count ? '' : ' unseen'}`;
      const art = dexArt(id, 44);
      art.className = 'dex-art';
      const info = document.createElement('div');
      info.className = 'dex-info';
      const max = level >= DEX_MAX;
      info.innerHTML = `<div class="dex-name">${nameOf(id)}${MYTHICS[id] ? ` <small>${t('dex.mythicTag')}</small>` : ''}<b class="dex-lv">${max ? 'MAX' : `Lv.${level}`}</b></div>`
        + `<div class="dex-bar"><span style="width:${max ? 100 : (have / need) * 100}%"></span></div>`
        + `<div class="dex-sub">${max ? t('dex.maxLevel') : t('dex.next', { have, need })} · ${t('dex.bonus', { pct: Math.round(level * DEX_BONUS * 100) })} · ${t('dex.count', { count })}</div>`;
      row.append(art, info);
      return row;
    }));
  }
  el.btnDex.addEventListener('click', () => { renderDex(); el.dex.hidden = false; });
  el.btnCloseDex.addEventListener('click', () => { el.dex.hidden = true; });
  el.dex.addEventListener('click', (e) => { if (e.target === el.dex) el.dex.hidden = true; });

  // 결과 화면의 클리어 보상: 받은 카드와 오른 도감 레벨
  function renderRewards(rewards) {
    el.resultRewards.replaceChildren();
    el.resultRewards.hidden = !rewards;
    if (!rewards) return;
    const title = document.createElement('div');
    title.className = 'rs-title';
    title.textContent = t('result.rewards');
    const cards = document.createElement('div');
    cards.className = 'rw-cards';
    const order = Object.keys(rewards.cards).sort((a, b) => (MYTHICS[b] ? 1 : 0) - (MYTHICS[a] ? 1 : 0) || rewards.cards[b] - rewards.cards[a]);
    for (const id of order) {
      const chip = document.createElement('span');
      chip.className = `rw-card${MYTHICS[id] ? ' mythic' : ''}`;
      chip.title = nameOf(id);
      chip.innerHTML = `${iconOf(id)}<b>×${rewards.cards[id]}</b>`;
      cards.append(chip);
    }
    el.resultRewards.append(title, cards);
    // 오른 도감 레벨: '📖 레벨 업  🦅 2→4  🐧 0→3' 처럼 한 줄로
    if (rewards.levelUps.length) {
      const ups = document.createElement('div');
      ups.className = 'rw-ups';
      ups.innerHTML = `<span class="rw-label">${t('result.levelUp')}</span>`;
      for (const up of rewards.levelUps) {
        const chip = document.createElement('span');
        chip.className = 'rw-up';
        chip.title = `${nameOf(up.id)} ${t('dex.bonus', { pct: Math.round(up.to * DEX_BONUS * 100) })}`;
        chip.textContent = `${iconOf(up.id)} ${up.from}→${up.to}`;
        ups.append(chip);
      }
      el.resultRewards.append(ups);
    }
  }

  // 큰 숫자는 '1.2만'(영어는 '12.3K')처럼 줄인다
  const short = (n) => (lang() === 'ko'
    ? (n >= 1e8 ? `${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}만` : String(Math.round(n)))
    : (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n))));
  // 결과 화면 통계: 요약 한 줄과 피해량 순위(많은 순서 5종, 막대는 1등 대비 길이)
  function renderStats(stats) {
    el.resultStats.replaceChildren();
    el.resultStats.hidden = !stats;
    if (!stats) return;
    const summary = document.createElement('div');
    summary.className = 'rs-summary';
    for (const [icon, label, value] of [['⚔️', t('result.kills'), stats.kills], ['💔', t('result.leaked'), stats.leaked], ['⏱️', t('result.time'), stats.time]]) {
      const chip = document.createElement('span');
      chip.className = 'rs-chip';
      chip.innerHTML = `<span class="rs-label">${icon} ${label}</span><b>${value}</b>`;
      summary.append(chip);
    }
    el.resultStats.append(summary);
    if (!stats.ranking.length) return;
    const title = document.createElement('div');
    title.className = 'rs-title';
    title.textContent = t('result.ranking');
    el.resultStats.append(title);
    const top = stats.ranking[0].damage;
    const rows = document.createElement('div');
    rows.className = 'rs-rows';
    el.resultStats.append(rows);
    stats.ranking.slice(0, 5).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = `rs-row${r.mythic ? ' mythic' : ''}`;
      row.innerHTML = `<span class="rs-rank">${i + 1}</span><span class="rs-icon">${r.icon}</span>`
        + `<span class="rs-main"><span class="rs-name">${nameOf(r.id)}${r.mythic ? ' ✨' : ''}<small>${t('result.killCount', { kills: r.kills })}</small></span>`
        + `<span class="rs-bar"><span style="width:${Math.max(3, (r.damage / top) * 100)}%"></span></span></span>`
        + `<span class="rs-val">${short(r.damage)}<small>${Math.round(r.share * 100)}%</small></span>`;
      rows.append(row);
    });
  }

  return {
    // run: 이어할 게임 { name, place, wave } (없으면 null)
    showMenu(save, run = null) {
      dexCollection = save.collection ?? {};
      const total = DEX_IDS.reduce((s, id) => s + dexProgress(id, dexCollection[id] ?? 0).level, 0);
      el.btnDex.innerHTML = `<span>${t('dex.button')}</span><small>${t('dex.total', { total, max: DEX_IDS.length * DEX_MAX })}</small>`;
      el.dex.hidden = true;
      el.game.hidden = true;
      el.result.hidden = true;
      el.menu.hidden = false;
      el.btnContinue.hidden = !run;
      if (run) {
        const vars = { name: mapName(run.mapId), place: mapPlace(run.mapId), wave: run.wave, max: WAVE_COUNT };
        el.btnContinue.innerHTML = `<span class="c-title">${t('menu.continue')}</span><span class="c-sub">${t(run.endless ? 'menu.runEndless' : 'menu.runNormal', vars)}</span>`;
      }
      el.maps.replaceChildren(...MAPS.map((map, i) => {
        const locked = i >= save.unlocked;
        const rec = save.records[map.id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-card';
        b.disabled = locked;
        b.innerHTML = `<span><div class="name">${locked ? '🔒 ' : ''}${mapName(map.id)} · ${mapPlace(map.id)}</div>`
          + `<div class="sub">${locked ? t('menu.locked') : rec ? t('menu.best', { wave: rec.bestWave, max: WAVE_COUNT }) : t('menu.new')}</div></span>`
          + `<span class="stars">${locked ? '' : stars(rec ? rec.stars : 0)}</span>`;
        b.addEventListener('click', () => handlers.onStartMap(map.id));
        // 무한 모드: 그 맵을 30웨이브까지 한 번 깨면(별이 있으면) 카드 옆에 버튼이 생긴다
        if (locked || !rec || !rec.stars) return b;
        const row = document.createElement('div');
        row.className = 'map-row';
        const e = document.createElement('button');
        e.type = 'button';
        e.className = 'endless-btn';
        e.dataset.map = map.id;
        e.innerHTML = `<span class="e-title">${t('menu.endless')}</span><span class="e-sub">${rec.endlessBest ? t('menu.endlessBest', { best: rec.endlessBest }) : t('menu.endlessNew')}</span>`;
        e.addEventListener('click', () => handlers.onStartEndless(map.id));
        row.append(b, e);
        return row;
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
    // endless: 무한 모드 결과 { best: 최고 기록, newBest: 이번에 기록을 넘었는지 }
    // stats: core/stats.js의 resultStats (처치·놓침·시간 요약과 동물별 피해량 순위)
    // rewards: 보통 판을 깼을 때 받은 카드 { cards: { id: 장수 }, levelUps: [{ id, from, to }] }
    showResult({ won, wave, lives, starCount, endless = null, stats = null, rewards = null }) {
      renderStats(stats);
      renderRewards(rewards);
      if (endless) {
        setText(el.resultTitle, t(endless.newBest ? 'result.newBest' : 'result.endlessOver'));
        setText(el.resultStars, '');
        setText(el.resultDetail, t('result.endlessDetail', { wave, best: endless.best }));
        el.result.hidden = false;
        return;
      }
      setText(el.resultTitle, t(won ? 'result.win' : 'result.lose'));
      setText(el.resultStars, won ? stars(starCount) : '');
      setText(el.resultDetail, won ? t('result.livesLeft', { lives }) : wave > 0 ? t('result.reached', { wave, max: WAVE_COUNT }) : t('result.firstWave'));
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
      // 좁은 휴대폰에서도 잘리지 않게 글자 대신 깃발 아이콘으로 줄인다 (읽는 사람에게는 aria-label로 '웨이브'를 알린다)
      setText(el.wave, game.endless ? `♾️ ${game.waveNumber}` : `🚩 ${game.waveNumber}/${WAVE_COUNT}`);
      const running = game.status === 'running';
      if (game.countdown !== null && running && !game.cardChoices) {
        const left = Math.ceil(game.countdown);
        setText(el.btnWave, t('hud.skip', { left }));
        el.btnWave.disabled = false;
      } else {
        const label = game.cardChoices ? t('hud.pickCard')
          : game.waveNumber >= game.waves.length ? t('hud.lastWave') : t('hud.waveRunning', { wave: game.waveNumber });
        setText(el.btnWave, label);
        el.btnWave.disabled = true;
      }
      setText(el.btnSpeed, `${ui.speed}x`);
      // 꺼진 소리 버튼은 흐려지고 빨간 사선이 그어진다
      setText(el.btnSound, ui.sfx ? '🔊' : '🔇');
      el.btnSound.classList.toggle('off', !ui.sfx);
      el.btnSound.title = t(ui.sfx ? 'hud.sfxOff' : 'hud.sfxOn');
      el.btnMusic.classList.toggle('off', !ui.music);
      el.btnMusic.title = t(ui.music ? 'hud.musicOff' : 'hud.musicOn');
      setText(el.btnPause, ui.paused ? '▶' : '⏸');
      el.pauseLabel.hidden = !ui.paused || !!game.cardChoices;
      renderCards(game);
      renderMission(game);
      renderMythics(game, mythicOpen && !game.cardChoices);
      renderTaken(game);
      // 보스 경고는 남은 시간 동안 보이고, 끝나기 직전에 서서히 사라진다
      el.bossBanner.hidden = !(running && game.bossWarning > 0);
      if (game.bossWarningType) {
        const type = game.bossWarningType;
        setText(el.bossSub, t('boss.coming', { name: enemyName(type) }));
        el.bossSkill.hidden = !game.map.bossAbilities;
        if (ENEMIES[type].skill) setText(el.bossSkill, t('boss.skill', { skill: bossSkill(type) }));
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
