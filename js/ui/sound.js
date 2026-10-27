// 효과음과 배경음. 소리 파일 없이 브라우저(Web Audio)에서 도트 게임풍 소리를 직접 만든다.
// 브라우저는 사용자가 화면을 누르기 전에는 소리를 막으므로, 처음 누를 때 unlock()으로 소리를 켠다.

// 배경음과 효과음은 따로 켜고 끈다: { music, sfx }
export const SOUND_KEY = 'td-sound-v2';
// 예전 설정(한 버튼으로 전체 → 효과음만 → 끄기)
export const OLD_SOUND_KEY = 'td-sound-v1';
const OLD_MODES = { all: { music: true, sfx: true }, sfx: { music: false, sfx: true }, off: { music: false, sfx: false } };

export function loadSoundSettings(store) {
  try {
    const raw = store.getItem(SOUND_KEY);
    if (raw !== null && raw !== undefined) {
      const v = JSON.parse(raw);
      if (v && typeof v.music === 'boolean' && typeof v.sfx === 'boolean') return { music: v.music, sfx: v.sfx };
      return { music: true, sfx: true };
    }
    return { ...(OLD_MODES[store.getItem(OLD_SOUND_KEY)] ?? OLD_MODES.all) };
  } catch {
    return { music: true, sfx: true };
  }
}

export function saveSoundSettings(store, settings) {
  try {
    store.setItem(SOUND_KEY, JSON.stringify({ music: settings.music, sfx: settings.sfx }));
  } catch {
    // 저장이 막혀 있어도 이번 판에는 그대로 쓴다
  }
}

// 게임 규칙이 내보낸 이벤트 → 낼 효과음 이름. 발사·피해 숫자처럼 아주 잦은 것은 소리를 내지 않는다.
// 웨이브 클리어(카드 3장이 뜨는 순간)와 카드를 고를 때는 소리를 내지 않는다
export function soundsFor(events) {
  const out = [];
  for (const ev of events) {
    if (ev.type === 'death') out.push(BOSSES.has(ev.enemy) ? 'bossDeath' : 'pop');
    else if (ev.type === 'leak') out.push('hurt');
    else if (ev.type === 'bossSkill') out.push(ev.skill === 'roar' ? 'roar' : 'skill');
    else if (ev.type === 'quake') out.push('quake');
    else if (ev.type === 'charm') out.push('charm');
  }
  return out;
}
const BOSSES = new Set(['boss', 'slimeKing', 'lich', 'lavaGolem', 'shadowWolf', 'dragon']);

// 같은 소리가 너무 촘촘히 겹치지 않게 하는 최소 간격(초)
const GAP = { pop: 0.05, hurt: 0.12, quake: 0.5, charm: 0.15, skill: 0.3 };

// 배경음: 긴장감 있는 라단조. 8분음표로 쉬지 않고 달리는 베이스와 북, 띄엄띄엄 나오는 선율 (0은 쉼표)
const TEMPO = 0.17;
const BASS = [
  110, 110, 110, 110, 87.3, 87.3, 98, 98,
  110, 110, 110, 110, 87.3, 87.3, 98, 98,
  110, 110, 130.8, 110, 82.4, 82.4, 103.8, 103.8,
  110, 110, 130.8, 110, 82.4, 82.4, 103.8, 103.8,
];
const MELODY = [
  440, 0, 523, 0, 494, 0, 440, 0,
  659, 0, 0, 587, 523, 0, 494, 0,
  440, 0, 523, 0, 659, 0, 698, 0,
  659, 0, 587, 0, 523, 0, 494, 415,
];
// 북: k 큰북, s 작은북, h 하이햇, . 쉼
const DRUMS = 'khshkhsh';

