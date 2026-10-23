// The planner: turns a household's goals into a night's plan.
//
// Order of priority (rules model 1.3): device limits, then "must" goals by
// earliest deadline, then "should" goals, then cost. The battery serves the
// goals afterwards. Every choice keeps a reason, so the morning summary can
// explain it in a sentence.
import { SLOTS, SLOT_H, SLOT_MIN, clockSlot, slotClock } from './time.js';
import { priceAt, solarAt, baseLoadAt, FEED_IN } from './world.js';
import { goalEnergy, goalMaxKw } from './households.js';

const EPS = 1e-6;
const round = (n, d = 2) => +n.toFixed(d);

// Window for a goal: [from, by). A `from` after the deadline means the device
// was already available before the evening started (e.g. plugged in at 17:00).
const windowOf = (goal, opts) => {
  const by = clockSlot(goal.by);
  let from = clockSlot(goal.from);
  if (from >= by) from = 0;
  const override = opts.overrides?.[goal.id];
  if (override?.fromSlot !== undefined) from = override.fromSlot;
  if (opts.nowSlot !== undefined) from = Math.max(from, opts.nowSlot);
  return { from, by: Math.max(by, from) };
};

const worldFor = (household) =>
  Array.from({ length: SLOTS }, (_, i) => ({
    price: priceAt(i),
    solar: solarAt(i, household.solarKwp),
    base: baseLoadAt(i, household.people, household.homeInDay),
  }));

// Price of a kWh for a flexible load in this slot: solar that would otherwise
// be exported costs only the feed-in it gives up
const effPrice = (world, alloc, i, kw) => {
  const surplus = world[i].solar - world[i].base - alloc[i];
  return surplus >= kw - EPS ? FEED_IN : world[i].price;
};

const headroom = (household, world, alloc, i) => Math.max(0, household.limitKw - world[i].base - alloc[i]);

// Place an energy load (car, heating, hot water) in the cheapest slots of its
// window, then as soon as possible after the deadline if it does not fit
const placeEnergy = (household, world, alloc, goal, win, strategy) => {
  const need = goalEnergy(goal, household);
  const maxKw = goalMaxKw(goal, household);
  const take = {};
  let left = need;
  const order = [];
  for (let i = win.from; i < win.by; i++) order.push(i);
  if (strategy === 'cheapest') {
    order.sort((a, b) => effPrice(world, alloc, a, maxKw) - effPrice(world, alloc, b, maxKw) || a - b);
  } else if (strategy === 'just-in-time') {
    order.reverse();
  }
  const fill = (i) => {
    if (left <= EPS) return;
    const kw = Math.min(maxKw, headroom(household, world, alloc, i), left / SLOT_H);
    if (kw <= EPS) return;
    take[i] = kw;
    alloc[i] += kw;
    left -= kw * SLOT_H;
  };
  order.forEach(fill);
  const metInWindow = left <= EPS;
  for (let i = win.by; i < SLOTS && left > EPS; i++) fill(i);
  return { take, need, delivered: need - Math.max(0, left), metInWindow };
};

// Place an appliance run: a fixed block of slots at a steady power
const placeRun = (household, world, alloc, goal, win, strategy) => {
  const n = Math.ceil(goal.runMin / SLOT_MIN);
  const kw = goal.energyKwh / (goal.runMin / 60);
  const fits = (s) => s + n <= SLOTS && Array.from({ length: n }, (_, k) => headroom(household, world, alloc, s + k) >= kw - EPS).every(Boolean);
  const costAt = (s) => Array.from({ length: n }, (_, k) => effPrice(world, alloc, s + k, kw)).reduce((a, b) => a + b, 0);
  let best = null;
  if (strategy === 'cheapest') {
    for (let s = win.from; s + n <= win.by; s++) if (fits(s) && (best === null || costAt(s) < costAt(best) - EPS)) best = s;
  } else {
    for (let s = win.from; s + n <= win.by; s++) if (fits(s)) { best = s; break; }
  }
  if (best === null) for (let s = win.by - n + 1; s < SLOTS; s++) if (s >= win.from && fits(s)) { best = s; break; }
  const take = {};
  if (best !== null) for (let k = 0; k < n; k++) { take[best + k] = kw; alloc[best + k] += kw; }
  const delivered = best === null ? 0 : goal.energyKwh;
  return { take, need: goal.energyKwh, delivered, metInWindow: best !== null && best + n <= win.by };
};

