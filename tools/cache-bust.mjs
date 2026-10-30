// 배포할 때(.github/workflows/pages.yml) 게임 파일 주소에 버전(?v=커밋)을 붙인다.
// 브라우저와 GitHub Pages가 js·css를 캐시해 두어서, 업데이트 뒤에도 휴대폰이 한동안 예전 파일을 쓰는 일을 막는다.
// 사용: node tools/cache-bust.mjs <사이트 폴더> <버전>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// './x.js', '../x/y.js' 같은 상대 경로 import만 바꾼다 (이미 ?v=가 붙었으면 그대로)
const REL = /((?:\bfrom\s*|\bimport\s*\(\s*)')(\.{1,2}\/[^'?]+\.js)'/g;
export const stampJs = (src, ver) => src.replace(REL, (_, head, file) => `${head}${file}?v=${ver}'`);

const LOCAL = /((?:src|href)=")((?:js|css)\/[^"?]+\.(?:js|css))"/g;
export const stampHtml = (html, ver) => html.replace(LOCAL, (_, head, file) => `${head}${file}?v=${ver}"`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [site, ver] = process.argv.slice(2);
  if (!site || !ver) throw new Error('사용: node tools/cache-bust.mjs <사이트 폴더> <버전>');
  for (const file of walk(site)) {
    if (file.endsWith('.js')) fs.writeFileSync(file, stampJs(fs.readFileSync(file, 'utf8'), ver));
    else if (file.endsWith('.html')) fs.writeFileSync(file, stampHtml(fs.readFileSync(file, 'utf8'), ver));
  }
  console.log(`버전 ${ver}을 붙였다`);
}
