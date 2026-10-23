// Every sentence Tend shows is built here from planner results, so what the
// household reads always matches what the system actually did.
import { slotClock, clockSlot } from './sim/time.js';

export const euro = (n) => `${n.toFixed(2).replace('.', ',')} €`;
export const kwh = (n) => `${n.toFixed(n < 10 ? 1 : 0).replace('.', ',')} kWh`;
export const clock = (c) => (c ? c.replace(/^0(\d)/, '$1') : '');

const PAST = {
  car: 'Car charged',
  heating: 'Heating came on',
  hotwater: 'Hot water heated',
  dishwasher: 'Dishwasher ran',
  washing: 'Washing ran',
};
const FUTURE = {
  car: 'Car charges',
  heating: 'Heating comes on',
  hotwater: 'Hot water heats',
  dishwasher: 'Dishwasher runs',
  washing: 'Washing runs',
};
// What "without Tend" means for each device, for the savings comparison
const NAIVE = {
  car: 'charging as soon as it was plugged in',
  heating: 'a fixed heating timer',
  hotwater: 'heating it straight away',
  dishwasher: 'running it when it was loaded',
  washing: 'running it when it was loaded',
};

export const carPercentAt = (household, g, delivered) =>
  Math.round((household.car.soc + delivered / household.car.capacityKwh) * 100);

export const entryTitle = (g, tense = 'past', household) => {
  const base = (tense === 'past' ? PAST : FUTURE)[g.goal.device];
  if (g.goal.device === 'car' && tense === 'past' && !g.met && household)
    return `${base} to ${carPercentAt(household, g, g.reachedByDeadline)}% by ${clock(g.goal.by)}`;
  if (g.goal.device === 'car') return `${base} to ${Math.round(g.goal.outcome * 100)}%`;
  return base;
};

export const entryWhy = (g) => g.reason;

export const entrySaving = (g) =>
  g.saved >= 0.1 ? `${euro(g.saved)} less than ${NAIVE[g.goal.device]}` : null;

// Morning headline
export const summaryHeadline = (household, result) => {
  const missed = result.goals.find((g) => g.goal.firm === 'must' && !g.met);
  if (!missed) return 'Everything was ready.';
  if (missed.goal.device === 'car') {
    return `The car only reached ${carPercentAt(household, missed, missed.reachedByDeadline)}%.`;
  }
  return `${missed.goal.device === 'heating' ? 'The house' : 'Hot water'} wasn't ready on time.`;
};

export const missedExplanation = (household, g) => {
  const target = Math.round(g.goal.outcome * 100);
  if (g.goal.device !== 'car') return `It was ready ${g.lateBy} minutes late.`;
  const plugged = clock(slotClock(g.win?.from ?? g.start));
  return `It was plugged in at ${plugged}, too late to reach ${target}% by ${clock(g.goal.by)}. It charged at full speed from then on, and will be at ${target}% by ${clock(g.finishClock)} if left plugged in.`;
};

export const rangeKm = (household, percent) => Math.round((household.car.capacityKwh * percent) / 100 * 6);

export const overnightSaved = (result) =>
  result.goals.filter((g) => g.start !== undefined && g.start < clockSlot('07:00')).reduce((s, g) => s + g.saved, 0);
