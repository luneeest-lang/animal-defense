// 화면 글자를 한국어·영어로 보여 준다. 휴대폰(브라우저) 언어가 한국어면 한국어, 아니면 영어가 기본이고
// 메뉴의 언어 버튼으로 바꾸면 그 선택을 저장한다(LANG_KEY).
// 동물·신화·몬스터·카드·맵·미션의 한국어 이름과 설명은 각 data 파일의 것을 그대로 쓰고, 영어는 이 파일에 있다.
import { TOWERS, STAGE_NAMES } from './data/towers.js';
import { MYTHICS, GRADE_NAMES } from './data/mythics.js';
import { ENEMIES } from './data/enemies.js';
import { CARDS, CARD_POWER } from './data/cards.js';
import { MAPS } from './data/maps.js';
import { MISSIONS } from './core/missions.js';

export const LANG_KEY = 'td-lang';

// saved: 저장해 둔 언어, langs: navigator.languages
export function pickLang(saved, langs = []) {
  if (saved === 'ko' || saved === 'en') return saved;
  return langs.some((l) => /^ko\b/i.test(String(l))) ? 'ko' : 'en';
}

let current = 'ko';
export const lang = () => current;
export function setLang(l) { current = l === 'en' ? 'en' : 'ko'; }

// 이름 끝 글자에 받침이 있으면 '이', 없으면 '가'
const particle = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '이' : '가';
};

