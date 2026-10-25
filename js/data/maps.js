// 좌표는 칸 단위 [col, row]. 격자는 16x10.
export const MAPS = [
  {
    id: 'meadow',
    name: '초원',
    cols: 16,
    rows: 10,
    waypoints: [[0, 2], [13, 2], [13, 6], [2, 6], [2, 9]],
    blocked: [[7, 4], [8, 4]],
  },
  {
    id: 'forest',
    name: '숲',
    cols: 16,
    rows: 10,
    waypoints: [[0, 1], [5, 1], [5, 8], [10, 8], [10, 3], [15, 3]],
    blocked: [[2, 4], [8, 5]],
  },
  {
    id: 'canyon',
    name: '협곡',
    cols: 16,
    rows: 10,
    waypoints: [[0, 8], [3, 8], [3, 1], [8, 1], [8, 6], [12, 6], [12, 2], [15, 2]],
    blocked: [[5, 4], [10, 4]],
  },
];
