# 동물 타워 디펜스

동물 타워를 세워 길을 따라 오는 적을 막는 2D 타워 디펜스 게임입니다. 서버 없이 브라우저에서만 동작하는 정적 사이트이고, 외부 npm 패키지를 쓰지 않습니다.

설계 문서는 [docs/superpowers/specs/2026-10-25-tower-defense-design.md](docs/superpowers/specs/2026-10-25-tower-defense-design.md), 구현 계획은 [docs/superpowers/plans/2026-10-25-tower-defense.md](docs/superpowers/plans/2026-10-25-tower-defense.md)에 있습니다.

## 실행

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000/`을 엽니다. ES 모듈을 쓰기 때문에 `file://`로 직접 열면 동작하지 않습니다.

## 테스트

```bash
npm test
```

Node 18 이상이 필요합니다. `js/core`, `js/data`, `js/storage.js`의 게임 규칙을 검사합니다. 화면과 터치 조작은 자동 테스트가 없어서 브라우저에서 직접 확인합니다.

## 폴더 구조

- `js/core/`: 화면을 모르는 게임 규칙 (경로, 적, 타워, 웨이브, 한 판의 상태)
- `js/data/`: 맵, 타워, 적의 수치. 밸런스는 여기서만 조정합니다.
- `js/ui/`: 캔버스 그리기, 마우스·터치 입력, 화면 요소
- `js/storage.js`: 최고 기록 저장 (`localStorage`, 키 `td-save-v1`)
- `js/data/animals.js`, `sprites.js`, `tiles.js`: 동물 타워, 적, 맵 바닥의 16×16 도트 그림. 문자 하나가 도트 한 칸이고, 색은 `palette`에서 정합니다.

## 밸런스 메모

수치를 바꾸면 `tests/`에서 초기값을 고정한 테스트가 실패할 수 있습니다. 같은 커밋에서 테스트도 맞춰 주세요. 한 판은 약 10분을 목표로 합니다.

## 배포

`main`에 푸시하면 `.github/workflows/pages.yml`이 테스트를 통과한 경우에만 GitHub Pages로 배포합니다. 처음 한 번 저장소의 Settings > Pages에서 Source를 "GitHub Actions"로 설정하세요.

광고는 게임 화면 안에 넣지 않고, 맵 선택 화면과 결과창의 `.ad-slot` 자리에만 넣습니다. 광고 코드는 아직 들어 있지 않습니다.
