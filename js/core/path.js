const cellKey = (col, row) => `${col},${row}`;

export function waypointPoints(map) {
  return map.waypoints.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
}

function segmentLength(a, b) {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += segmentLength(points[i - 1], points[i]);
  return total;
}

export function positionAt(points, dist) {
  if (dist <= 0) return { x: points[0].x, y: points[0].y };
  let left = dist;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = segmentLength(a, b);
    if (left <= len) {
      const t = left / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= len;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

export function pathCells(map) {
  const cells = new Set();
  for (let i = 1; i < map.waypoints.length; i++) {
    const [c0, r0] = map.waypoints[i - 1];
    const [c1, r1] = map.waypoints[i];
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
      for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) cells.add(cellKey(c, r));
    }
  }
  return cells;
}

export function canBuild(map, col, row, occupied) {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return false;
  const key = cellKey(col, row);
  if (occupied.has(key)) return false;
  if (pathCells(map).has(key)) return false;
  return !map.blocked.some(([c, r]) => c === col && r === row);
}

export function pointToCell(px, py, width, height, cols, rows) {
  if (px < 0 || py < 0 || px >= width || py >= height) return null;
  return { col: Math.floor((px / width) * cols), row: Math.floor((py / height) * rows) };
}
