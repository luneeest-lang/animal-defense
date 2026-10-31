// 홍보용 장면 찍기: 동물·신화가 깔린 판을 이어하기로 열고 웨이브를 시작해 맵(#board)만 찍는다.
// 사용: (저장소에서 python3 -m http.server 8123 실행 뒤) node tools/promo/capture.cjs <출력 폴더>
// 이 컨테이너에 미리 깔린 Playwright를 쓴다.
const { chromium } = require('playwright');
const out = process.argv[2] || 'promo';

async function scene(b, { mapIndex, waveNumber, wait, file, viewport, dpr = 1, towers }) {
  const ctx = await b.newContext({ locale: 'en-US', viewport, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8123/');
  await p.evaluate(async ({ mapIndex, waveNumber, towers }) => {
    const { MAPS } = await import('/js/data/maps.js');
    const { createGame, summonTower } = await import('/js/core/game.js');
    const { snapshotGame } = await import('/js/core/snapshot.js');
    let seed = 11; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const g = createGame(MAPS[mapIndex]); g.gold = 1e6;
    for (const [type, level, mythic] of towers) {
      const t = summonTower(g, rng);
      if (!t) break;
      Object.assign(t, { type, level: mythic ? 0 : level }, mythic ? { mythic: true } : {});
    }
    Object.assign(g, { gold: 1234, lives: 20, waveNumber, clearedWave: waveNumber, countdown: 1 });
    g.schedule = { golden: [], missions: [] };
    localStorage.setItem('td-save-v1', JSON.stringify({ version: 1, unlocked: 3, records: { meadow: { bestWave: 30, stars: 3 } } }));
    localStorage.setItem('td-run-v1', JSON.stringify(snapshotGame(g)));
  }, { mapIndex, waveNumber, towers });
  await p.reload();
  await p.click('#btn-continue');
  if (wait) {
    await p.click('#btn-wave');
    await p.waitForTimeout(wait);
  } else {
    await p.waitForTimeout(400); // 웨이브 전: 효과 글자 없는 차분한 장면 (커버 배경용)
  }
  await p.locator('#board').screenshot({ path: `${out}/${file}` });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  const army = [
    ['haetae', 0, true], ['phoenix', 0, true], ['gumiho', 0, true], ['cheonma', 0, true], ['girin', 0, true],
    ['squirrel', 3], ['eagle', 3], ['penguin', 2], ['elephant', 2], ['snake', 3], ['squirrel', 1], ['eagle', 1], ['penguin', 0],
  ];
  await scene(b, { mapIndex: 1, waveNumber: 14, wait: 0, file: 'bg-forest.png', viewport: { width: 1920, height: 1080 }, towers: army });
  await scene(b, { mapIndex: 2, waveNumber: 14, wait: 0, file: 'bg-sea.png', viewport: { width: 1920, height: 1080 }, towers: army });
  await b.close();
})();
