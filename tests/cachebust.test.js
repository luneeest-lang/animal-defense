import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampJs, stampHtml } from '../tools/cache-bust.mjs';

test('배포할 때 모든 상대 경로 import에 버전을 붙인다 (휴대폰이 예전 파일을 캐시에서 쓰지 않게)', () => {
  const src = "import { A } from './a.js';\nimport {\n  B,\n} from '../data/b.js';\nconst m = await import('/js/x.js');\nconst n = import('./c.js');\nimport x from 'https://cdn/x.js';\n";
  const out = stampJs(src, 'abc123');
  assert.match(out, /from '\.\/a\.js\?v=abc123'/);
  assert.match(out, /from '\.\.\/data\/b\.js\?v=abc123'/);
  assert.match(out, /import\('\.\/c\.js\?v=abc123'\)/);
  assert.match(out, /import\('\/js\/x\.js'\)/, '절대 경로는 그대로');
  assert.match(out, /'https:\/\/cdn\/x\.js'/, '외부 주소는 그대로');
  assert.equal(stampJs(out, 'abc123'), out, '두 번 붙이지 않는다');
});

test('index.html의 게임 스크립트와 스타일에도 버전을 붙인다', () => {
  const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">\n<link rel="stylesheet" href="css/style.css">\n<script type="module" src="js/main.js"></script>';
  const out = stampHtml(html, 'v9');
  assert.match(out, /href="css\/style\.css\?v=v9"/);
  assert.match(out, /src="js\/main\.js\?v=v9"/);
  assert.match(out, /family=X"/);
});
