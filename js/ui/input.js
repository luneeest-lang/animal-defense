import { pointToCell } from '../core/path.js';

const DRAG_START_PX = 8;

// 캔버스 위 점(CSS 픽셀)을 맵 칸으로 바꾼다. 밖이면 null.
// 세로 화면(캔버스가 세로로 김)에서는 맵이 90도 돌아가 있다: 맵의 왼쪽이 화면 위, 맵의 위쪽이 화면 오른쪽.
export function screenToCell(x, y, w, h, cols, rows) {
  if (h > w) return pointToCell(y, w - x, h, w, cols, rows);
  return pointToCell(x, y, w, h, cols, rows);
}

// 마우스와 터치를 같은 포인터 이벤트로 처리한다.
// 짧게 누르면 탭(onTap), 일정 거리 이상 끌면 드래그(onDragStart → onDragMove → onDrop)로 본다.
// boardRect()는 캔버스 안에서 맵이 놓인 자리를 돌려준다(맵 바깥 여백은 칸이 없다). 없으면 캔버스 전체가 맵이다.
export function attachInput(canvas, { cols, rows, boardRect, onTap, onCancel, onDragStart, onDragMove, onDrop }) {
  let press = null;

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };
  const toCell = (p) => {
    const b = boardRect ? boardRect() : { x: 0, y: 0, width: p.w, height: p.h };
    return screenToCell(p.x - b.x, p.y - b.y, b.width, b.height, cols, rows);
  };

  const down = (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = local(e);
    press = { start: p, cell: toCell(p), dragging: false };
    canvas.setPointerCapture?.(e.pointerId);
  };

  const move = (e) => {
    if (!press || !e.isPrimary) return;
    const p = local(e);
    if (!press.dragging && Math.hypot(p.x - press.start.x, p.y - press.start.y) >= DRAG_START_PX) {
      press.dragging = !!press.cell && onDragStart(press.cell.col, press.cell.row);
      if (!press.dragging) press.cell = null;
    }
    if (press.dragging) onDragMove(p.x, p.y);
  };

  const up = (e) => {
    if (!press || !e.isPrimary) return;
    const p = local(e);
    const cell = toCell(p);
    if (press.dragging) onDrop(cell);
    else if (press.cell && cell && cell.col === press.cell.col && cell.row === press.cell.row) onTap(cell.col, cell.row);
    else if (!press.cell && !cell) onCancel();
    press = null;
  };

  const cancel = () => {
    if (press && press.dragging) onDrop(null);
    press = null;
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
  };
}
