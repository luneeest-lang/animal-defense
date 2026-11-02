import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { ENEMIES } from '../js/data/enemies.js';
import { SPRITES, ENEMY_LOOK } from '../js/data/sprites.js';
import { buildWaves } from '../js/core/waves.js';
import { createGame, addTower, step } from '../js/core/game.js';
import { createEnemy } from '../js/core/enemies.js';

const meadow = MAPS[0];
const count = (w, type) => w.groups.filter((g) => g.type === type).reduce((s, g) => s + g.count, 0);
function field(towerType) {
  const g = createGame(meadow);
  g.countdown = null;
  addTower(g, towerType, 5, 3, 2);
  return g;
}
const put = (g, type, dist) => { const e = createEnemy(g.nextId++, type, 1); e.dist = dist; e.hp = e.maxHp = 1e6; g.enemies.push(e); return e; };

test('박쥐는 7웨이브부터, 치유사는 12웨이브부터 나온다 (웨이브당 20마리는 그대로)', () => {
  const waves = buildWaves();
  assert.equal(waves.find((w) => count(w, 'bat') > 0).number, 7);
  assert.equal(waves.find((w) => count(w, 'healer') > 0).number, 12);
  assert.ok(ENEMIES.bat.air && !ENEMIES.healer.air);
  for (const t of ['bat', 'healer']) {
    assert.ok(SPRITES[t] && ENEMY_LOOK[t], t);
  }
});

test('코끼리·뱀은 날아다니는 박쥐를 공격하지 못하고, 다람쥐·펭귄·독수리는 공격한다', () => {
  for (const [type, can] of [['elephant', false], ['snake', false], ['squirrel', true], ['penguin', true], ['eagle', true]]) {
    const g = field(type);
    const bat = put(g, 'bat', 5);
    step(g, 0.05);
    assert.equal(bat.hp < bat.maxHp, can, `${type}`);
  }
});

test('코끼리 범위 공격도 박쥐는 맞지 않는다 (땅 위 적만)', () => {
  const g = field('elephant');
  const soldier = put(g, 'soldier', 5);
  const bat = put(g, 'bat', 5);
  step(g, 0.05);
  assert.ok(soldier.hp < soldier.maxHp);
  assert.equal(bat.hp, bat.maxHp);
});

test('치유사는 3초마다 주변(1.5칸) 몬스터를 최대 체력의 10%만큼 회복시키고, 보스는 회복시키지 않는다', () => {
  const g = createGame(meadow);
  g.countdown = null;
  const healer = createEnemy(g.nextId++, 'healer', 1); healer.dist = 2; g.enemies.push(healer);
  const near = createEnemy(g.nextId++, 'tank', 1); near.dist = 3; near.hp = near.maxHp * 0.5; g.enemies.push(near);
  const far = createEnemy(g.nextId++, 'tank', 1); far.dist = 6; far.hp = far.maxHp * 0.5; g.enemies.push(far);
  const boss = createEnemy(g.nextId++, 'boss', 1); boss.dist = 2.5; boss.hp = boss.maxHp * 0.5; g.enemies.push(boss);
  for (const e of [healer, near, far, boss]) e.speedMult = 0; // 제자리
  let heals = 0;
  for (let i = 0; i < 31; i++) { step(g, 0.1); heals += g.events.filter((x) => x.type === 'heal').length; }
  assert.equal(heals, 1, '3초에 한 번');
  assert.ok(Math.abs(near.hp - near.maxHp * 0.6) < 1e-6, String(near.hp / near.maxHp));
  assert.equal(far.hp, far.maxHp * 0.5);
  assert.equal(boss.hp, boss.maxHp * 0.5);
});
