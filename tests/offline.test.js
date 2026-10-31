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
