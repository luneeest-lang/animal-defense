// 맵(16x10칸)을 주어진 자리(CSS 픽셀)에 비율을 지켜 최대한 크게 맞춘다.
// 자리가 세로로 길면 맵을 90도 돌려(10:16) 그린다. 결과는 항상 자리 안에 들어간다.
const MAX_WIDTH = { landscape: 1100, portrait: 560 };

export function fitBoard(availWidth, availHeight) {
  const portrait = availHeight > availWidth;
  const ratio = portrait ? 10 / 16 : 16 / 10; // 가로 / 세로
  const width = Math.floor(Math.min(availWidth, availHeight * ratio, portrait ? MAX_WIDTH.portrait : MAX_WIDTH.landscape));
  return { width: Math.max(0, width), height: Math.max(0, Math.floor(width / ratio)), portrait };
}