export function createSound() {
  let ctx = null;
  let master = null;
  let settings = { music: true, sfx: true };
  let musicWanted = false;
  let musicTimer = null;
  let nextNoteAt = 0;
  let step = 0;
  const lastPlayed = {};

  function unlock() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    syncMusic();
  }

  // 음 하나: freq에서 slideTo로 미끄러지며 dur초 동안 소리 나고 사라진다
  function tone(freq, dur, { type = 'square', vol = 0.08, slideTo = null, at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 잡음 (폭발, 우르릉, 북): 낮은 주파수만 남기면 묵직해지고, 높은 주파수만 남기면 찰랑인다
  function noise(dur, { vol = 0.15, cutoff = 1200, at = 0, filter: kind = 'lowpass' } = {}) {
    const t = ctx.currentTime + at;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = kind;
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
  }

  const arpeggio = (notes, gap, opts = {}) => notes.forEach((f, i) => tone(f, gap * 2.2, { ...opts, at: (opts.at ?? 0) + i * gap }));

  const SOUNDS = {
    summon: () => tone(660, 0.1, { slideTo: 990, vol: 0.06 }),
    merge: () => arpeggio([523, 784], 0.07, { vol: 0.07 }),
    awaken: () => arpeggio([523, 659, 784, 1047], 0.06, { type: 'triangle', vol: 0.12 }),
    mythic: () => {
      arpeggio([523, 659, 784, 1047, 1319, 1568], 0.055, { type: 'triangle', vol: 0.13 });
      arpeggio([1568, 2093, 2637], 0.04, { type: 'sine', vol: 0.05, at: 0.35 });
      [523, 659, 784].forEach((f) => tone(f, 1.1, { type: 'triangle', vol: 0.05, at: 0.35 }));
    },
    upgrade: () => tone(440, 0.14, { slideTo: 880, type: 'triangle', vol: 0.08 }),
    sell: () => arpeggio([784, 523], 0.06, { vol: 0.05 }),
    pop: () => {
      tone(320, 0.06, { slideTo: 140, vol: 0.035 });
      noise(0.04, { vol: 0.03, cutoff: 3000 });
    },
    bossDeath: () => {
      noise(0.7, { vol: 0.25, cutoff: 700 });
      tone(140, 0.6, { slideTo: 40, type: 'sawtooth', vol: 0.1 });
      arpeggio([523, 659, 784, 1047], 0.08, { type: 'triangle', vol: 0.08, at: 0.3 });
    },
    hurt: () => tone(240, 0.18, { slideTo: 110, vol: 0.08 }),
    skill: () => tone(320, 0.22, { slideTo: 180, type: 'sawtooth', vol: 0.05 }),
    roar: () => {
      noise(0.9, { vol: 0.28, cutoff: 380 });
      tone(90, 0.8, { slideTo: 45, type: 'sawtooth', vol: 0.12 });
    },
    quake: () => noise(0.35, { vol: 0.12, cutoff: 220 }),
    charm: () => tone(1200, 0.12, { slideTo: 1800, type: 'sine', vol: 0.04 }),
    // 보스 경고(약 3초): 낮은 종소리, 서로 어긋나 맥놀이하는 불협화음, 쿵쿵 심장 박동, 스산한 바람
    bossWarning: () => {
      const t = ctx.currentTime;
      // 종: 배음이 어긋난 낮은 종이 길게 울린다
      for (const [f, v] of [[98, 0.12], [98 * 2.76, 0.05], [98 * 5.4, 0.03]]) tone(f, 2.8, { type: 'sine', vol: v });
      // 불협화음: 라·라#·레#(세 온음)이 어둡게 깔렸다가 서서히 커진다
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(200, t);
      lp.frequency.linearRampToValueAtTime(700, t + 2.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1, t + 1.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      lp.connect(g).connect(master);
      for (const f of [55, 58.3, 77.8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(lp);
        o.start(t);
        o.stop(t + 3.3);
      }
      // 심장 박동: 쿵-쿵 세 번
      for (const beat of [0.3, 1.25, 2.2]) {
        tone(70, 0.18, { type: 'sine', slideTo: 38, vol: 0.32, at: beat });
        tone(62, 0.16, { type: 'sine', slideTo: 34, vol: 0.24, at: beat + 0.24 });
      }
      // 스산한 바람
      noise(3, { vol: 0.05, cutoff: 900, filter: 'bandpass' });
    },
    win: () => {
      arpeggio([523, 659, 784, 1047], 0.12, { type: 'triangle', vol: 0.12 });
      [523, 659, 784, 1047].forEach((f) => tone(f, 1.2, { type: 'triangle', vol: 0.05, at: 0.5 }));
    },
    lose: () => arpeggio([392, 330, 262, 196], 0.2, { type: 'triangle', vol: 0.1 }),
  };

  function play(name) {
    if (!ctx || !settings.sfx || ctx.state !== 'running' || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    if (now - (lastPlayed[name] ?? -1) < (GAP[name] ?? 0.03)) return;
    lastPlayed[name] = now;
    SOUNDS[name]();
  }

  // 배경음: 조금 앞까지 음을 미리 예약해 두는 방식이라 화면이 버벅여도 박자가 흔들리지 않는다
  function scheduleMusic() {
    while (nextNoteAt < ctx.currentTime + 0.25) {
      const at = nextNoteAt - ctx.currentTime;
      const note = MELODY[step % MELODY.length];
      if (note) tone(note, TEMPO * 1.6, { type: 'triangle', vol: 0.032, at });
      tone(BASS[step % BASS.length], TEMPO * 0.8, { type: 'square', vol: 0.022, at });
      const drum = DRUMS[step % DRUMS.length];
      if (drum === 'k') tone(120, 0.12, { type: 'sine', slideTo: 45, vol: 0.09, at });
      else if (drum === 's') noise(0.09, { vol: 0.035, cutoff: 1800, filter: 'bandpass', at });
      else if (drum === 'h') noise(0.03, { vol: 0.018, cutoff: 7000, filter: 'highpass', at });
      step += 1;
      nextNoteAt += TEMPO;
    }
  }

  function syncMusic() {
    const on = !!ctx && musicWanted && settings.music;
    if (on && !musicTimer) {
      nextNoteAt = ctx.currentTime + 0.1;
      musicTimer = setInterval(scheduleMusic, 60);
    } else if (!on && musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock,
    play,
    playEvents(events) {
      for (const name of soundsFor(events)) play(name);
    },
    // 배경음을 틀지(게임 화면이고 일시정지가 아닐 때)
    setMusic(on) {
      if (musicWanted !== on) {
        musicWanted = on;
        syncMusic();
      }
    },
    // { music, sfx }: 배경음과 효과음을 따로 켜고 끈다
    setSettings(next) {
      settings = { music: !!next.music, sfx: !!next.sfx };
      syncMusic();
    },
  };
}
