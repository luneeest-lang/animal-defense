import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 웹게임 사이트는 외부 요청을 막을 수 있으므로 게임이 쓰는 파일은 모두 게임 안에 있어야 한다
test('index.html과 css는 외부 주소(http)를 불러오지 않는다', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(!/(src|href)="https?:/i.test(html), 'index.html에 외부 주소');
  const css = fs.readFileSync('css/style.css', 'utf8');
  assert.ok(!/url\(\s*['"]?https?:/i.test(css), 'style.css에 외부 주소');
  assert.ok(!/@import/i.test(css), 'style.css에 @import');
});

test('보스 경고 글꼴(Creepster)은 게임 안의 파일을 쓰고, 사용 허가서도 함께 있다', () => {
  const css = fs.readFileSync('css/style.css', 'utf8');
  const m = css.match(/@font-face\s*{[^}]*font-family:\s*['"]Creepster['"][^}]*url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  assert.ok(m, 'Creepster @font-face 없음');
  assert.ok(fs.existsSync(`css/${m[1]}`), `글꼴 파일 없음: css/${m[1]}`);
  assert.ok(fs.readFileSync('css/fonts/OFL.txt', 'utf8').includes('SIL Open Font License'));
});

// 보스 경고의 'BOSS' 글자가 거의 사라졌다 다시 나타나면 경고가 두 번 뜨는 것처럼 보인다(2026-11-01 신고)
test('BOSS 글자 깜빡임은 은은하다 (글자가 70% 아래로 흐려지지 않는다)', () => {
  const css = fs.readFileSync('css/style.css', 'utf8');
  const block = css.match(/@keyframes boss-flicker\s*{([^}]*(?:}[^}]*)*?)}\s*\n/);
  assert.ok(block, 'boss-flicker 없음');
  const values = [...block[1].matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(values.length > 0);
  assert.ok(Math.min(...values) >= 0.7, `가장 흐릴 때 ${Math.min(...values)}`);
});

// 보스 글꼴을 경고가 뜰 때 처음 받으면 폰에서 얇은 기본 글꼴이 먼저 보였다가 바뀐다(2026-11-02 신고)
test('보스 글꼴은 게임을 열 때 미리 받고, 받는 중에는 다른 글꼴로 대신 보여 주지 않는다', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /<link rel="preload" href="css\/fonts\/creepster-latin\.woff2" as="font" type="font\/woff2" crossorigin>/);
  const css = fs.readFileSync('css/style.css', 'utf8');
  const face = css.match(/@font-face\s*{[^}]*Creepster[^}]*}/)[0];
  assert.match(face, /font-display:\s*block/);
});
