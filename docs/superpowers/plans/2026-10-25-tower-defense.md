# 동물 타워 디펜스 게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 바로 하는 2D 경로형 타워 디펜스(맵 3, 동물 타워 5종, 적 5종 + 보스, 웨이브 15)를 별도 저장소에 만들어 GitHub Pages로 배포한다.

**Architecture:** 화면을 모르는 순수 로직(`js/core`, `js/data`, `js/storage.js`)과 화면(`js/ui`)을 분리한다. 로직은 `node --test`로 TDD하고, 화면은 Playwright로 직접 확인한다. 빌드 도구 없이 브라우저가 ES 모듈을 직접 불러온다.

**Tech Stack:** 순수 JavaScript(ES 모듈), Canvas, SVG, Node 18+의 `node:test`, GitHub Actions + Pages. 외부 npm 패키지 없음.

**Spec:** `docs/superpowers/specs/2026-10-25-tower-defense-design.md`

## Global Constraints

- 외부 npm 패키지와 빌드 단계를 쓰지 않는다. Node 18 이상.
- 좌표 단위는 "칸"이다. 맵은 16×10칸, 칸 (col,row)의 중심은 `(col+0.5, row+0.5)`. 길이는 칸, 시간은 초.
- 시작 생명 20, 시작 골드 150, 판매 환급 = 투자 총액의 70%(내림), 웨이브 15개, 보스는 웨이브 5·10·15, 보스가 끝까지 가면 생명 5 감소(나머지 1).
- 파일 경로는 모두 상대 경로(하위 주소 `/<저장소 이름>/`에서 동작).
- 저장 키는 `td-save-v1`, 저장 실패 시에도 게임은 동작한다.
- 게임 화면 안에는 광고를 넣지 않는다(맵 선택·결과창에 빈 자리 `.ad-slot`만).
- 수치는 초기값이며 `js/data/`에서만 바꾼다.

## Review Focus

사용자가 실제로 만나기 쉬운 순서이며, 각 줄의 테스트는 해당 Task에 들어 있다.

1. 길·장애물·이미 타워가 있는 칸·격자 밖을 눌러도 설치되지 않고 골드가 그대로다 (Task 1, 5).
2. 골드가 모자라거나 최대 레벨(3)인 타워의 업그레이드는 거절되고 골드가 그대로다 (Task 3, 5).
3. 탭을 오래 떠났다 돌아와 `dt`가 매우 커도 적이 순간이동하거나 건너뛰지 않는다 (Task 5, 8).
4. `localStorage`가 깨진 JSON, 엉뚱한 모양, 다른 버전이거나 접근 시 예외를 던져도 기본값으로 시작한다 (Task 6).
5. 다음 웨이브 버튼을 연달아 두 번 눌러도 웨이브가 한 번만 시작되고 보너스도 한 번만 준다 (Task 5).

---

## 파일 구조

```
index.html  css/style.css  assets/animals/{squirrel,elephant,penguin,eagle,snake}.svg
js/main.js
js/core/{path,enemies,towers,waves,game}.js
js/data/{maps,enemies,towers}.js
js/ui/{render,input,hud}.js
js/storage.js
tests/*.test.js   package.json   .github/workflows/pages.yml
```

---

### Task 1: 저장소 준비와 맵·경로 로직

**Files:**
- Create: `package.json`(`"type":"module"`, `"scripts":{"test":"node --test \"tests/**/*.test.js\""}`), `.gitignore`, `README.md`
- Create: `js/data/maps.js`, `js/core/path.js`
- Test: `tests/path.test.js`

**Interfaces:**
- Produces:
  - `MAPS: {id:string,name:string,cols:16,rows:10,waypoints:[number,number][],blocked:[number,number][]}[]` (3개)
  - `waypointPoints(map): {x:number,y:number}[]` (칸 중심 좌표)
  - `pathLength(points): number`, `positionAt(points, dist): {x,y}` (끝을 넘으면 마지막 점)
  - `pathCells(map): Set<string>` (`"col,row"`, 모든 선분 위의 칸)
  - `canBuild(map, col, row, occupied: Set<string>): boolean`
  - `pointToCell(px, py, width, height, cols, rows): {col,row}|null` (캔버스 픽셀 → 칸, 밖이면 null)