// 화면 문장. 값은 글자 또는 (vars) => 글자
export const KO = {
  'title': '쪼꼬미 신수단 - 합쳐서 지키는 동물 디펜스',
  'meta.desc': '쪼꼬미 신수단: 귀여운 아기 동물을 합쳐 해태·기린·구미호 같은 신수로 키워 블랙홀을 지키는 무료 브라우저 디펜스 게임',
  'menu.title': '🐯 쪼꼬미 신수단',
  'menu.subtitle': '합쳐서 지키는 동물 디펜스',
  'menu.lead': '아기 동물을 합쳐 신수로 키우고, 블랙홀로 가는 몬스터를 막아 보세요.',
  'menu.hint': '가로 화면에서 하면 더 편해요.',
  'menu.saveWarning': '이 브라우저에서는 기록을 저장할 수 없어요. 게임은 그대로 할 수 있어요.',
  'menu.lang': '🌐 English',
  'menu.continue': '▶ 이어하기',
  'menu.runNormal': ({ name, place, wave, max }) => `${name} · ${place} · 웨이브 ${wave}/${max}`,
  'menu.runEndless': ({ name, place, wave }) => `${name} · ${place} · ♾️ 무한 웨이브 ${wave}`,
  'menu.locked': '이전 맵을 클리어하면 열려요',
  'menu.best': ({ wave, max }) => `최고 웨이브 ${wave}/${max}`,
  'menu.new': '아직 도전 전',
  'menu.endless': '♾️ 무한',
  'menu.endlessBest': ({ best }) => `최고 ${best}`,
  'menu.endlessNew': '도전!',
  'menu.confirmNew': '진행 중인 게임이 있어요. 새로 시작하면 지워져요. 새로 시작할까요?',
  'dex.button': '📖 도감',
  'dex.total': ({ total, max }) => `레벨 합계 ${total}/${max}`,
  'dex.title': '📖 도감',
  'dex.help': '보통 판 30웨이브를 깨면 카드를 받아요. 어려운 맵일수록, 별이 많을수록 많이 받고 신화 카드는 중급·고급에서만 나와요. 같은 카드를 모으면 도감 레벨이 오르고, 레벨마다 그 동물의 피해가 3%씩 영구히 올라요(최대 10레벨).',
  'dex.mythicTag': '신화',
  'dex.maxLevel': '최고 레벨',
  'dex.next': ({ have, need }) => `다음 레벨까지 ${have}/${need}장`,
  'dex.bonus': ({ pct }) => `피해 +${pct}%`,
  'dex.count': ({ count }) => `모은 카드 ${count}장`,
  'common.close': '닫기',
  'hud.wave': '웨이브',
  'hud.music': '배경음',
  'hud.sfx': '효과음',
  'hud.musicOff': '배경음 끄기',
  'hud.musicOn': '배경음 켜기',
  'hud.sfxOff': '효과음 끄기',
  'hud.sfxOn': '효과음 켜기',
  'hud.speed': '배속',
  'hud.pause': '일시정지',
  'hud.menu': '맵 선택',
  'hud.board': '게임 화면',
  'hud.panel': '동물 선택',
  'hud.nextWave': '▶ 다음 웨이브',
  'hud.skip': ({ left }) => `⏭ 바로 시작 ${left}초 +${left}🪙`,
  'hud.pickCard': '카드를 골라 주세요',
  'hud.lastWave': '마지막 웨이브',
  'hud.waveRunning': ({ wave }) => `웨이브 ${wave} 진행 중`,
  'hud.summon': '🎲 소환',
  'hud.mythic': '✨ 신화',
  'hud.upgrade': ({ name }) => `${name} 강화`,
  'hud.hint': '같은 동물·같은 단계를 끌어다 겹치면 무작위 동물로 성장해요',
  'hud.cardsTaken': ({ list }) => `카드: ${list}`,
  'boss.default': '무언가 다가온다…',
  'boss.coming': ({ name }) => `${name}${particle(name)} 다가온다…`,
  'boss.skill': ({ skill }) => `능력: ${skill}`,
  'mythic.title': '✨ 신화 조합',
  'mythic.help': '정해진 각성 동물 2마리와 성체 1마리를 모으면 신화 동물로 바뀌어요.',
  'mythic.make': '만들기',
  'mythic.material': ({ stage, animal }) => `${stage} ${animal}`,
  'cards.title': '카드를 한 장 골라 주세요',
  'mission.reward': ({ reward, left }) => `보상 ${reward} · 남은 웨이브 ${left}`,
  'mission.summons': ({ n }) => `무료 소환 ${n}`,
  'mission.upgrade': '강화 1단계',
  'info.mythic': ({ icon, name }) => `${icon} ${name} · 신화`,
  'info.animal': ({ name, stage, grade }) => `${name} · ${stage} (${grade})`,
  'info.sell': ({ gold }) => `판매 +${gold}`,
  'stat.damage': ({ value }) => `공격력 ${value}`,
  'stat.range': ({ value }) => `사거리 ${value}`,
  'stat.rangeAll': '사거리 맵 전체',
  'stat.speed': ({ value }) => `속도 ${value}/초`,
  'stat.splash': ({ value }) => `범위 ${value}`,
  'stat.shots': ({ value }) => `여우불 ${value}개`,
  'stat.burn': ({ value }) => `불길 ${value}/초`,
  'stat.slow': ({ value }) => `감속 ${value}%`,
  'stat.poison': ({ value }) => `독 ${value}/초`,
  'stat.boss': ({ value }) => `보스 x${value}`,
  'pause.label': '일시정지',
  'result.win': '🎉 승리!',
  'result.lose': '💔 패배',
  'result.newBest': '🏆 새 기록!',
  'result.endlessOver': '♾️ 무한 모드 끝',
  'result.endlessDetail': ({ wave, best }) => `웨이브 ${wave}까지 막았어요 · 최고 ${best}`,
  'result.livesLeft': ({ lives }) => `남은 생명 ${lives}`,
  'result.reached': ({ wave, max }) => `웨이브 ${wave}/${max}까지 막았어요`,
  'result.firstWave': '첫 웨이브를 막지 못했어요',
  'result.retry': '다시 하기',
  'result.menu': '맵 선택',
  'result.rewards': '🎁 클리어 보상',
  'result.levelUp': '📖 도감 레벨 업',
  'result.kills': '처치',
  'result.leaked': '놓침',
  'result.time': '시간',
  'result.ranking': '🏅 피해량 순위',
  'result.killCount': ({ kills }) => `처치 ${kills}`,
  'fx.golden': '✨ 황금 몬스터 출현!',
  'fx.escaped': '도망갔다…',
  'fx.newMission': '🎯 새 미션!',
  'fx.missionDone': '🎯 미션 성공!',
  'fx.missionFail': '미션 실패…',
  'fx.mythic': ({ name }) => `신화 탄생! ${name}`,
  'fx.stun': '기절!',
  'fx.awaken': '각성!',
  'fx.grow': '성장!',
  'fx.waveClear': ({ bonus }) => `웨이브 클리어 +${bonus}`,
  'fx.rage': '분노!',
  'fx.split': '분열!',
  'fx.summon': '소환!',
  'fx.dash': '질주!',
  'fx.roar': '포효!',
};