// Battery, chronologically: store surplus solar, cover the most expensive
// slots, and top up from the grid in the cheapest night slots
const runBattery = (household, world, loads, smart) => {
  const b = household.battery;
  const sorted = [...world.map((w) => w.price)].sort((a, c) => a - c);
  const cheap = sorted[Math.floor(SLOTS * 0.2)];
  const dear = sorted[Math.floor(SLOTS * 0.75)];
  let soc = b ? b.capacityKwh * b.soc : 0;
  const reserve = b ? b.capacityKwh * 0.1 : 0;
  return world.map((w, i) => {
    const net = w.base + loads[i] - w.solar;
    let batt = 0;
    if (b) {
      if (net < 0) batt = Math.min(-net, b.maxKw, (b.capacityKwh - soc) / SLOT_H);
      else if (!smart || w.price >= dear) batt = -Math.min(net, b.maxKw, Math.max(0, soc - reserve) / SLOT_H);
      else if (smart && w.price <= cheap && soc < b.capacityKwh * 0.9)
        batt = Math.min(b.maxKw, (b.capacityKwh * 0.9 - soc) / SLOT_H, Math.max(0, household.limitKw - w.base - loads[i]));
      soc += batt * SLOT_H;
    }
    const grid = net + batt;
    return { batt: round(batt, 3), grid: round(grid, 3), soc: round(soc, 2) };
  });
};

const costOf = (world, flows) =>
  flows.reduce((sum, f, i) => sum + (f.grid > 0 ? f.grid * world[i].price : f.grid * FEED_IN) * SLOT_H, 0);

// Energy-weighted price a goal paid, using solar first where it was spare
const goalCost = (world, take) =>
  Object.entries(take).reduce((sum, [i, kw]) => {
    const w = world[i];
    const solarShare = Math.min(kw, Math.max(0, w.solar - w.base));
    return sum + (solarShare * FEED_IN + (kw - solarShare) * w.price) * SLOT_H;
  }, 0);

const simulate = (household, goals, opts, strategyFor) => {
  const world = worldFor(household);
  const alloc = new Array(SLOTS).fill(0);
  const ordered = [...goals].sort(
    (a, b) => (a.firm === b.firm ? clockSlot(a.by) - clockSlot(b.by) : a.firm === 'must' ? -1 : 1)
  );
  const placed = ordered.map((goal) => {
    const win = windowOf(goal, opts);
    const strategy = strategyFor(goal);
    const r = goal.runMin ? placeRun(household, world, alloc, goal, win, strategy) : placeEnergy(household, world, alloc, goal, win, strategy);
    const slots = Object.keys(r.take).map(Number).sort((a, b) => a - b);
    return { goal, win, ...r, slots };
  });
  const flows = runBattery(household, world, alloc, strategyFor === smartStrategy);
  return { world, alloc, placed, flows, cost: costOf(world, flows) };
};

const smartStrategy = () => 'cheapest';
// Without Tend: the car charges when plugged in, appliances start when
// loaded, heating runs on a just-in-time timer
const naiveStrategy = (goal) => (goal.device === 'heating' ? 'just-in-time' : 'asap');

