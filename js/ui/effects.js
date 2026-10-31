// 화면 효과(발사체, 파편, 보상 숫자, 문구, 흔들림, 번쩍임)의 상태.
// 좌표는 맵 칸 단위, 시간은 ms. 그리기는 render.js가 한다.

export const EFFECT_LIMIT = 400;
export const LIFE = {
  projectile: 180, beam: 260, shock: 320, suck: 650, particle: 520, coin: 950, ring: 420, text: 1100, flash: 320, damage: 650,
};
export const SHAKE_MS = 450;

import { ENEMIES } from '../data/enemies.js';
import { MYTHICS } from '../data/mythics.js';
import { t, mythicName } from '../i18n.js';

// 처치 파편 색 (몬스터 도트의 주색)
export const ENEMY_COLORS = {
  soldier: '#5fbf4a', runner: '#e0453a', tank: '#8d99a3', shield: '#eceff1',
  splitter: '#a85be0', mini: '#a85be0', boss: '#c8302a', golden: '#ffd23f',
  slimeKing: '#5fd35a', lich: '#8a4fd0', lavaGolem: '#ff7a1a', shadowWolf: '#3a3a4a', dragon: '#2a2a36',
};
const GOLD = ['#ffd23f', '#fff3b0', '#ffb703'];
const RAINBOW = ['#ff5e5e', '#ffb03b', '#ffe94d', '#6bff8a', '#4fc3ff', '#b77dff'];
// 보스 능력 문구
const SKILLS = ['rage', 'split', 'summon', 'dash', 'roar'];