- [ ] **Step 0: 저장소 확인.** 새 저장소 이름과 공개 여부를 사용자에게 확인받고 만든 뒤 세션에 추가한다(`add_repo`, push 권한). 확인 전에는 이 Task를 시작하지 않는다. 이후 모든 경로는 새 저장소 기준이다.
- [ ] **Step 1: 실패하는 테스트 작성** (`tests/path.test.js`, `node:assert/strict`)
  - `MAPS`는 3개이고 id는 `meadow`, `forest`, `canyon`
  - 각 맵: 모든 웨이브포인트가 격자 안, 인접한 두 점은 가로 또는 세로로만 이어지고 서로 다름, `blocked` 칸이 `pathCells`와 겹치지 않음
  - `pathLength(waypointPoints(meadow))` = 13 + 4 + 11 + 3 = 31
  - `positionAt(points, 0)` = `{x:0.5,y:2.5}`, `positionAt(points, 13)` = `{x:13.5,y:2.5}`, `positionAt(points, 15)` = `{x:13.5,y:4.5}`, `positionAt(points, 999)` = 마지막 점
  - `canBuild(meadow, 5, 2, new Set())` = false(길), `(7,4)` = false(장애물), `(-1,0)` = false, `(16,0)` = false, `(5,4)` = true, 점유 집합에 `"5,4"`가 있으면 false
  - `pointToCell(160, 100, 320, 200, 16, 10)` = `{col:8,row:5}`, `pointToCell(-1, 5, 320, 200, 16, 10)` = null, `pointToCell(320, 5, ...)` = null
- [ ] **Step 2: 실행해 실패 확인.** `npm test` → FAIL (모듈 없음)
- [ ] **Step 3: 구현.** `maps.js`의 웨이브포인트(칸 좌표 `[col,row]`)와 장애물:
  - `meadow`: `[[0,2],[13,2],[13,6],[2,6],[2,9]]`, blocked `[[7,4],[8,4]]`
  - `forest`: `[[0,1],[5,1],[5,8],[10,8],[10,3],[15,3]]`, blocked `[[2,4],[8,5]]`
  - `canyon`: `[[0,8],[3,8],[3,1],[8,1],[8,6],[12,6],[12,2],[15,2]]`, blocked `[[5,4],[10,4]]`
  - 이름은 각각 초원, 숲, 협곡. `path.js`는 위 시그니처대로 구현한다.
- [ ] **Step 4: 실행해 통과 확인.** `npm test` → PASS
- [ ] **Step 5: 커밋** `git add . && git commit -m "feat: add maps and path logic"`

---

### Task 2: 적 데이터와 적 로직

**Files:**
- Create: `js/data/enemies.js`, `js/core/enemies.js`
- Test: `tests/enemies.test.js`

**Interfaces:**
- Consumes: `positionAt`, `pathLength` (Task 1)
- Produces:
  - `ENEMIES: Record<id, {hp,speed,reward,leak,directMult?:number,splitInto?:{type:string,count:number}}>` — id는 `soldier, runner, tank, shield, splitter, mini, boss`
  - `hpScale(waveNumber): number` = `1 + 0.15*(waveNumber-1)`
  - `createEnemy(id: number, type: string, waveNumber: number): Enemy` — `{id,type,waveNumber,hp,maxHp,dist:0,slow:null,poison:null}`
  - `damageEnemy(e: Enemy, amount: number, kind: 'direct'|'poison'): void` — `direct`는 `directMult`(기본 1)를 곱한다
  - `applySlow(e, factor, duration)`, `applyPoison(e, dps, duration)` — 더 강한(낮은 factor, 높은 dps) 효과로만 덮어쓰고 지속시간은 갱신
  - `stepEnemy(e: Enemy, dt: number): void` — 효과 만료 처리, 독 피해, 이동(`speed * slowFactor * dt`)

