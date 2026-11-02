// 웹게임 사이트 연결 (지금은 CrazyGames). CrazyGames에서 열렸을 때만 SDK를 불러온다.
// - 데이터 모듈: 기록을 CrazyGames 계정에 저장한다(로그인하면 기기가 달라도 이어진다)
// - 오디오 음소거: 사이트가 소리를 끄라고 하면 게임 소리를 끈다(게임 안 소리 버튼보다 우선)
// - 게임 시작·멈춤 알림: 실제로 플레이하는 동안만 gameplayStart, 메뉴·일시정지·결과에서는 gameplayStop
// 그 밖의 곳(지금 사이트 등)에서는 아무것도 바꾸지 않고 브라우저 저장소를 쓴다.
export const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
// SDK 저장소로 옮겨 담을 게임 기록 키 (storage.js, i18n.js, ui/sound.js, ui/tutorial.js, ui/enemyIntro.js)
export const GAME_KEYS = ['td-save-v1', 'td-run-v1', 'td-lang', 'td-sound-v2', 'td-tutorial', 'td-seen-enemies'];
const INIT_TIMEOUT_MS = 3000;

// CrazyGames 주소(crazygames.com과 그 하위 주소)이거나 시험용 ?platform=crazygames
export function isCrazyGames(hostname, search) {
  if (/(^|[?&])platform=crazygames(&|$)/.test(search)) return true;
  return hostname === 'crazygames.com' || hostname.endsWith('.crazygames.com');
}

// SDK 데이터 모듈을 브라우저 저장소처럼 쓴다. SDK 쪽이 비어 있으면 처음 한 번 브라우저에 남은 게임 기록을 옮겨 담는다
export function sdkStore(sdk, local) {
  const data = sdk.data;
  try {
    const empty = GAME_KEYS.every((k) => data.getItem(k) === null || data.getItem(k) === undefined);
    if (empty) {
      for (const k of GAME_KEYS) {
        const v = local?.getItem(k);
        if (v !== null && v !== undefined) data.setItem(k, v);
      }
    }
  } catch { /* 옮기지 못해도 SDK 저장은 쓴다 */ }
  return {
    getItem: (k) => data.getItem(k) ?? null,
    setItem: (k, v) => data.setItem(k, String(v)),
    removeItem: (k) => data.removeItem(k),
  };
}

// 게임 중인지 알려 주면 바뀔 때만 gameplayStart/Stop을 부른다 (sdk가 없으면 아무 일도 하지 않는다)
export function createPlayTracker(sdk) {
  let playing = false;
  return (now) => {
    if (!sdk || now === playing) return;
    playing = now;
    try { (now ? sdk.game.gameplayStart : sdk.game.gameplayStop)(); } catch { /* 사이트 쪽 오류는 무시 */ }
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

// CrazyGames면 SDK를 불러와 초기화한다. 실패하거나 3초 안에 안 되면 null (브라우저 저장소로 계속)
export async function initPlatform() {
  if (typeof window === 'undefined' || !isCrazyGames(window.location.hostname, window.location.search)) return null;
  try {
    const ready = (async () => {
      await loadScript(SDK_URL);
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return null;
      await sdk.init();
      return sdk;
    })();
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), INIT_TIMEOUT_MS));
    return await Promise.race([ready, timeout]);
  } catch {
    return null;
  }
}

// 사이트가 소리를 끄라고 하는지 (지금 값과, 바뀔 때 부를 함수)
export function watchMute(sdk, onChange) {
  if (!sdk?.game) return false;
  try {
    sdk.game.addSettingsChangeListener?.((settings) => onChange(!!settings?.muteAudio));
    return !!sdk.game.settings?.muteAudio;
  } catch {
    return false;
  }
}
