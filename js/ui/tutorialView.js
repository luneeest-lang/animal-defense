// 튜토리얼 화면: 말풍선, 짚어 주는 대상 둘레의 빛나는 테두리, 끌기 단계의 손가락
import { t } from '../i18n.js';
import { setRich } from './icons.js';
import { isInfo } from './tutorial.js';

export function createTutorialView(root, { onSkip, onNext }) {
  const box = root.querySelector('#tutorial');
  const ring = box.querySelector('.tut-ring');
  const finger = box.querySelector('.tut-finger');
  const bubble = box.querySelector('.tut-bubble');
  const text = box.querySelector('.tut-text');
  const nextBtn = box.querySelector('#btn-tut-next');
  box.querySelector('#btn-tut-skip').addEventListener('click', onSkip);
  nextBtn.addEventListener('click', onNext);
  let shownStep = null;

  const place = (el, r, pad) => {
    el.style.left = `${r.left - pad}px`;
    el.style.top = `${r.top - pad}px`;
    el.style.width = `${r.width + pad * 2}px`;
    el.style.height = `${r.height + pad * 2}px`;
  };

  // target: 짚을 화면 사각형(없으면 null), drag: { from, to } 끌기 손가락 화면 점
  function show(tut, target, drag) {
    box.hidden = !tut || tut.step === 'done';
    if (box.hidden) { shownStep = null; return; }
    if (shownStep !== tut.step) {
      shownStep = tut.step;
      setRich(text, t(`tut.${tut.step}`));
      nextBtn.hidden = !isInfo(tut);
    }
    ring.hidden = !target;
    if (target) place(ring, target, 6);
    finger.hidden = !drag;
    if (drag) {
      finger.style.setProperty('--fx', `${drag.from.x}px`);
      finger.style.setProperty('--fy', `${drag.from.y}px`);
      finger.style.setProperty('--tx', `${drag.to.x}px`);
      finger.style.setProperty('--ty', `${drag.to.y}px`);
    }
    // 말풍선은 짚는 대상(끌기면 두 동물)과 겹치지 않게 화면 위쪽이나 아래쪽에. 말풍선은 터치를 막지 않는다(버튼만 누를 수 있다)
    const ys = target ? [target.top + target.height / 2] : drag ? [drag.from.y, drag.to.y] : [window.innerHeight / 2];
    bubble.classList.toggle('low', Math.max(...ys) < window.innerHeight * 0.5);
  }

  return { show };
}
