import { pointToCell } from '../core/path.js';

// 마우스와 터치를 같은 포인터 이벤트로 처리한다.
export function attachInput(canvas, { cols, rows, onCell, onCancel, onHover }) {
  const toCell = (e) => {
    const rect = canvas.getBoundingClientRect();
    return pointToCell(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, cols, rows);
  };

  const down = (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = toCell(e);
    if (cell) onCell(cell.col, cell.row);
    else onCancel();
  };
  const move = (e) => {
    if (e.pointerType === 'mouse') onHover(toCell(e));
  };
  const leave = () => onHover(null);

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerleave', leave);
  };
}
