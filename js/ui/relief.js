import { pathCells } from '../core/path.js';

// 맵을 단차 블록으로 보이게 하는 규칙. 계산은 화면 기준(i: 오른쪽, j: 아래쪽)이라
// 세로 화면에서 맵을 돌려도 벽은 항상 화면 아래를, 빛은 항상 왼쪽 위를 향한다.

// 화면 격자의 크기와, 화면 칸(i, j)이 맵의 어느 칸(c, r)인지
export function screenGrid(map, rotated) {
  if (!rotated) return { cols: map.cols, rows: map.rows, cellAt: (i, j) => [i, j] };
  // 돌린 화면: 화면 x = 맵 세로 길이 - 맵 y, 화면 y = 맵 x
  return { cols: map.rows, rows: map.cols, cellAt: (i, j) => [j, map.rows - 1 - i] };
}

// 칸마다 높은지와, 어느 쪽에 벽·그림자·테두리를 그릴지
export function reliefCells(map, rotated) {
  const grid = screenGrid(map, rotated);
  const path = pathCells(map);
  // 돌산과 숲은 땅이 높고 길이 파여 있다. 바다는 판자 다리가 물 위로 솟아 있다
  const roadHigh = map.theme === 'sea';
  const high = (i, j) => {
    const [c, r] = grid.cellAt(i, j);
    return path.has(`${c},${r}`) === roadHigh;
  };
  // 맵 밖은 같은 높이로 봐서 가장자리에 벽이 생기지 않게 한다
  const around = (i, j, di, dj, self) => {
    const ni = i + di;
    const nj = j + dj;
    return ni < 0 || nj < 0 || ni >= grid.cols || nj >= grid.rows ? self : high(ni, nj);
  };
  const cells = [];
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const h = high(i, j);
      const up = around(i, j, 0, -1, h);
      const down = around(i, j, 0, 1, h);
      const left = around(i, j, -1, 0, h);
      const right = around(i, j, 1, 0, h);
      cells.push({
        i, j, high: h,
        wallTop: !h && up, // 위 블록의 앞면 벽이 이 칸 위쪽에 보인다
        shadeLeft: !h && left, // 왼쪽 블록이 드리운 그림자
        edgeRight: !h && right, // 오른쪽 블록의 어두운 옆 모서리
        lipBottom: !h && down, // 아래 블록의 윗 모서리
        rimBottom: h && !down, // 높은 칸이 아래로 떨어지는 모서리
        rimTop: h && !up, // 빛을 받는 위 모서리
        rimLeft: h && !left,
      });
    }
  }
  return cells;
}
