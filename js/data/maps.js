// 좌표는 칸 단위 [col, row]. 격자는 16x10.
// theme: 바닥 그림 종류 (meadow 초원, forest 숲, sea 바다)
export const MAPS = [
  {
    id: 'meadow',
    name: '초원',
    theme: 'meadow',
    cols: 16,
    rows: 10,
    waypoints: [[0, 2], [13, 2], [13, 6], [2, 6], [2, 9]],
    blocked: [[7, 4], [8, 4]],
  },
  {
    id: 'forest',
    name: '숲',
    theme: 'forest',
    cols: 16,
    rows: 10,
    waypoints: [[0, 1], [5, 1], [5, 8], [10, 8], [10, 3], [15, 3]],
    blocked: [[2, 4], [8, 5]],
  },
  {
    id: 'canyon',
    name: '바다',
    theme: 'sea',
    cols: 16,
    rows: 10,
    waypoints: [[0, 8], [3, 8], [3, 1], [8, 1], [8, 6], [12, 6], [12, 2], [15, 2]],
    blocked: [[5, 4], [10, 4]],
  },
];
