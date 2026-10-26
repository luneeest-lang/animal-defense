import { pointToCell } from '../core/path.js';

const DRAG_START_PX = 8;

// 마우스와 터치를 같은 포인터 이벤트로 처리한다.
// 짧게 누르면 탭(onTap), 일정 거리 이상 끌면 드래그(onDragStart → onDragMove → onDrop)로 본다.
export function attachInput(canvas, { cols, rows, onTap, onCancel, onDragStart, onDragMove, onDrop }) {
  let press = null;

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };
  const toCell = (p) => pointToCell(p.x, p.y, p.w, p.h, cols, rows);

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