- [ ] **Step 1: 실패하는 테스트 작성**
  - 기본값: soldier hp 40 speed 1.0 reward 5 leak 1 / runner hp 25 speed 2.0 reward 6 / tank hp 160 speed 0.6 reward 12 / shield hp 80 speed 0.9 reward 9 `directMult` 0.5 / splitter hp 60 speed 1.0 reward 8 `splitInto {type:'mini',count:2}` / mini hp 20 speed 1.4 reward 2 / boss hp 1500 speed 0.5 reward 100 leak 5
  - `createEnemy(1,'soldier',1).hp === 40`, `createEnemy(1,'soldier',11).hp === 100`
  - 방패병에 `damageEnemy(e,10,'direct')` → hp 5 감소, `'poison'` → 10 감소
  - `applySlow(e,0.5,2)` 후 `stepEnemy(e,1)` → `dist` 0.5(soldier), 3초 뒤에는 정상 속도로 돌아옴
  - `applyPoison(e,6,3)` 후 `stepEnemy(e,1)` 두 번 → hp 12 감소, 3초가 지나면 더 줄지 않음
  - 약한 슬로우(0.8)를 강한 슬로우(0.5) 위에 걸어도 factor는 0.5 유지
- [ ] **Step 2: 실행해 실패 확인.** `node --test tests/enemies.test.js` → FAIL
- [ ] **Step 3: 구현** 위 시그니처대로. 효과는 `{factor|dps, left}` 형태로 두고 `left`를 줄여 만료시킨다.
- [ ] **Step 4: 실행해 통과 확인** → PASS
- [ ] **Step 5: 커밋** `git commit -am "feat: add enemy data and logic"` (새 파일은 `git add`)

---

### Task 3: 타워 데이터와 타워 로직

**Files:**
- Create: `js/data/towers.js`, `js/core/towers.js`
- Test: `tests/towers.test.js`

**Interfaces:**
- Consumes: `damageEnemy`, `applySlow`, `applyPoison`, `positionAt` (Task 1, 2)
- Produces:
  - `TOWERS: Record<id, {name,emoji,cost,kind:'single'|'splash'|'slow'|'poison',base:{damage,range,cooldown,splash?,slowFactor?,slowDuration?,poisonDps?,poisonDuration?,bossMult?}}>` — id는 `squirrel, elephant, penguin, eagle, snake`
  - `MAX_LEVEL = 3`
  - `towerStats(type: string, level: number): Stats` — 레벨마다 damage ×1.5, cooldown ×0.9, range +0.2, `poisonDps` ×1.2, `slowFactor` ×0.9 (하한 0.3)
  - `upgradeCost(type: string, level: number): number|null` = `round(cost * [0.8, 1.4, 2.2][level])`, `level >= 3`이면 null
  - `findTarget(tower: Tower, enemies: Enemy[], points): Enemy|null` — 사거리 안에서 `dist`가 가장 큰 적
  - `fire(tower, target, enemies, points): Enemy[]` — 효과 적용 후 맞은 적 목록 반환(범위 타워는 대상 주변 반경 `splash` 안의 모든 적)
- Tower 모양: `{id,type,col,row,level,cooldown,invested}`

기본값(레벨 0):

| id | cost | kind | damage | range | cooldown | 기타 |
|---|---|---|---|---|---|---|
| squirrel | 50 | single | 8 | 2.5 | 0.5 | |
| elephant | 90 | splash | 20 | 2.2 | 1.6 | splash 1.0 |
| penguin | 70 | slow | 3 | 2.4 | 0.9 | slowFactor 0.6, slowDuration 1.5 |
| eagle | 120 | single | 50 | 4.5 | 1.8 | bossMult 1.5 |
| snake | 80 | poison | 2 | 2.5 | 1.2 | poisonDps 6, poisonDuration 3 |

- [ ] **Step 1: 실패하는 테스트 작성**
  - `towerStats('squirrel',0).damage === 8`, `(…,2).damage === 18`, `(…,3).range` ≈ 3.1
  - `upgradeCost('squirrel',0) === 40`, `('squirrel',2) === 110`, `('squirrel',3) === null`
  - `towerStats('penguin',3).slowFactor`는 0.3 이상
  - `findTarget`: 사거리 안 두 적 중 `dist`가 큰 쪽, 사거리 밖만 있으면 null, 빈 배열이면 null
  - `fire` squirrel → 대상 hp 8 감소, elephant → 대상 반경 1.0 안의 적 둘 다 20 감소하고 밖의 적은 그대로, penguin → 대상에 slow 적용, snake → 대상에 poison 적용, eagle → boss에는 75 감소
