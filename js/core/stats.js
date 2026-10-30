import { TOWERS } from '../data/towers.js';
import { MYTHICS } from '../data/mythics.js';

// 결과 화면 통계: 동물 종류(신화 포함)별 피해량·처치 수, 놓친 몬스터, 실제 플레이 시간(초)
export const emptyStats = () => ({ damage: {}, kills: {}, leaked: 0, playTime: 0 });

// 적에게 실제로 들어간 피해(넘친 피해 제외)를 by(동물 종류)의 몫으로 센다
export function credit(game, e, by, before) {
  const dealt = Math.max(0, before) - Math.max(0, e.hp);
  if (!(dealt > 0) || !by) return;
  game.stats.damage[by] = (game.stats.damage[by] ?? 0) + dealt;
  e.dealt ??= {};
  e.dealt[by] = (e.dealt[by] ?? 0) + dealt;
}

// 처치는 그 적에게 피해를 가장 많이 준 동물이 가져간다
// (마지막 한 방으로 정하면 계속 타는 불길·독이 처치를 거의 다 가져간다)
export function creditKill(game, e) {
  const top = Object.entries(e.dealt ?? {}).sort((a, b) => b[1] - a[1])[0];
  if (top) game.stats.kills[top[0]] = (game.stats.kills[top[0]] ?? 0) + 1;
}

const known = (id) => !!(TOWERS[id] || MYTHICS[id]);

// 저장에서 되살린 통계. 이상한 값은 버리고 빈 통계로 채운다
export function cleanStats(raw) {
  const s = emptyStats();
  if (!raw || typeof raw !== 'object') return s;
  const ok = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  for (const key of ['damage', 'kills']) {
    if (raw[key] && typeof raw[key] === 'object') for (const [id, v] of Object.entries(raw[key])) if (known(id) && ok(v)) s[key][id] = v;
  }
  if (ok(raw.leaked)) s.leaked = Math.floor(raw.leaked);
  if (ok(raw.playTime)) s.playTime = raw.playTime;
  return s;
}

const clock = (sec) => {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
};

// 결과 화면에 보여 줄 요약: 피해량 많은 순서의 동물 목록(비율·처치 수)과 처치·놓침·시간
export function resultStats(game) {
  const { damage, kills, leaked, playTime } = game.stats;
  const total = Object.values(damage).reduce((a, b) => a + b, 0);
  const ranking = Object.entries(damage)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, v]) => ({
      id, damage: v, share: total ? Math.round((v / total) * 1000) / 1000 : 0, kills: kills[id] ?? 0,
      mythic: !!MYTHICS[id], name: (MYTHICS[id] ?? TOWERS[id]).name, icon: MYTHICS[id]?.icon ?? TOWERS[id].emoji,
    }));
  return { ranking, kills: game.counters.kills, leaked, time: clock(playTime), mythics: game.counters.mythics, summons: game.summons };
}
