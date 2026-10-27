// 효과음과 배경음. 소리 파일 없이 브라우저(Web Audio)에서 도트 게임풍 소리를 직접 만든다.
// 브라우저는 사용자가 화면을 누르기 전에는 소리를 막으므로, 처음 누를 때 unlock()으로 소리를 켠다.

export const SOUND_KEY = 'td-sound-v1';
export const SOUND_MODES = ['all', 'sfx', 'off']; // 전체, 효과음만, 끄기
export const nextSoundMode = (mode) => SOUND_MODES[(SOUND_MODES.indexOf(mode) + 1) % SOUND_MODES.length];

export function loadSoundMode(store) {
  try {
    const v = store.getItem(SOUND_KEY);
    return SOUND_MODES.includes(v) ? v : 'all';
  } catch {
    return 'all';
  }
}

export function saveSoundMode(store, mode) {
  try {
    store.setItem(SOUND_KEY, mode);
  } catch {
    // 저장이 막혀 있어도 이번 판에는 그대로 쓴다
  }
}

// 게임 규칙이 내보낸 이벤트 → 낼 효과음 이름. 발사·피해 숫자처럼 아주 잦은 것은 소리를 내지 않는다
export function soundsFor(events) {
  const out = [];
  for (const ev of events) {
    if (ev.type === 'death') out.push(BOSSES.has(ev.enemy) ? 'bossDeath' : 'pop');
    else if (ev.type === 'leak') out.push('hurt');
    else if (ev.type === 'waveClear') out.push('clear');
    else if (ev.type === 'bossSkill') out.push(ev.skill === 'roar' ? 'roar' : 'skill');
    else if (ev.type === 'quake') out.push('quake');
    else if (ev.type === 'charm') out.push('charm');
  }
  return out;
}
const BOSSES = new Set(['boss', 'slimeKing', 'lich', 'lavaGolem', 'shadowWolf', 'dragon']);

// 같은 소리가 너무 촘촘히 겹치지 않게 하는 최소 간격(초)
const GAP = { pop: 0.05, hurt: 0.12, quake: 0.5, charm: 0.15, skill: 0.3 };

// 배경음: 도·레·미·솔·라 음계의 잔잔한 반복 (8분음표, 0은 쉼표)
const TEMPO = 0.21;
const MELODY = [
  523, 0, 659, 784, 0, 659, 587, 0, 523, 0, 440, 523, 0, 587, 659, 0,
  784, 0, 880, 784, 0, 659, 587, 0, 659, 0, 587, 523, 0, 440, 523, 0,
];
const BASS = [131, 131, 165, 165, 110, 110, 147, 147];

export function createSound() {
  let ctx = null;
  let master = null;
  let mode = 'all';
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

  // 잡음 (폭발, 우르릉): 낮은 주파수만 남기면 묵직해진다
  function noise(dur, { vol = 0.15, cutoff = 1200, at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
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
    card: () => arpeggio([880, 1175], 0.05, { type: 'triangle', vol: 0.07 }),
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
    clear: () => arpeggio([784, 988, 1175, 1568], 0.07, { type: 'triangle', vol: 0.08 }),
    skill: () => tone(320, 0.22, { slideTo: 180, type: 'sawtooth', vol: 0.05 }),
    roar: () => {
      noise(0.9, { vol: 0.28, cutoff: 380 });
      tone(90, 0.8, { slideTo: 45, type: 'sawtooth', vol: 0.12 });
    },
    quake: () => noise(0.35, { vol: 0.12, cutoff: 220 }),
    charm: () => tone(1200, 0.12, { slideTo: 1800, type: 'sine', vol: 0.04 }),
    // 보스 경고: 낮게 깔리는 불길한 울림
    bossWarning: () => {
      tone(55, 2.2, { type: 'sawtooth', vol: 0.09 });
      tone(58, 2.2, { type: 'sawtooth', vol: 0.07 });
      noise(1.8, { vol: 0.06, cutoff: 160 });
    },
    win: () => {
      arpeggio([523, 659, 784, 1047], 0.12, { type: 'triangle', vol: 0.12 });
      [523, 659, 784, 1047].forEach((f) => tone(f, 1.2, { type: 'triangle', vol: 0.05, at: 0.5 }));
    },
    lose: () => arpeggio([392, 330, 262, 196], 0.2, { type: 'triangle', vol: 0.1 }),
  };

  function play(name) {
    if (!ctx || mode === 'off' || ctx.state !== 'running' || !SOUNDS[name]) return;
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
      if (note) tone(note, TEMPO * 0.9, { type: 'triangle', vol: 0.035, at });
      if (step % 4 === 0) tone(BASS[(step / 4) % BASS.length], TEMPO * 3.6, { type: 'square', vol: 0.018, at });
      step += 1;
      nextNoteAt += TEMPO;
    }
  }

  function syncMusic() {
    const on = !!ctx && musicWanted && mode === 'all';
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
    setMode(m) {
      mode = m;
      syncMusic();
    },
    get mode() {
      return mode;
    },
  };
}
