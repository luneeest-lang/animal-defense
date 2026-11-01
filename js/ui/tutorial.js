// 첫 판 튜토리얼의 단계 진행 (그리기는 ui/tutorialView.js, 연결은 main.js)
// summon(두 번 소환) → merge(끌어서 합성) → wave(웨이브 시작) → upgrade(강화 소개) → mythic(신화 소개) → done
// summon·merge 동안은 게임 시간을 멈춰(카운트다운 포함) 서두르지 않게 한다.
export const TUTORIAL_KEY = 'td-tutorial';
const STEPS = ['summon', 'merge', 'wave', 'upgrade', 'mythic', 'done'];
// 누르면 넘어가는 소개 단계
const INFO = new Set(['upgrade', 'mythic']);

export const createTutorial = () => ({ step: 'summon', firstType: null });

// 처음으로 초급(보통 판)을 시작할 때만. 저장소를 읽을 수 없으면 연다
export function shouldStart(store, mapId, endless) {
  if (mapId !== 'meadow' || endless) return false;
  try {
    return store.getItem(TUTORIAL_KEY) !== 'done';
  } catch {
    return true;
  }
}

// 첫 웨이브를 시작하기 전까지만 멈춘다 (먼저 웨이브를 불러도 게임이 멈춰 있지 않게)
export const blocking = (tut, game) => (tut.step === 'summon' || tut.step === 'merge') && game.waveNumber === 0;
export const isInfo = (tut) => INFO.has(tut.step);

const go = (tut) => { tut.step = STEPS[STEPS.indexOf(tut.step) + 1] ?? 'done'; };

// 게임 상태를 보고 넘어간다. summoned: 방금 소환한 타워(있으면). 튜토리얼 첫 두 마리는 같은 동물로 맞춰 바로 합칠 수 있게 한다
export function advance(tut, game, summoned = null) {
  if (tut.step === 'summon') {
    if (summoned) {
      if (!tut.firstType) tut.firstType = summoned.type;
      else summoned.type = tut.firstType;
    }
    if (game.towers.length >= 2) go(tut);
  } else if (tut.step === 'merge') {
    if (game.towers.some((t) => t.level >= 1)) go(tut);
  } else if (tut.step === 'wave') {
    if (game.waveNumber >= 1) go(tut);
  }
}

// 소개 단계에서 '다음'을 눌렀을 때
export function next(tut) {
  if (INFO.has(tut.step)) go(tut);
}
