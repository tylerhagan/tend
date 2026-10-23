import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, findConflicts } from './planner.js';
import { households, HOUSEHOLD_ORDER } from './households.js';
import { clockSlot } from './time.js';

for (const id of HOUSEHOLD_ORDER) {
  const h = households[id];
  test(`${id}: every must goal is met on a normal night`, () => {
    const r = plan(h);
    for (const g of r.goals.filter((g) => g.goal.firm === 'must')) assert.ok(g.met, `${g.id} missed`);
  });
  test(`${id}: never exceeds the household's power limit`, () => {
    const r = plan(h);
    r.world.forEach((w, i) => assert.ok(w.base + r.load[i] <= h.limitKw + 1e-6, `slot ${i} over limit`));
  });
  test(`${id}: Tend costs no more than doing nothing`, () => {
    const r = plan(h);
    assert.ok(r.saved >= 0, `saved ${r.saved}`);
  });
}

test('car plugged in too late misses its goal and reports it', () => {
  const h = households.p1;
  const r = plan(h, { overrides: { 'g-car': { fromSlot: clockSlot('05:15') } } });
  const car = r.goals.find((g) => g.id === 'g-car');
  assert.equal(car.met, false);
  assert.ok(car.lateBy > 0);
  assert.ok(car.reachedByDeadline < car.need);
});

test('a goal late only because of another is a conflict, not a shortfall', () => {
  const h = { ...households.p4, limitKw: 11 };
  const late = { overrides: { 'g-car': { fromSlot: clockSlot('04:30') } } };
  const goals = h.goals.map((g) => (g.id === 'g-car' ? { ...g, outcome: 0.8 } : g));
  const conflicts = findConflicts({ ...h, goals }, { ...late, goals });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].goal.id, 'g-car');
  assert.ok(conflicts[0].with.some((g) => g.id === 'g-heat'));
});

test('charging now costs more than the planned cheapest hours', () => {
  const h = households.p1;
  const planned = plan(h).goals.find((g) => g.id === 'g-car');
  const now = plan(h, { nowSlot: clockSlot('21:00'), overrides: {} });
  const asap = plan(h, { goals: h.goals, overrides: {} });
  assert.ok(planned.cost < planned.naiveCost, 'cheapest hours beat charging on plug-in');
  assert.ok(now.goals.find((g) => g.id === 'g-car').met);
  assert.ok(asap.saved >= 0);
});

test('a goal that is impossible on its own is a shortfall, not a conflict', () => {
  const h = households.p4;
  const goals = h.goals.map((g) => (g.id === 'g-car' ? { ...g, outcome: 0.85 } : g));
  const opts = { overrides: { 'g-car': { fromSlot: clockSlot('04:30') } }, goals };
  assert.equal(findConflicts(h, opts).length, 0);
  assert.equal(plan(h, opts).goals.find((g) => g.id === 'g-car').met, false);
});
