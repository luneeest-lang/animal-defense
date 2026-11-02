// 게임 전체를 index.html 파일 하나로 합친다 (폴더째 올리기 어려운 곳, 예: 휴대폰에서 CrazyGames에 올릴 때).
// js는 esbuild로 하나로 묶어 넣고, css와 보스 글꼴(Creepster)은 파일 안에 그대로 넣는다.
// 사용: node tools/promo/single.mjs promo/tiny-mythic-squad-single/index.html
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(process.argv[2] ?? 'promo/tiny-mythic-squad-single/index.html');

const js = execFileSync('npx', ['--yes', 'esbuild@0.24.0', 'js/main.js', '--bundle', '--format=esm', '--target=es2022', '--minify'],
  { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString();
const font = readFileSync(resolve(root, 'css/fonts/creepster-latin.woff2')).toString('base64');
const css = readFileSync(resolve(root, 'css/style.css'), 'utf8')
  .replace("url('fonts/creepster-latin.woff2')", () => `url(data:font/woff2;base64,${font})`);
if (!css.includes('data:font/woff2')) throw new Error('글꼴 경로를 찾지 못함');

let html = readFileSync(resolve(root, 'index.html'), 'utf8');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`index.html에서 못 찾음: ${from}`);
  html = html.replace(from, () => to);
};
// CrazyGames에 올리는 파일이라 어느 주소에서 열려도 CrazyGames SDK를 쓴다 (js/platform.js)
swap('<html lang="ko">', '<html lang="ko" data-platform="crazygames">');
swap('  <link rel="preload" href="css/fonts/creepster-latin.woff2" as="font" type="font/woff2" crossorigin>\n', '');
swap('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);
swap('<script type="module" src="js/main.js"></script>', `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}</script>`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out, html.length, 'bytes');
