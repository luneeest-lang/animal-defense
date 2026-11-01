// 동물 타워의 작은 움직임 (그리기 전용, 게임 규칙과 무관)
// - 숨쉬기: 발밑을 기준으로 위아래로 살짝 늘었다 줄었다 한다(옆으로는 반대로). 동물마다 박자가 다르다
// - 공격 반동: 쏜 순간부터 ATTACK_MS 동안 바라보는 쪽으로 툭 나갔다 돌아오며 살짝 납작해진다
// 반환: dx(칸 크기에 대한 앞쪽 이동 비율), sx·sy(가로·세로 배율)
export const ATTACK_MS = 180;
const BREATH_MS = 650;
const BREATH = 0.022;
const LUNGE = 0.1;

export function towerMotion(now, id, shotAt, reduceMotion = false) {
  if (reduceMotion) return { dx: 0, sx: 1, sy: 1 };
  const b = Math.sin(now / BREATH_MS + id * 1.7);
  let sy = 1 + BREATH * b;
  let sx = 1 - BREATH * 0.6 * b;
  let dx = 0;
  const age = shotAt === null || shotAt === undefined ? Infinity : now - shotAt;
  if (age >= 0 && age < ATTACK_MS) {
    const k = Math.sin((age / ATTACK_MS) * Math.PI); // 0 → 1 → 0
    dx = LUNGE * k;
    sx *= 1 + 0.08 * k;
    sy *= 1 - 0.08 * k;
  }
  return { dx, sx, sy };
}