- [ ] **Step 2: 실행해 실패 확인** → FAIL
- [ ] **Step 3: 구현** 위 시그니처대로. 적 위치는 `positionAt(points, e.dist)`, 거리는 타워 중심 `(col+0.5,row+0.5)` 기준 유클리드.
- [ ] **Step 4: 실행해 통과 확인** → PASS
- [ ] **Step 5: 커밋** `feat: add tower data and logic`

---

### Task 4: 웨이브

**Files:**
- Create: `js/core/waves.js`
- Test: `tests/waves.test.js`

**Interfaces:**
- Consumes: `ENEMIES` (Task 2)
- Produces:
  - `buildWaves(): Wave[]` — 길이 15, `Wave = {number, groups:{type,count,interval}[]}`
  - `spawnSchedule(wave: Wave): {at:number,type:string}[]` — `at`은 웨이브 시작 후 초, 오름차순. 그룹은 차례로 나오고 그룹 사이 간격은 2초.

규칙: soldier는 1웨이브부터 `6 + 2*(n-1)`마리(간격 1.0). 새 종류 등장 웨이브: runner 3, splitter 4, tank 6, shield 8. 등장 후 마릿수는 종류별 시작값(runner 5, splitter 3, tank 2, shield 3)에 웨이브마다 +1(탱크는 +0.5 올림). 보스는 5·10·15웨이브에만 1마리(앞에 병사만 소수). 간격은 runner 0.6, splitter 1.2, tank 2.0, shield 1.5, boss 3.0.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `buildWaves().length === 15`, 각 `number`는 1..15
  - `boss`가 들어 있는 웨이브 번호는 정확히 `[5,10,15]`이고 각각 1마리
  - 처음 등장 웨이브: runner 3, splitter 4, tank 6, shield 8
  - 모든 웨이브가 비어 있지 않고, 모든 `type`이 `ENEMIES`에 존재(`mini` 제외)
  - `spawnSchedule`은 `at`이 오름차순이고 길이가 `sum(count)`, 첫 항목 `at === 0`
  - 1웨이브 병사 6마리, 15웨이브 병사 34마리
- [ ] **Step 2: 실행해 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인** → PASS
- [ ] **Step 5: 커밋** `feat: add wave schedule`

---

### Task 5: 한 판의 게임 상태