const pct = (x) => Math.round(x * 100);

export const EN = {
  'title': 'Tiny Mythic Squad - Merge Animal Defense',
  'meta.desc': 'Tiny Mythic Squad: merge cute baby animals into mythic beasts like Haetae, Girin and Gumiho and guard the black hole. A free browser defense game.',
  'menu.title': '🐯 Tiny Mythic Squad',
  'menu.subtitle': 'Merge & Defend Animal Defense',
  'menu.lead': 'Merge baby animals into mythic beasts and stop the monsters heading for the black hole.',
  'menu.hint': 'Landscape mode is more comfortable.',
  'menu.saveWarning': 'This browser cannot save your progress. You can still play.',
  'menu.lang': '🌐 한국어',
  'menu.continue': '▶ Continue',
  'menu.runNormal': ({ name, place, wave, max }) => `${name} · ${place} · Wave ${wave}/${max}`,
  'menu.runEndless': ({ name, place, wave }) => `${name} · ${place} · ♾️ Endless wave ${wave}`,
  'menu.locked': 'Clear the previous map to unlock',
  'menu.best': ({ wave, max }) => `Best wave ${wave}/${max}`,
  'menu.new': 'Not played yet',
  'menu.endless': '♾️ Endless',
  'menu.endlessBest': ({ best }) => `Best ${best}`,
  'menu.endlessNew': 'Try it!',
  'menu.confirmNew': 'You have a game in progress. Starting a new one will erase it. Start anyway?',
  'dex.button': '📖 Collection',
  'dex.total': ({ total, max }) => `Total level ${total}/${max}`,
  'dex.title': '📖 Collection',
  'dex.help': 'Clear all 30 waves of a normal game to get cards. Harder maps and more stars give more cards, and mythic cards only drop on Normal and Hard. Collect the same card to level it up: each level permanently adds 3% damage to that animal (max level 10).',
  'dex.mythicTag': 'Mythic',
  'dex.maxLevel': 'Max level',
  'dex.next': ({ have, need }) => `Next level ${have}/${need}`,
  'dex.bonus': ({ pct: p }) => `Damage +${p}%`,
  'dex.count': ({ count }) => `${count} card${count === 1 ? '' : 's'}`,
  'common.close': 'Close',
  'hud.wave': 'Wave',
  'hud.music': 'Music',
  'hud.sfx': 'Sound effects',
  'hud.musicOff': 'Music off',
  'hud.musicOn': 'Music on',
  'hud.sfxOff': 'Sound effects off',
  'hud.sfxOn': 'Sound effects on',
  'hud.speed': 'Speed',
  'hud.pause': 'Pause',
  'hud.menu': 'Maps',
  'hud.board': 'Game board',
  'hud.panel': 'Animals',
  'hud.nextWave': '▶ Next wave',
  'hud.skip': ({ left }) => `⏭ Start now ${left}s +${left}🪙`,
  'hud.pickCard': 'Pick a card',
  'hud.lastWave': 'Final wave',
  'hud.waveRunning': ({ wave }) => `Wave ${wave} in progress`,
  'hud.summon': '🎲 Summon',
  'hud.mythic': '✨ Mythic',
  'hud.upgrade': ({ name }) => `Upgrade ${name}`,
  'hud.hint': 'Drag an animal onto the same animal at the same stage to grow a random animal',
  'hud.cardsTaken': ({ list }) => `Cards: ${list}`,
  'boss.default': 'Something is coming…',
  'boss.coming': ({ name }) => `The ${name} is coming…`,
  'boss.skill': ({ skill }) => `Ability: ${skill}`,
  'mythic.title': '✨ Mythic Fusion',
  'mythic.help': 'Gather the 2 awakened animals and 1 adult animal shown to turn them into a mythic beast.',
  'mythic.make': 'Make',
  'mythic.material': ({ stage, animal }) => `${stage} ${animal}`,
  'cards.title': 'Pick one card',
  'mission.reward': ({ reward, left }) => `Reward ${reward} · ${left} wave${left === 1 ? '' : 's'} left`,
  'mission.summons': ({ n }) => `${n} free summons`,
  'mission.upgrade': '+1 upgrade',
  'info.mythic': ({ icon, name }) => `${icon} ${name} · Mythic`,
  'info.animal': ({ name, stage, grade }) => `${name} · ${stage} (${grade})`,
  'info.sell': ({ gold }) => `Sell +${gold}`,
  'stat.damage': ({ value }) => `Damage ${value}`,
  'stat.range': ({ value }) => `Range ${value}`,
  'stat.rangeAll': 'Range: whole map',
  'stat.speed': ({ value }) => `Speed ${value}/s`,
  'stat.splash': ({ value }) => `Splash ${value}`,
  'stat.shots': ({ value }) => `${value} fox fires`,
  'stat.burn': ({ value }) => `Burn ${value}/s`,
  'stat.slow': ({ value }) => `Slow ${value}%`,
  'stat.poison': ({ value }) => `Poison ${value}/s`,
  'stat.boss': ({ value }) => `Boss x${value}`,
  'pause.label': 'Paused',
  'result.win': '🎉 Victory!',
  'result.lose': '💔 Defeat',
  'result.newBest': '🏆 New record!',
  'result.endlessOver': '♾️ Endless run over',
  'result.endlessDetail': ({ wave, best }) => `Held until wave ${wave} · Best ${best}`,
  'result.livesLeft': ({ lives }) => `Lives left ${lives}`,
  'result.reached': ({ wave, max }) => `Held until wave ${wave}/${max}`,
  'result.firstWave': "Couldn't hold the first wave",
  'result.retry': 'Retry',
  'result.menu': 'Maps',
  'result.rewards': '🎁 Clear rewards',
  'result.levelUp': '📖 Level up',
  'result.kills': 'Kills',
  'result.leaked': 'Missed',
  'result.time': 'Time',
  'result.ranking': '🏅 Damage ranking',
  'result.killCount': ({ kills }) => `${kills} kills`,
  'fx.golden': '✨ A golden monster appears!',
  'fx.escaped': 'It got away…',
  'fx.newMission': '🎯 New mission!',
  'fx.missionDone': '🎯 Mission complete!',
  'fx.missionFail': 'Mission failed…',
  'fx.mythic': ({ name }) => `A mythic is born! ${name}`,
  'fx.stun': 'Stunned!',
  'fx.awaken': 'Awakened!',
  'fx.grow': 'Grown!',
  'fx.waveClear': ({ bonus }) => `Wave clear +${bonus}`,
  'fx.rage': 'Rage!',
  'fx.split': 'Split!',
  'fx.summon': 'Summon!',
  'fx.dash': 'Dash!',
  'fx.roar': 'Roar!',
};

