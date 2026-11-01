// 이모지 → 도트 아이콘 이름 (data/icons.js). 'animal:id'·'mythic:id'는 동물·신화 도트 그림을 쓴다.
// 이모지는 기기마다 모양이 달라 게임 화면과 어울리지 않으므로 화면에 쓰기 전에 아이콘으로 바꾼다(ui/icons.js).
export const EMOJI_ICONS = {
  '❤️': 'heart', '❤': 'heart', '💔': 'heartBroken', '🪙': 'coin', '🚩': 'flag', '♾️': 'infinity', '♾': 'infinity',
  '✨': 'sparkle', '📖': 'book', '🎯': 'target', '🌐': 'globe', '⏭️': 'skip', '⏭': 'skip', '🎲': 'dice',
  '🎉': 'party', '🏆': 'trophy', '🎁': 'gift', '🏅': 'medal', '🎵': 'music', '🔊': 'speaker', '🔇': 'mute',
  '⏸️': 'pause', '⏸': 'pause', '▶️': 'play', '▶': 'play', '☰': 'menu', '⭐': 'star', '☆': 'starEmpty',
  '⚔️': 'swords', '⚔': 'swords', '⏱️': 'clock', '⏱': 'clock', '🔒': 'lock', '⚡': 'bolt', '🔭': 'scope',
  '💰': 'bag', '🧊': 'ice', '👑': 'crown', '✔': 'check', '✖': 'cross', '💾': 'disk',
  '🐿️': 'animal:squirrel', '🐿': 'animal:squirrel', '🐘': 'animal:elephant', '🐧': 'animal:penguin', '🦅': 'animal:eagle', '🐍': 'animal:snake',
  '🔥': 'mythic:phoenix', '🦊': 'mythic:gumiho', '🐎': 'mythic:cheonma', '🐯': 'mythic:haetae', '🦒': 'mythic:girin',
};

// 긴 것부터 맞춘다(❤️가 ❤보다 먼저)
const KEYS = Object.keys(EMOJI_ICONS).sort((a, b) => b.length - a.length);
const RE = new RegExp(KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');

export const hasIcon = (text) => { RE.lastIndex = 0; return RE.test(String(text)); };

// 글자를 ['글자', { icon: '이름' }, ...] 조각으로 나눈다
export function splitIcons(text) {
  const s = String(text);
  const parts = [];
  let last = 0;
  RE.lastIndex = 0;
  for (const m of s.matchAll(RE)) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push({ icon: EMOJI_ICONS[m[0]] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