**Files:**
- Create: `js/core/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: Task 1~4 전부
- Produces (`game.js`):
  - `CONFIG = {startLives:20,startGold:150,sellRate:0.7,firstCountdown:10,waveGap:15,maxSubstep:0.05}`
  - `createGame(map, waves = buildWaves()): Game` — `{map,points,waves,gold,lives,waveNumber:0,countdown:10,spawnQueue:[],enemies:[],towers:[],events:[],status:'running'|'won'|'lost',time:0,nextId:1}`
  - `placeTower(game, typeId, col, row): Tower|null`
  - `upgradeTower(game, towerId): boolean`
  - `sellTower(game, towerId): number` — 환급액(없으면 0)
  - `callNextWave(game): number` — 보너스 골드(`ceil(countdown)`). `countdown`이 null(스폰 중)이거나 15웨이브를 이미 시작했거나 `status !== 'running'`이면 0이며 아무 일도 하지 않음
  - `step(game, dt): void` — `dt`를 `maxSubstep` 이하로 쪼개 반복 처리: 카운트다운 → 스폰 → 적 이동·효과 → 타워 발사(`cooldown` 감소) → 처치 보상(`reward`, 분열체는 같은 `dist`에 `splitInto` 생성) → 끝에 도달하면 `lives -= leak`(보상 없음) → 승패 판정
  - `game.events`: 매 `step` 시작 때 비우고 `{type:'shot',from:{x,y},to:{x,y},tower:string}`, `{type:'death',x,y}`를 쌓음(화면용)
- 웨이브 진행: 시작 시 `countdown=10`. 0이 되거나 `callNextWave`가 불리면 `waveNumber += 1`, `spawnSchedule`을 `spawnQueue`로 옮기고 `countdown=null`. 마지막 스폰이 끝나면 `countdown=15`(15웨이브 뒤에는 null 유지). 15웨이브까지 스폰이 끝나고 적이 없으면 `won`, `lives <= 0`이면 `lost`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 설치: 골드 150에서 squirrel(50) 설치 → 골드 100, 반환 Tower의 `invested === 50`
  - 거절(Review Focus 1): 길 칸 `(5,2)`, 장애물 `(7,4)`, 격자 밖 `(-1,0)`, 이미 타워가 있는 칸에 설치하면 null이고 골드·타워 수 변화 없음. 골드 부족(elephant 2기째 = 90 > 60)도 null
  - 업그레이드: squirrel(`invested` 50) → 40골드 지불 후 `level 1`, `invested 90`. 골드 부족이면 false(Review Focus 2). 레벨 3에서 false이고 골드 불변
  - 판매: `invested 90` 판매 시 63(내림) 환급, 타워 제거, 칸 재설치 가능. 없는 id는 0
  - `callNextWave` 첫 호출 → 보너스 10, `waveNumber 1`. **연달아 두 번째 호출 → 0이고 `waveNumber`는 여전히 1**(Review Focus 5)
  - 보너스는 카운트다운이 6.2초 남았으면 7
  - 처치 보상: 병사를 처치하면 골드 +5, 같은 `step`에서 두 번 보상되지 않음
  - 분열체 처치 → `mini` 2마리가 같은 `dist`에 생성되고 분열체 보상 8만 지급
  - 누수: 병사가 끝에 닿으면 생명 -1·골드 불변, 보스는 -5
  - `lives`가 0 이하 → `status 'lost'`, 이후 `step`은 상태를 바꾸지 않음
  - 큰 `dt`(Review Focus 3): 같은 초기 상태에서 `step(g1, 60)`과 `step(g2, 0.05)`를 1200번 호출한 결과의 `gold`, `lives`, `enemies.length`, `status`가 같다
  - 승리: 15웨이브 스폰 후 적 전멸 → `won`(테스트용으로 `waves`에 짧은 웨이브를 주입)
- [ ] **Step 2: 실행해 실패 확인** → FAIL
- [ ] **Step 3: 구현.** 점유 칸 집합은 `towers`에서 매번 만든다. 타워 발사는 `findTarget`→`fire`, 맞은 적은 다음 처치 수집에서 한 번만 제거한다.
- [ ] **Step 4: 실행해 통과 확인** → PASS
- [ ] **Step 5: 커밋** `feat: add game state and rules`

---

### Task 6: 저장

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `MAPS` (Task 1)
- Produces:
  - `defaultSave(): {version:1,unlocked:1,records:{}}`
  - `loadSave(store): Save` — `store`는 `getItem` 가진 객체(`localStorage` 또는 테스트용 가짜). 어떤 문제든 `defaultSave()`
  - `writeSave(store, save): boolean` — 성공 여부(예외는 삼킴)
  - `starsFor(lives: number): 1|2|3` — 15 이상 3, 8 이상 2, 그 외 1
  - `recordResult(save, mapId, {wave:number, lives:number, won:boolean}): Save` — 새 객체 반환. `bestWave`는 최댓값 유지, `stars`는 승리 시 `starsFor`와 기존 값 중 큰 값(패배는 변경 없음), 승리하면 다음 맵까지 `unlocked` 증가(최대 3)

- [ ] **Step 1: 실패하는 테스트 작성**
  - 빈 저장소 → `defaultSave()` (`unlocked 1`)
  - Review Focus 4: `getItem`이 `'{not json'`, `'null'`, `'[]'`, `'{"version":2}'`, `'{"version":1,"unlocked":"x"}'`, `'{"version":1,"unlocked":99,"records":{}}'`(범위 밖)를 돌려줄 때와 `getItem`이 예외를 던질 때 모두 기본값 또는 보정된 값(`unlocked`는 1..3)
  - `writeSave`: `setItem`이 예외를 던지면 false, 정상이면 true이고 다시 `loadSave`하면 같은 값
  - `starsFor(20)=3`, `(15)=3`, `(14)=2`, `(8)=2`, `(7)=1`
  - `recordResult(default,'meadow',{wave:15,lives:18,won:true})` → `unlocked 2`, `records.meadow = {bestWave:15,stars:3}`. 이어서 `{wave:9,lives:0,won:false}`를 기록해도 `bestWave 15`, `stars 3` 유지. 3번째 맵 승리 후 `unlocked`는 3
- [ ] **Step 2: 실행해 실패 확인** → FAIL
- [ ] **Step 3: 구현** 키는 `td-save-v1`을 상수 `SAVE_KEY`로 두고 `loadSave/writeSave`가 사용.
- [ ] **Step 4: 실행해 통과 확인** → PASS
- [ ] **Step 5: 커밋** `feat: add save storage`

---

### Task 7: 동물 SVG와 렌더러

**Files:**
- Create: `assets/animals/{squirrel,elephant,penguin,eagle,snake}.svg`, `js/ui/render.js`

**Interfaces:**
- Consumes: `TOWERS`(emoji), `ENEMIES`, `waypointPoints`, `Game` (Task 1~5)
- Produces:
  - `loadAnimals(): Promise<Record<id, HTMLImageElement|null>>` — 실패한 그림은 null
  - `createRenderer(canvas, animals): {draw(game, view):void, resize():{width,height}}` — `view = {selectedType:string|null, selectedTowerId:number|null, hover:{col,row}|null}`

- [ ] **Step 1: SVG 5개 제작.** 각 파일은 스프라이트 시트: `width="256" height="64" viewBox="0 0 256 64"`, 64×64 프레임 4개를 가로로(레벨 0~3), 투명 배경. 프레임 0은 동물만, 1은 동메달 배지, 2는 은메달 배지와 약간 큰 몸, 3은 금관을 달아 레벨이 한눈에 구분되게 한다. 동물은 스펙의 역할(다람쥐 도토리, 코끼리, 펭귄, 독수리, 뱀)에 맞게 단순한 일러스트로 그린다.
- [ ] **Step 2: 렌더러 구현.** 순서: 배경 격자 → 길 → 장애물 → 타워(레벨 `level`의 프레임을 `drawImage` 소스 사각형으로 그림, 이미지가 null이면 `emoji`를 `fillText`) → 적(종류별 색 원 + 머리 위 체력 바, 슬로우는 푸른 테두리, 독은 초록 테두리) → `events`의 `shot` 선과 `death` 효과(몇 프레임 후 사라지도록 렌더러가 보관) → 선택 시 설치 가능 칸 강조와 사거리 원. 캔버스는 `devicePixelRatio`를 반영하고 가로세로 비율(16:10)을 유지한다.
- [ ] **Step 3: 확인.** 임시 스크립트로 `createGame(MAPS[0])`에 타워 몇 개와 적을 넣고 한 장 그려 Playwright 스크린샷으로 타워 레벨별 그림, 이모지 대체(이미지 경로를 일부러 틀리게), 적 표시를 눈으로 확인한다. 임시 스크립트는 커밋하지 않는다.
- [ ] **Step 4: 커밋** `feat: add animal sprites and renderer`

---

### Task 8: 화면 구성, 입력, 메뉴

**Files:**
- Create: `index.html`, `css/style.css`, `js/ui/input.js`, `js/ui/hud.js`, `js/main.js`

**Interfaces:**
- Consumes: Task 1~7 전부
- Produces:
  - `input.js`: `attachInput(canvas, {cols,rows,onCell(col,row), onCancel()})` — 포인터 이벤트(마우스·터치 공용), `touch-action:none`, `pointToCell` 사용
  - `hud.js`: `createHud(root, handlers)` → `{update(game, save), showMenu(save), showResult(result), showTowerInfo(tower|null), setSelectedType(id|null)}`. `handlers`는 `onPickType, onUpgrade, onSell, onCallWave, onPause, onSpeed, onStartMap, onRetry, onMenu`
  - `main.js`: 메뉴 → 맵 시작 → 루프(`requestAnimationFrame`, 프레임 `dt`는 0.25초로 제한, 배속은 `dt`에 곱함) → 결과 → `recordResult`/`writeSave`

- [ ] **Step 1: HTML/CSS.** `<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">`. 세로 화면은 정보 바 → 캔버스 → 동물 패널, `@media (orientation: landscape)`에서는 패널이 캔버스 오른쪽. 맵 선택 화면과 결과창 아래에 `<div class="ad-slot"></div>`를 둔다(코드는 넣지 않음).
- [ ] **Step 2: 조작 구현** (스펙 6.2): 패널에서 동물 선택(골드 부족이면 `disabled`로 흐리게), 빈 칸 탭 설치, 타워 탭 시 정보창(사거리·능력치·업그레이드 비용·판매), 빈 곳 탭 해제. 단축키 `1`~`5`, `Space`, `Esc`.
- [ ] **Step 3: 메뉴와 저장 연결.** 잠긴 맵은 자물쇠, 열린 맵에는 별과 최고 웨이브. 저장 실패(`writeSave`가 false)는 작은 안내 문구로만 표시.
- [ ] **Step 4: 일시정지 처리.** 일시정지 버튼, `visibilitychange`로 숨겨지면 자동 일시정지, 돌아오면 이전 프레임 시각을 버리고 재개(시간 점프 방지, Review Focus 3).
- [ ] **Step 5: 확인.** `python3 -m http.server`로 서빙해 Playwright로 다음을 직접 확인하고 스크린샷을 남긴다: (a) 세로 390×844, 가로 1280×720에서 레이아웃, (b) 동물 선택 → 빈 칸 탭 → 설치, 길 칸 탭은 무반응, (c) 업그레이드·판매 버튼과 골드 변화, (d) 다음 웨이브 버튼을 빠르게 두 번 눌러도 웨이브 번호가 1만 증가, (e) 새로고침 후 최고 기록 유지, (f) `localStorage`를 막은 상태에서도 시작·진행됨, (g) 콘솔 오류 없음.
- [ ] **Step 6: 커밋** `feat: add game screen, input, and menus`

