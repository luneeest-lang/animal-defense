// CrazyGames 등 웹게임 사이트 제출용 커버 3종을 만든다: 가로 1920x1080, 세로 800x1200, 정사각 800x800.
// 사용: (저장소에서 python3 -m http.server 8123 실행 뒤) node tools/promo/capture.cjs promo && node tools/promo/make.cjs promo
const { chromium } = require('playwright');
const out = process.argv[2] || 'promo';
const covers = [
  ['landscape', 1920, 1080, 'bg-forest.png'],
  ['portrait', 800, 1200, 'bg-sea.png'],
  ['square', 800, 800, 'bg-forest.png'],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [layout, w, h, bg] of covers) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto(`http://localhost:8123/tools/promo/cover.html?w=${w}&h=${h}&layout=${layout}&bg=/${out}/${bg}`);
    await p.waitForSelector('body[data-ready="1"]');
    await p.locator('#c').screenshot({ path: `${out}/cover-${layout}-${w}x${h}.png` });
    console.log('cover', layout, w, h);
  }
  await b.close();
})();
