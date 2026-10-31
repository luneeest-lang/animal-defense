# 웹게임 사이트에 올릴 게임 파일 묶음(zip)을 만든다: index.html, css, js만 담는다.
# 사용: python3 tools/promo/package.py promo/tiny-mythic-squad-web.zip
import sys
import zipfile
from pathlib import Path

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'promo/tiny-mythic-squad-web.zip')
root = Path(__file__).resolve().parents[2]
files = [root / 'index.html', *sorted((root / 'css').rglob('*')), *sorted((root / 'js').rglob('*'))]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        if f.is_file():
            z.write(f, f.relative_to(root).as_posix())
print(out, out.stat().st_size, 'bytes,', sum(1 for f in files if f.is_file()), 'files')