// 사전에 없는 문장은 키를 그대로 보여 준다(빠진 번역이 눈에 띄게)
export function t(key, vars = {}) {
  const entry = (current === 'en' ? EN : KO)[key] ?? KO[key];
  if (entry === undefined) return key;
  return typeof entry === 'function' ? entry(vars) : entry;
}

// 게임 데이터 이름의 영어
const EN_TOWERS = { squirrel: 'Squirrel', elephant: 'Elephant', penguin: 'Penguin', eagle: 'Eagle', snake: 'Snake' };
const EN_STAGES = ['Baby', 'Young', 'Adult', 'Awakened'];
const EN_GRADES = ['Common', 'Rare', 'Legendary', 'Mythic'];
const EN_MYTHICS = {
  phoenix: { name: 'Phoenix', desc: 'Shoots fire feathers that leave burning flames behind' },
  gumiho: { name: 'Gumiho', desc: 'Fox fire chases several enemies and sometimes stuns them for 1 second' },
  cheonma: { name: 'Cheonma', desc: 'A wind gust pierces every enemy in a line and speeds up nearby animals' },
  haetae: { name: 'Haetae', desc: 'Shakes the ground to damage and slow every enemy on the map' },
  girin: { name: 'Girin', desc: 'Attacks very fast and is strong against bosses. Its kills give extra gold' },
};
const EN_ENEMIES = {
  golden: { name: 'Golden Monster' },
  boss: { name: 'Red Demon', skill: 'Rage — 1.5x faster below half health' },
  slimeKing: { name: 'Slime King', skill: 'Split — releases 2 slimes at 75%, 50% and 25% health' },
  lich: { name: 'Lich King', skill: 'Summon — calls a skeleton shield every 5 seconds' },
  lavaGolem: { name: 'Lava Golem', skill: 'Tough — takes 30% less damage' },
  shadowWolf: { name: 'Shadow Wolf', skill: 'Dash — 3x faster for 1.5 seconds every 6 seconds' },
  dragon: { name: 'Black Dragon', skill: 'Roar — stuns nearby animals for 2 seconds every 8 seconds' },
};
const EN_MAPS = {
  meadow: { name: 'Easy', place: 'Rocky Hill' },
  forest: { name: 'Normal', place: 'Forest' },
  canyon: { name: 'Hard', place: 'Sea' },
};
const EN_CARDS = {
  haste: { name: 'Swift Claws', desc: () => `All animals attack ${pct(CARD_POWER.haste)}% faster` },
  eye: { name: 'Hawk Eye', desc: () => `All animals +${CARD_POWER.eye} range` },
  treasure: { name: 'Treasure Chest', desc: () => `+${CARD_POWER.treasure} gold` },
  heal: { name: 'First Aid', desc: () => `+${CARD_POWER.heal} lives (max 20)` },
  lucky: { name: 'Lucky Summon', desc: () => `Summon ${CARD_POWER.lucky} baby animals for free` },
  bounty: { name: 'Bounty', desc: () => `+${CARD_POWER.bounty} gold per kill` },
  frost: { name: 'Frost Wind', desc: () => `All monsters move ${pct(1 - CARD_POWER.frost)}% slower` },
  hunter: { name: 'Boss Hunter', desc: () => `+${pct(CARD_POWER.hunter)}% damage to bosses` },
};
const EN_MISSIONS = {
  kill: ({ goal }) => `Defeat ${goal} monsters`,
  noLeak: () => 'Clear a wave without losing a life',
  awaken: () => 'Make an awakened animal',
  trio: () => 'Gather 3 of the same animal',
  golden: () => 'Catch the golden monster',
  skip: () => 'Start a wave early 3 times',
  upgrade: () => 'Upgrade animals 2 times',
  mythic: () => 'Make a mythic animal',
};