// 화면 효과 전용 난수. 소환 같은 게임 규칙의 무작위(Math.random)와 섞이지 않게 따로 쓴다.
export function effectRng(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

export function createEffects(rng = effectRng(Date.now())) {
  let list = [];
  const hits = new Map();
  let shakeAt = -Infinity;
  let shakePower = 0;
  let flashAt = -Infinity;
  let pulseAt = -Infinity; // 블랙홀이 몬스터를 삼킨 시각

  const add = (fx) => {
    list.push(fx);
    if (list.length > EFFECT_LIMIT) list.splice(0, list.length - EFFECT_LIMIT);
  };

  // 한 점에서 사방으로 튀는 네모 파편
  function burst(x, y, count, colors, speed, size, now) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rng() * 0.6;
      const v = speed * (0.6 + rng() * 0.7);
      add({
        kind: 'particle', x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * 0.5,
        color: colors[i % colors.length], size, t: now, life: LIFE.particle,
      });
    }
  }

  const shakeLevel = (now) => {
    const k = 1 - (now - shakeAt) / SHAKE_MS;
    return k > 0 ? k * shakePower : 0;
  };

  // 지금 흔들림보다 셀 때만 새로 흔든다
  function shake(power, now) {
    if (power >= shakeLevel(now)) {
      shakeAt = now;
      shakePower = power;
    }
  }

  return {
    // center: 맵 가운데(칸 좌표). 미션 문구를 띄울 자리
    fromEvent(ev, now, center = { x: 8, y: 5 }) {
      if (ev.type === 'shot') {
        add({ kind: 'projectile', tower: ev.tower, from: ev.from, to: ev.to, t: now, life: LIFE.projectile });
        if (ev.tower === 'elephant') add({ kind: 'shock', x: ev.to.x, y: ev.to.y, t: now, life: LIFE.shock });
        if (ev.targetId !== undefined) hits.set(ev.targetId, now);
      } else if (ev.type === 'hit') {
        // 같은 자리에 숫자가 겹치지 않게 좌우로 조금 흩뿌린다
        add({
          kind: 'damage', x: ev.x + (rng() - 0.5) * 0.5, y: ev.y, text: String(Math.max(1, Math.round(ev.amount))),
          t: now, life: LIFE.damage,
        });
      } else if (ev.type === 'death' && ev.enemy === 'golden') {
        // 황금 몬스터 처치: 금화 폭죽과 큰 보상 숫자
        burst(ev.x, ev.y, 34, GOLD, 3.4, 0.11, now);
        add({ kind: 'ring', x: ev.x, y: ev.y, color: '#ffd23f', big: true, t: now, life: LIFE.ring });
        add({ kind: 'text', x: ev.x, y: ev.y, text: `+${ev.reward}🪙`, big: true, t: now, life: LIFE.text });
        shake(0.35, now);
      } else if (ev.type === 'goldenSpawn') {
        add({ kind: 'text', x: center.x, y: center.y, text: t('fx.golden'), big: true, t: now, life: LIFE.text * 1.4 });
        burst(ev.x, ev.y, 14, GOLD, 2, 0.08, now);
      } else if (ev.type === 'goldenEscape') {
        add({ kind: 'text', x: ev.x, y: ev.y, text: t('fx.escaped'), big: false, t: now, life: LIFE.text });
      } else if (ev.type === 'missionStart') {
        add({ kind: 'text', x: center.x, y: center.y, text: t('fx.newMission'), big: false, t: now, life: LIFE.text });
      } else if (ev.type === 'missionDone') {
        add({ kind: 'text', x: center.x, y: center.y, text: t('fx.missionDone'), big: true, t: now, life: LIFE.text * 1.4 });
        burst(center.x, center.y, 24, GOLD, 2.6, 0.1, now);
      } else if (ev.type === 'missionFail') {
        add({ kind: 'text', x: center.x, y: center.y, text: t('fx.missionFail'), big: false, warn: true, t: now, life: LIFE.text });
      } else if (ev.type === 'death') {
        const boss = !!ENEMIES[ev.enemy]?.boss;
        burst(ev.x, ev.y, boss ? 28 : 8, [ENEMY_COLORS[ev.enemy] ?? '#ffffff', '#ffffff'], boss ? 3.2 : 2.2, boss ? 0.12 : 0.08, now);
        add({ kind: 'coin', x: ev.x, y: ev.y, text: `+${ev.reward}`, t: now, life: LIFE.coin });
        if (boss) {
          add({ kind: 'ring', x: ev.x, y: ev.y, color: '#ff4d4d', big: true, t: now, life: LIFE.ring });
          shake(1, now);
        }
      } else if (ev.type === 'bossSkill') {
        const roar = ev.skill === 'roar';
        add({ kind: 'text', x: ev.x, y: ev.y, text: SKILLS.includes(ev.skill) ? t(`fx.${ev.skill}`) : '!', big: roar, warn: true, t: now, life: LIFE.text });
        add({ kind: 'ring', x: ev.x, y: ev.y, color: roar ? '#ff3b30' : '#ff9f43', big: roar, reach: roar ? 2.5 : 0.8, t: now, life: LIFE.ring });
        if (roar) shake(0.6, now);
      } else if (ev.type === 'mythic') {
        add({ kind: 'ring', x: ev.x, y: ev.y, color: '#ff5ec4', big: true, reach: 2.2, t: now, life: LIFE.ring * 2 });
        burst(ev.x, ev.y, 30, RAINBOW, 3, 0.11, now);
        add({ kind: 'text', x: ev.x, y: ev.y, text: t('fx.mythic', { name: MYTHICS[ev.mythic] ? mythicName(ev.mythic) : '' }), big: true, t: now, life: LIFE.text * 1.6 });
        shake(0.7, now);
      } else if (ev.type === 'mythicShot') {
        if (ev.mythic === 'cheonma') add({ kind: 'beam', from: ev.from, to: ev.to, t: now, life: LIFE.beam });
        else add({ kind: 'projectile', tower: ev.mythic, from: ev.from, to: ev.to, t: now, life: LIFE.projectile });
        if (ev.mythic === 'phoenix') add({ kind: 'ring', x: ev.to.x, y: ev.to.y, color: '#ff7a1a', big: false, reach: 0.8, t: now, life: LIFE.ring });
      } else if (ev.type === 'quake') {
        add({ kind: 'ring', x: ev.x, y: ev.y, color: '#ffd23f', big: true, reach: 6, t: now, life: LIFE.ring * 2 });
        shake(0.25, now);
      } else if (ev.type === 'stun') {
        add({ kind: 'text', x: ev.x, y: ev.y, text: t('fx.stun'), big: false, stun: true, t: now, life: LIFE.text });
      } else if (ev.type === 'leak') {
        flashAt = now;
        // 블랙홀에 빨려 들어간다: 그 자리에서 돌며 작아지고, 블랙홀이 꿀렁인다
        pulseAt = now;
        add({ kind: 'suck', enemy: ev.enemy, x: ev.x, y: ev.y, spin: rng() < 0.5 ? -1 : 1, t: now, life: LIFE.suck });
      }
    },
    summon(x, y, now) {
      add({ kind: 'ring', x, y, color: '#ffffff', big: false, t: now, life: LIFE.ring });
      burst(x, y, 6, ['#ffffff', '#fff3b0'], 1.2, 0.07, now);
    },
    merge(x, y, level, now, name = '') {
      const awakened = level >= 3;
      add({ kind: 'ring', x, y, color: '#ffd23f', big: awakened, t: now, life: LIFE.ring });
      burst(x, y, awakened ? 22 : 10, GOLD, awakened ? 2.6 : 1.6, awakened ? 0.1 : 0.08, now);
      const word = t(awakened ? 'fx.awaken' : 'fx.grow');
      add({ kind: 'text', x, y, text: name ? `${word} ${name}` : word, big: awakened, t: now, life: LIFE.text });
      if (awakened) shake(0.4, now);
    },
    waveClear(x, y, bonus, now) {
      add({ kind: 'text', x, y, text: t('fx.waveClear', { bonus }), big: false, t: now, life: LIFE.text });
      burst(x, y, 12, GOLD, 1.8, 0.08, now);
    },
    hitTime(enemyId) {
      return hits.get(enemyId) ?? -Infinity;
    },
    active(now) {
      list = list.filter((f) => now - f.t < f.life);
      for (const [id, t] of hits) if (now - t > 1000) hits.delete(id);
      return list;
    },
    // 화면 흔들림 세기 0~1
    shake(now) {
      return shakeLevel(now);
    },
    // 블랙홀이 몬스터를 삼킨 뒤 꿀렁임 세기 0~1
    portalPulse(now) {
      const k = 1 - (now - pulseAt) / (LIFE.suck * 1.4);
      return k > 0 ? Math.min(1, k) : 0;
    },
    // 적이 집에 도착했을 때 붉은 번쩍임 세기 0~1
    flash(now) {
      const k = 1 - (now - flashAt) / LIFE.flash;
      return k > 0 ? Math.min(1, k) : 0;
    },
  };
}
