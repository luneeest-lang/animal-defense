// 도트 아이콘 굽기와 쓰기: HTML에는 <img>, 캔버스에는 그림으로 이모지 자리를 바꾼다
import { ICONS } from '../data/icons.js';
import { bakeAnimals, bakeMythics } from './pixel.js';
import { splitIcons, hasIcon } from './iconText.js';

const canvases = new Map();
const urls = new Map();

// 아이콘 이름 → 캔버스 (동물은 성체 그림, 신화는 신화 그림)
export function iconCanvas(name) {
  if (canvases.has(name)) return canvases.get(name);
  const [kind, id] = name.split(':');
  let c;
  if (kind === 'animal') c = bakeAnimals()[id][2];
  else if (kind === 'mythic') c = bakeMythics()[id];
  else {
    const d = ICONS[name];
    c = document.createElement('canvas');
    c.width = d.rows[0].length; c.height = d.rows.length;
    const ctx = c.getContext('2d');
    d.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = d.palette[ch];
      ctx.fillRect(x, y, 1, 1);
    }));
  }
  canvases.set(name, c);
  return c;
}

export function iconHTML(name, cls = '') {
  if (!urls.has(name)) urls.set(name, iconCanvas(name).toDataURL());
  return `<img class="px-icon${cls ? ` ${cls}` : ''}" src="${urls.get(name)}" alt="" aria-hidden="true" draggable="false">`;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 보통 글자 → 이모지를 아이콘으로 바꾼 HTML
export const richText = (text) => splitIcons(text).map((p) => (typeof p === 'string' ? escape(p) : iconHTML(p.icon))).join('');

// 우리가 만든 HTML 조각 안의 이모지만 아이콘으로 바꾼다
export const iconize = (html) => splitIcons(html).map((p) => (typeof p === 'string' ? p : iconHTML(p.icon))).join('');

// 노드 글자 바꾸기: 이모지가 있으면 아이콘을 넣고, 없으면 글자만. 같은 글자면 건드리지 않는다
export function setRich(node, text) {
  if (node.__rich === text) return;
  node.__rich = text;
  if (hasIcon(text)) node.innerHTML = richText(text);
  else node.textContent = text;
}

// 캔버스에 글자를 쓰되 이모지 자리에는 아이콘을 그린다 (가운데 정렬, 테두리 있는 글자용)
export function fillRichText(ctx, text, x, y, size, stroke = true) {
  const parts = splitIcons(text);
  if (parts.length === 1 && typeof parts[0] === 'string') {
    if (stroke) ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    return;
  }
  const iconW = size * 1.05;
  const widths = parts.map((p) => (typeof p === 'string' ? ctx.measureText(p).width : iconW));
  let cx = x - widths.reduce((a, b) => a + b, 0) / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  parts.forEach((p, i) => {
    if (typeof p === 'string') {
      if (stroke) ctx.strokeText(p, cx, y);
      ctx.fillText(p, cx, y);
    } else {
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(iconCanvas(p.icon), cx + (iconW - size) / 2, y - size / 2, size, size);
      ctx.imageSmoothingEnabled = smooth;
    }
    cx += widths[i];
  });
  ctx.textAlign = align;
}