const en = () => current === 'en';
export const towerName = (id) => (en() ? EN_TOWERS[id] : TOWERS[id].name);
export const mythicName = (id) => (en() ? EN_MYTHICS[id].name : MYTHICS[id].name);
export const mythicDesc = (id) => (en() ? EN_MYTHICS[id].desc : MYTHICS[id].desc);
// 동물이면 동물 이름, 신화면 신화 이름
export const unitName = (id) => (MYTHICS[id] ? mythicName(id) : towerName(id));
export const enemyName = (id) => (en() ? EN_ENEMIES[id].name : ENEMIES[id].name);
export const bossSkill = (id) => (en() ? EN_ENEMIES[id].skill : ENEMIES[id].skill);
export const mapName = (id) => (en() ? EN_MAPS[id].name : MAPS.find((m) => m.id === id).name);
export const mapPlace = (id) => (en() ? EN_MAPS[id].place : MAPS.find((m) => m.id === id).place);
export const stageName = (i) => (en() ? EN_STAGES[i] : STAGE_NAMES[i]);
export const gradeName = (i) => (en() ? EN_GRADES[i] : GRADE_NAMES[i]);

// 카드 id는 'haste'처럼 하나이거나, 동물 특훈은 'train:다람쥐 id'
export function cardName(id) {
  if (!en()) return CARDS[id].name;
  const [kind, animal] = id.split(':');
  return kind === 'train' ? `${EN_TOWERS[animal]} Training` : EN_CARDS[kind].name;
}
export function cardDesc(id) {
  if (!en()) return CARDS[id].desc;
  const [kind, animal] = id.split(':');
  return kind === 'train' ? `${EN_TOWERS[animal]} damage +${pct(CARD_POWER.train)}%` : EN_CARDS[kind].desc();
}

// 미션 목표와 진행 (예: '몬스터 34마리 처치 (0/34)')
export function missionLabel(m) {
  const def = MISSIONS[m.id];
  const text = en() ? EN_MISSIONS[m.id](m) : (typeof def.text === 'function' ? def.text(m) : def.text);
  return `${text} (${Math.min(m.progress, m.goal)}/${m.goal})`;
}

// index.html의 고정 글자: data-i18n(글자), data-i18n-label(aria-label과 title)
export function applyStatic(root) {
  for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll('[data-i18n-label]')) {
    const text = t(node.dataset.i18nLabel);
    node.setAttribute('aria-label', text);
    if (node.hasAttribute('title')) node.title = text;
  }
}