const describe = (household, world, p, naive) => {
  const { goal, slots } = p;
  const start = slots[0];
  const end = slots.length ? slots[slots.length - 1] + 1 : undefined;
  const finish = end;
  const met = p.metInWindow;
  const prices = slots.map((i) => world[i].price);
  const windowPrices = [];
  for (let i = p.win.from; i < p.win.by; i++) windowPrices.push(world[i].price);
  windowPrices.sort((a, b) => a - b);
  const q1 = windowPrices[Math.floor(windowPrices.length * 0.3)] ?? Infinity;
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const solarSlots = slots.filter((i) => world[i].solar - world[i].base > 0.5).length;
  const cost = goalCost(world, p.take);
  const naiveCost = goalCost(world, naive.take);
  const lateBy = met || finish === undefined ? 0 : (finish - p.win.by) * SLOT_MIN;

  let reason;
  if (!met && goal.device === 'car' && p.win.from > clockSlot(goal.from) && p.win.from > 0) reason = 'Started as soon as it could';
  else if (!met) reason = 'Not enough time before the deadline';
  else if (solarSlots >= slots.length / 2 && slots.length) reason = 'Your own solar';
  else if (goal.note === 'cold' && naive.slots.length && start < naive.slots[0]) reason = 'A cold morning was forecast, so it started early while power was cheap';
  else if (avg <= q1 + EPS) reason = 'Cheapest hours tonight';
  else reason = 'Fitted around your other goals';

  return {
    id: goal.id,
    goal,
    start,
    finish,
    startClock: start === undefined ? null : slotClock(start),
    finishClock: finish === undefined ? null : slotClock(finish % 96),
    met,
    lateBy,
    need: round(p.need),
    delivered: round(p.delivered),
    reachedByDeadline: round(slots.filter((i) => i < p.win.by).reduce((s, i) => s + p.take[i] * SLOT_H, 0)),
    reason,
    cost: round(cost),
    naiveCost: round(naiveCost),
    saved: round(naiveCost - cost),
    slots,
    take: p.take,
  };
};

// Plan a night. opts: { overrides: { [goalId]: { fromSlot } }, nowSlot, goals }
export const plan = (household, opts = {}) => {
  const goals = opts.goals ?? household.goals;
  const smart = simulate(household, goals, opts, smartStrategy);
  const naive = simulate(household, goals, opts, naiveStrategy);
  const naiveById = Object.fromEntries(naive.placed.map((p) => [p.goal.id, p]));
  const results = smart.placed.map((p) => describe(household, smart.world, p, naiveById[p.goal.id]));
  const solarUsed = smart.world.reduce((s, w, i) => s + Math.min(w.solar, w.base + smart.alloc[i] + Math.max(0, smart.flows[i].batt)) * SLOT_H, 0);
  return {
    household,
    world: smart.world,
    load: smart.alloc,
    flows: smart.flows,
    goals: results,
    cost: round(smart.cost),
    naiveCost: round(naive.cost),
    saved: round(naive.cost - smart.cost),
    solarUsedKwh: round(solarUsed, 1),
    allMet: results.filter((r) => r.goal.firm === 'must').every((r) => r.met),
    peakKw: round(Math.max(...smart.world.map((w, i) => w.base + smart.alloc[i] + Math.max(0, smart.flows[i].batt)))),
  };
};

// A must goal that is late only because of another goal is a conflict.
// Returns the late goal, the goals sharing its slots, and how late it is.
export const findConflicts = (household, opts = {}) => {
  const result = plan(household, opts);
  return result.goals
    .filter((r) => r.goal.firm === 'must' && !r.met)
    .map((late) => {
      const alone = plan(household, { ...opts, goals: [late.goal] }).goals[0];
      if (!alone.met) return null; // impossible on its own: a shortfall, not a conflict
      const window = new Set(late.slots);
      const others = result.goals.filter((r) => r.id !== late.id && r.slots.some((i) => window.has(i)));
      return { goal: late.goal, lateBy: late.lateBy, with: others.map((o) => o.goal) };
    })
    .filter(Boolean);
};
