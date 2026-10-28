// 좌표는 칸 단위 [col, row]. 격자는 16x10.
// name: 난이도 이름, place: 메뉴에 함께 보여주는 배경 이름
// theme: 바닥 그림 종류 (mountain 돌산, forest 숲, sea 바다)
// hpMult: 이 맵 몬스터의 체력 배율 (난이도), bossAbilities: 보스 고유 능력을 쓰는지
// id는 저장 기록의 키라서 이름이나 테마가 바뀌어도 그대로 둔다
export const MAPS = [
  {
    id: 'meadow',
    name: '초급',
    place: '돌산',
    theme: 'mountain',
    hpMult: 1,
    bossAbilities: false,
    cols: 16,
    rows: 10,
    waypoints: [[0, 2], [13, 2], [13, 6], [2, 6], [2, 9]],
    blocked: [[7, 4], [8, 4]],
  },
  {
    id: 'forest',
    name: '중급',
    place: '숲',
    theme: 'forest',
    hpMult: 1.4,
    bossAbilities: true,
    cols: 16,
    rows: 10,
    waypoints: [[0, 1], [5, 1], [5, 8], [10, 8], [10, 3], [15, 3]],
    blocked: [[2, 4], [8, 5]],
  },
  {
    id: 'canyon',
    name: '고급',
    place: '바다',
    theme: 'sea',
    hpMult: 2.0,
    bossAbilities: true,
    cols: 16,
    rows: 10,
    waypoints: [[0, 8], [3, 8], [3, 1], [8, 1], [8, 6], [12, 6], [12, 2], [15, 2]],
    blocked: [[5, 4], [10, 4]],
  },
];
