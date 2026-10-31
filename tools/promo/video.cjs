// 미리보기 영상: 1920x1080, 영어 화면. 신화 동물 판에서 소환·웨이브·보스를 2배속으로 약 20초 녹화한다.
// 사용: (저장소에서 python3 -m http.server 8123 실행 뒤) node tools/promo/video.cjs <출력 폴더>
// 녹화(webm)는 ffmpeg로 18초 mp4(H.264)로 바꾼다.
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || 'promo';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'en-US', viewport: { width: 1920, height: 1080 }, recordVideo: { dir: `${out}/_rec`, size: { width: 1920, height: 1080 } } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8123/');
  await p.evaluate(async () => {
    const { MAPS } = await import('/js/data/maps.js');
    const { createGame, summonTower } = await import('/js/core/game.js');
    const { snapshotGame } = await import('/js/core/snapshot.js');
    let seed = 5; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const g = createGame(MAPS[1]); g.gold = 1e6;
    const army = [['haetae', 0, 1], ['phoenix', 0, 1], ['gumiho', 0, 1], ['cheonma', 0, 1], ['girin', 0, 1], ['eagle', 3], ['squirrel', 3], ['snake', 2], ['penguin', 2], ['elephant', 1]];
    for (const [type, level, mythic] of army) { const t = summonTower(g, rng); Object.assign(t, { type, level: mythic ? 0 : level }, mythic ? { mythic: true } : {}); }
    Object.assign(g, { gold: 900, lives: 20, waveNumber: 13, clearedWave: 13, countdown: 1 });
    g.schedule = { golden: [], missions: [] };
    localStorage.setItem('td-save-v1', JSON.stringify({ version: 1, unlocked: 3, records: { meadow: { bestWave: 30, stars: 3 } } }));
    localStorage.setItem('td-run-v1', JSON.stringify(snapshotGame(g)));
  });
  await p.reload();
  await p.waitForTimeout(1500); // 메뉴
  await p.click('#btn-continue');
  await p.waitForTimeout(500);
  await p.click('#btn-speed');
  await p.click('#btn-wave');
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(700); if (await p.locator('#btn-summon').isEnabled()) await p.click('#btn-summon'); }
  // 웨이브 14를 깨면 15(보스)를 바로 시작
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(300);
    if (await p.locator('#btn-wave').isEnabled()) { await p.click('#btn-wave'); break; }
  }
  await p.waitForTimeout(9000);
  await ctx.close();
  const rec = fs.readdirSync(`${out}/_rec`).find((f) => f.endsWith('.webm'));
  fs.renameSync(`${out}/_rec/${rec}`, `${out}/_raw.webm`);
  fs.rmSync(`${out}/_rec`, { recursive: true });
  await b.close();
})();