---

### Task 9: 밸런스 확인

**Files:**
- Modify: `js/data/towers.js`, `js/data/enemies.js`, `js/core/waves.js` (필요한 수치만)

- [ ] **Step 1: 자동 플레이 점검.** 임시 스크립트(커밋하지 않음)로 `createGame`에 각 타워 종류를 고르게 설치하는 단순한 전략을 돌려, 한 판이 약 8~12분(게임 시간) 안에 결판나는지, 어느 타워 하나만으로 모든 웨이브가 쉽게 뚫리지 않는지 확인한다.
- [ ] **Step 2: 수치 조정.** 지나치게 쉽거나 어려우면 `data/`와 웨이브 마릿수만 조정한다. 조정 후 `npm test`로 기존 테스트가 통과하는지 확인한다(테스트가 초기값을 고정하고 있으므로, 바꾼 값은 해당 테스트도 같은 커밋에서 갱신).
- [ ] **Step 3: 커밋** `balance: tune towers and waves`

---

### Task 10: 배포와 문서 이동

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`
- Copy: 이 설계 문서와 계획 문서를 `docs/superpowers/{specs,plans}/`로 복사

- [ ] **Step 1: 워크플로 작성.** 기존 사이트 저장소(`luneeest-lang.github.io`)의 `.github/workflows/pages.yml`과 같은 구조로, `master` 푸시 시 `npm test` 통과 후에만 배포한다. 배포 산출물은 `index.html`, `css`, `assets`, `js`만 `_site/`에 복사해 올린다(테스트·문서 제외).
- [ ] **Step 2: README.** 실행 방법(`python3 -m http.server`), 테스트 명령, 폴더 구조, 수치를 바꾸는 위치(`js/data/`), 배포 설정(Settings > Pages > Source: GitHub Actions)을 쓴다.
- [ ] **Step 3: 검증.** `npm test` 전부 통과, 하위 경로(`/<저장소 이름>/`)를 흉내 내 서빙해도 리소스가 깨지지 않는지 Playwright로 확인한다.
- [ ] **Step 4: 푸시 후 배포 확인.** 사용자 확인을 받고 `master`에 올려 Actions 성공과 실제 주소 접속을 확인한다. 기존 사이트에 링크를 추가하는 일은 이 계획 밖이다.
- [ ] **Step 5: 커밋** `ci: deploy to GitHub Pages`
