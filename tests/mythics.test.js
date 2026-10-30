import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../js/data/maps.js';
import { positionAt } from '../js/core/path.js';
import {
  createGame, addTower, emptyCells, canMerge, spawnEnemy, step, effectiveStats, sellTower, upgradeAnimal,
} from '../js/core/game.js';
import { MYTHICS, GRADE_NAMES, gradeOf } from '../js/data/mythics.js';
import { findMaterials, canCraft, craftMythic, mythicStats, RECIPE_LEVELS } from '../js/core/mythics.js';

const meadow = MAPS[0];
const running = () => {
  const g = createGame(meadow);
  g.waveNumber = 1;
  g.clearedWave = 99; // 웨이브 클리어 보상·카드가 끼어들지 않게
  g.countdown = null;
  g.waves = g.waves.map((w) => ({ ...w, groups: [] }));
  return g;
};
// 타워에서 가장 가까운 길 위 지점
const nearDist = (g, t) => {
  let best = 0;
  let bestD = Infinity;
  for (let d = 0; d < g.length; d += 0.05) {
    const p = positionAt(g.points, d);
    const dd = (p.x - t.col - 0.5) ** 2 + (p.y - t.row - 0.5) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
};
const place = (g, type, level, n = 0) => {
  const [c, r] = emptyCells(g)[n];
  return addTower(g, type, c, r, level);
};

test('등급: 아기·청년은 일반, 성체는 희귀, 각성은 전설, 신화는 신화', () => {
  assert.deepEqual(GRADE_NAMES, ['일반', '희귀', '전설', '신화']);
  assert.deepEqual([0, 1, 2, 3].map((level) => gradeOf({ level })), [0, 0, 1, 2]);
  assert.equal(gradeOf({ level: 0, mythic: true }), 3);
});

test('신화 5종의 이름과 재료 (각성 2 + 성체 1, 셋 다 다른 동물)', () => {
  assert.deepEqual(RECIPE_LEVELS, [3, 3, 2]);
  const recipes = Object.fromEntries(Object.entries(MYTHICS).map(([id, m]) => [id, [m.name, ...m.recipe]]));
  assert.deepEqual(recipes, {
    phoenix: ['불사조', 'eagle', 'squirrel', 'penguin'],
    gumiho: ['구미호', 'snake', 'eagle', 'elephant'],
    cheonma: ['천마', 'penguin', 'snake', 'elephant'],
    haetae: ['해태', 'elephant', 'snake', 'squirrel'],
    girin: ['기린', 'squirrel', 'eagle', 'snake'],
  });
});

test('재료가 모자라면 만들 수 없고, 무엇이 있는지 칸별로 알려 준다', () => {
  const g = running();
  const main = place(g, 'eagle', 3, 0);
  place(g, 'squirrel', 2, 1); // 둘째 재료는 각성이어야 한다
  place(g, 'penguin', 1, 2); // 청년은 재료가 아니다
  const m = findMaterials(g, 'phoenix');
  assert.equal(m.main, main);
  assert.deepEqual(m.subs, [null, null]);
  assert.equal(canCraft(g, 'phoenix'), false);
  assert.equal(craftMythic(g, 'phoenix'), null);
});

test('만들면 재료 셋이 사라지고 각성 동물 자리에 신화가 생긴다 (투자액 합산)', () => {
  const g = running();
  const main = place(g, 'eagle', 3, 0);
  const a = place(g, 'squirrel', 3, 1);
  const b = place(g, 'penguin', 2, 2);
  main.invested = 400; a.invested = 200; b.invested = 200;
  const spot = [main.col, main.row];
  assert.equal(canCraft(g, 'phoenix'), true);
  const t = craftMythic(g, 'phoenix');
  assert.deepEqual([t.type, t.mythic, t.col, t.row, t.invested], ['phoenix', true, ...spot, 800]);
  assert.equal(g.towers.length, 1);
  assert.ok(g.events.some((e) => e.type === 'mythic' && e.mythic === 'phoenix'));
  // 신화는 합칠 수 없고 판매는 된다
  const other = place(g, 'eagle', 0, 3);
  assert.equal(canMerge(g, t.id, other.id), false);
  assert.equal(sellTower(g, t.id), 560);
});

test('각성 동물이 아니면(성체 독수리) 주재료가 되지 않는다', () => {
  const g = running();
  place(g, 'eagle', 2, 0);
  place(g, 'squirrel', 3, 1);
  place(g, 'penguin', 2, 2);
  assert.equal(canCraft(g, 'phoenix'), false);
});

test('신화 능력치는 주재료 동물의 강화와 카드 효과를 이어받는다', () => {
  const g = running();
  g.gold = 9999;
  const t = { id: 99, type: 'girin', mythic: true, level: 0, col: 0, row: 0 };
  const base = mythicStats(g, t);
  upgradeAnimal(g, 'squirrel');
  g.mods.damage.squirrel += 0.3;
  g.mods.attackSpeed += 0.1;
  const up = mythicStats(g, t);
  assert.ok(Math.abs(up.damage - base.damage * 1.2 * 1.3) < 1e-6);
  assert.ok(Math.abs(up.cooldown - base.cooldown / 1.1) < 1e-9);
  assert.deepEqual(effectiveStats(g, t), up);
});

// 길 중간쯤(시작점에서 3칸 이상) 옆 칸에 주재료를 놓고 신화를 만든다
function craftAt(g, id) {
  const [main, ...subs] = MYTHICS[id].recipe;
  const cells = emptyCells(g);
  const spot = cells.find(([c, r]) => nearDist(g, { col: c, row: r }) > 3);
  addTower(g, main, spot[0], spot[1], 3);
  subs.forEach((s, i) => place(g, s, RECIPE_LEVELS[i + 1], i));
  return craftMythic(g, id);
}

test('불사조: 맞은 자리에 불길이 남아 지나가는 적이 계속 탄다', () => {
  const g = running();
  const t = craftAt(g, 'phoenix');
  const e = spawnEnemy(g, 'tank', 30, nearDist(g, t));
  e.hp = e.maxHp = 1e9;
  step(g, 0.05);
  assert.equal(g.zones.length, 1);
  const after = e.hp;
  t.cooldown = 99; // 더 쏘지 않게
  step(g, 1);
  assert.ok(after - e.hp > MYTHICS.phoenix.base.burnDps * 0.5, String(after - e.hp));
  step(g, 3);
  assert.equal(g.zones.length, 0);
});

test('구미호: 여우불이 여러 적을 한꺼번에 맞힌다', () => {
  const g = running();
  const t = craftAt(g, 'gumiho');
  const d = nearDist(g, t);
  const es = [0, 0.2, 0.4, 0.6, 0.8].map((k) => spawnEnemy(g, 'tank', 30, d + k));
  for (const e of es) e.hp = e.maxHp = 1e9;
  step(g, 0.05);
  assert.equal(es.filter((e) => e.hp < 1e9).length, MYTHICS.gumiho.base.shots);
});

test('구미호는 가끔 적을 1초 기절시킨다 (밀어내지 않고, 보스는 기절하지 않는다)', () => {
  const g = running();
  const t = craftAt(g, 'gumiho');
  assert.equal(MYTHICS.gumiho.base.stunTime, 1);
  assert.equal(MYTHICS.gumiho.base.charmBack, undefined);
  g.rng = () => 0; // 항상 기절
  const d = nearDist(g, t);
  const e = spawnEnemy(g, 'tank', 30, d);
  const boss = spawnEnemy(g, 'boss', 30, d + 0.1);
  for (const x of [e, boss]) x.hp = x.maxHp = 1e9;
  step(g, 0.05);
  assert.ok(g.events.some((x) => x.type === 'stun'));
  assert.ok(e.dist >= d, '뒤로 밀리지 않는다');
  const stopped = e.dist; // 같은 프레임에 조금 걸은 뒤 기절한 자리
  g.rng = () => 0.99; // 이제 더는 기절하지 않는다
  step(g, 0.8);
  assert.ok(Math.abs(e.dist - stopped) < 1e-9, '1초 동안은 멈춰 있다');
  step(g, 0.5);
  assert.ok(e.dist > stopped, '1초가 지나면 다시 걷는다');
  assert.ok(boss.dist > d + 0.1, '보스는 멈추지 않는다');
});

test('천마 피해는 300 (다른 신화의 초당 피해 평균보다 약 30% 낮게)', () => {
  assert.equal(MYTHICS.cheonma.base.damage, 300);
});

test('천마: 일직선의 적을 모두 꿰뚫고, 가까운 동물의 공격 속도를 올린다', () => {
  const g = running();
  const t = craftAt(g, 'cheonma');
  const d = nearDist(g, t);
  const es = [0, 0.3, 0.6].map((k) => spawnEnemy(g, 'tank', 30, d + k));
  for (const e of es) e.hp = e.maxHp = 1e9;
  step(g, 0.05);
  assert.ok(es.filter((e) => e.hp < 1e9).length >= 2);
  // 2칸 안의 동물은 빨라지고, 멀리 있는 동물은 그대로
  const near = emptyCells(g).find(([c, r]) => Math.hypot(c - t.col, r - t.row) <= 2);
  const far = emptyCells(g).find(([c, r]) => Math.hypot(c - t.col, r - t.row) > 3);
  const a = addTower(g, 'squirrel', ...near);
  const b = addTower(g, 'squirrel', ...far);
  assert.ok(Math.abs(effectiveStats(g, a).cooldown * MYTHICS.cheonma.base.buffSpeed - effectiveStats(g, b).cooldown) < 1e-9);
});

test('해태: 맵 어디에 있든 모든 적에게 피해를 주고 느리게 한다', () => {
  const g = running();
  craftAt(g, 'haetae');
  const far = spawnEnemy(g, 'tank', 1, g.length - 0.5);
  const start = spawnEnemy(g, 'soldier', 1, 0.1);
  for (const e of [far, start]) e.hp = e.maxHp = 1e9;
  step(g, 0.05);
  assert.ok(far.hp < 1e9 && start.hp < 1e9);
  assert.ok(far.slow && start.slow);
  assert.ok(g.events.some((x) => x.type === 'quake'));
});

test('기린: 보스에게 더 큰 피해, 기린이 잡은 적은 골드를 더 준다', () => {
  const g = running();
  const t = craftAt(g, 'girin');
  const d = nearDist(g, t);
  const e = spawnEnemy(g, 'soldier', 1, d);
  e.hp = 1;
  const gold = g.gold;
  step(g, 0.05);
  const death = g.events.find((x) => x.type === 'death');
  assert.equal(death.reward, 5 + MYTHICS.girin.base.killGold);
  assert.equal(g.gold - gold, death.reward);
  const boss = spawnEnemy(g, 'boss', 1, d);
  boss.hp = boss.maxHp = 1e9;
  t.cooldown = 0;
  step(g, 0.01);
  const hit = g.events.find((x) => x.type === 'hit' && x.enemyId === boss.id);
  assert.ok(Math.abs(hit.amount - mythicStats(g, t).damage * MYTHICS.girin.base.bossMult) < 1e-6);
});
