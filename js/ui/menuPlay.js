// 첫 화면의 큰 PLAY 버튼이 어느 맵을 시작할지 정한다.
// 열린 맵 중 아직 별이 없는(깨지 못한) 첫 맵, 다 깼으면 마지막으로 열린 맵.
import { MAPS } from '../data/maps.js';

// 첫 화면에 늘어설 신수 다섯 (왼쪽부터)
export const HERO_LINEUP = ['cheonma', 'phoenix', 'haetae', 'gumiho', 'girin'];

export function playTarget(save) {
  const open = MAPS.slice(0, Math.max(1, save.unlocked ?? 1));
  const todo = open.find((m) => !(save.records?.[m.id]?.stars > 0));
  return (todo ?? open.at(-1)).id;
}
