# 웹게임 사이트 제출 자료 (CrazyGames 기준)

이 폴더의 파일과 아래 영어 문장을 그대로 제출 양식에 붙여 넣으면 돼요. 한국어는 설명용이에요.

## 파일

| 파일 | 용도 |
|---|---|
| `cover-landscape-1920x1080.png` | 가로 커버 (16:9) |
| `cover-portrait-800x1200.png` | 세로 커버 (2:3) |
| `cover-square-800x800.png` | 정사각 커버 (1:1) |
| `preview-1920x1080.mp4` | 미리보기 영상 18초, H.264, 약 11MB, 소리 없음 |
| `tiny-mythic-squad-web.zip` | 게임 파일 (index.html, css, js / 37개, 약 140KB) |

다시 만들기: 저장소에서 `python3 -m http.server 8123`을 켠 뒤
`node tools/promo/capture.cjs promo && node tools/promo/make.cjs promo` (커버),
`node tools/promo/video.cjs promo` 후 ffmpeg로 18초 mp4 변환 (영상),
`python3 tools/promo/package.py promo/tiny-mythic-squad-web.zip` (게임 묶음).

## 제목

**Tiny Mythic Squad**

## 짧은 설명 (한 줄)

Merge cute baby animals into legendary beasts and defend the black hole!

## 설명

Tiny Mythic Squad is a cozy-but-tactical merge tower defense. Summon random baby animals, drag two of the same animal together to grow them, and fuse awakened animals into mythic beasts from Korean folklore: the ground-shaking Haetae, the lightning-fast Girin, the nine-tailed Gumiho, the sky horse Cheonma and the blazing Phoenix.

Monsters march along the path toward a red black hole. Stop them across 30 waves on three maps (Rocky Hill, Forest, Sea), face six different bosses, pick a power-up card after each boss, and chase golden monsters and surprise missions for extra rewards.

Clear a map to earn collection cards that permanently power up your animals, then test your squad in Endless mode and beat your best wave.

Features:
- Random summon and merge: every merge is a little gamble
- 5 animals, 4 growth stages and 5 mythic beasts to fuse
- 3 maps, 6 bosses with unique abilities, 30 waves each
- Power-up cards, golden monsters and in-run missions
- Collection levels that make your favorite animals stronger
- Endless mode with a best-wave record for every map
- Plays on desktop and mobile, portrait or landscape

## 조작법 (Controls)

- Tap/click **Summon** to place a random baby animal.
- Drag an animal onto the same animal at the same stage to merge and grow it.
- Tap an animal to see its stats or sell it.
- Tap an animal's portrait in the side panel to upgrade that animal type.
- Open **Mythic** to fuse the required animals into a mythic beast.
- Keyboard: S = summon, Space = pause, M = mythic list, 1/2/3 = pick a card, Esc = close.

## 장르·태그 (Category / Tags)

- Category: Strategy (Tower Defense)
- Tags: tower defense, merge, animals, pixel, strategy, casual, mobile, mythology, endless

## 제출 전에 확인할 것 (한국어)

1. **사이트 규격 확인**: 이 환경에서는 CrazyGames 개발자 문서(docs.crazygames.com)에 접속이 막혀 있어서, 커버 크기(1920x1080, 800x1200, 800x800)는 널리 쓰이는 규격으로 만들었어요. 제출 화면에 다른 크기가 적혀 있으면 알려 주세요. 다시 만들어 드릴게요. 검색으로 확인된 규칙은 커버 3종(가로·세로·정사각)과 영상 15~20초·50MB 이하예요.
2. **외부 요청 없음**: 보스 경고 글꼴(Creepster)도 게임 안(`css/fonts/`)에 넣었어요. 게임은 외부 주소를 전혀 불러오지 않아요. 글꼴 사용 허가서(SIL Open Font License)는 `css/fonts/OFL.txt`에 함께 있어요.
3. **광고 SDK**: 아직 넣지 않았어요. CrazyGames는 광고 없는 기본 공개로 먼저 올리고, 지표가 좋으면 정식 공개 때 SDK를 붙이는 방식이에요.
4. **저장**: 기록과 도감은 브라우저 저장소(localStorage)에 저장돼요.
