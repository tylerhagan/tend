// The five proto-personas as simulated households. Household types come from
// Tyler's domain experience; the numbers are illustrative, not measured.
//
// A goal is one sentence: "[device] [must|should] be [outcome] by [by] [when]".
// `from` is when the device becomes available (car plugged in, appliance loaded).
// Energy is derived from the device for the car; fixed for heat and appliances.

export const DEVICE_NAMES = {
  car: 'The car',
  heating: 'The house',
  hotwater: 'Hot water',
  dishwasher: 'The dishwasher',
  washing: 'The washing',
};

export const households = {
  p1: {
    id: 'p1',
    name: 'The busy family home',
    short: 'Busy family',
    people: 6,
    homeInDay: false,
    solarKwp: 12,
    battery: { capacityKwh: 15, soc: 0.4, maxKw: 5 },
    limitKw: 11,
    car: { name: 'Family EV', capacityKwh: 77, soc: 0.35, maxKw: 11 },
    goals: [
      { id: 'g-car', device: 'car', firm: 'must', outcome: 0.8, from: '18:30', by: '07:00', when: 'weekdays' },
      { id: 'g-hot', device: 'hotwater', firm: 'must', outcome: 'ready', energyKwh: 5, maxKw: 3, from: '18:00', by: '06:00', when: 'every day' },
      { id: 'g-heat', device: 'heating', firm: 'must', outcome: '21 °C', energyKwh: 6, maxKw: 3, from: '03:30', by: '06:30', when: 'every day', note: 'cold' },
      { id: 'g-dish', device: 'dishwasher', firm: 'should', outcome: 'finished', energyKwh: 1.2, runMin: 120, from: '20:30', by: '07:00', when: 'every day' },
      { id: 'g-wash', device: 'washing', firm: 'should', outcome: 'finished', energyKwh: 1.0, runMin: 120, from: '07:30', by: '16:00', when: 'every day' },
    ],
  },
  p2: {
    id: 'p2',
    name: 'The rural home',
    short: 'Rural home',
    people: 3,
    homeInDay: true,
    solarKwp: 18,
    battery: { capacityKwh: 20, soc: 0.5, maxKw: 6 },
    limitKw: 13,
    car: { name: 'Estate EV', capacityKwh: 60, soc: 0.3, maxKw: 11 },
    goals: [
      { id: 'g-car', device: 'car', firm: 'must', outcome: 1, from: '19:00', by: '08:00', when: 'tomorrow only', note: 'long drive' },
      { id: 'g-hot', device: 'hotwater', firm: 'must', outcome: 'ready', energyKwh: 6, maxKw: 3, from: '18:00', by: '06:00', when: 'every day' },
      { id: 'g-heat', device: 'heating', firm: 'must', outcome: '20 °C', energyKwh: 9, maxKw: 4, from: '02:00', by: '06:00', when: 'every day', note: 'cold' },
    ],
  },
  p3: {
    id: 'p3',
    name: 'The city professional',
    short: 'City professional',
    people: 1,
    homeInDay: false,
    solarKwp: 5,
    battery: null,
    limitKw: 11,
    car: { name: 'Saloon EV', capacityKwh: 82, soc: 0.45, maxKw: 11 },
    goals: [
      { id: 'g-car', device: 'car', firm: 'must', outcome: 0.8, from: '22:30', by: '07:30', when: 'weekdays' },
    ],
  },
  p4: {
    id: 'p4',
    name: 'The everyday family',
    short: 'Everyday family',
    people: 4,
    homeInDay: false,
    solarKwp: 9,
    battery: { capacityKwh: 10, soc: 0.35, maxKw: 4 },
    limitKw: 11,
    car: { name: 'Compact EV', capacityKwh: 58, soc: 0.4, maxKw: 11 },
    goals: [
      { id: 'g-car', device: 'car', firm: 'must', outcome: 0.8, from: '18:45', by: '07:00', when: 'weekdays' },
      { id: 'g-heat', device: 'heating', firm: 'must', outcome: '21 °C', energyKwh: 5, maxKw: 3, from: '04:00', by: '06:30', when: 'weekdays' },
      { id: 'g-dish', device: 'dishwasher', firm: 'should', outcome: 'finished', energyKwh: 1.1, runMin: 120, from: '20:00', by: '07:00', when: 'every day' },
    ],
  },
  p5: {
    id: 'p5',
    name: 'The retired couple',
    short: 'Retired couple',
    people: 2,
    homeInDay: true,
    solarKwp: 6,
    battery: { capacityKwh: 8, soc: 0.45, maxKw: 3 },
    limitKw: 11,
    car: { name: 'Plug-in hybrid', capacityKwh: 18, soc: 0.2, maxKw: 3.7 },
    mode: 'suggest',
    goals: [
      { id: 'g-heat', device: 'heating', firm: 'must', outcome: '21 °C', energyKwh: 7, maxKw: 3, from: '03:30', by: '06:30', when: 'every day', note: 'cold' },
      { id: 'g-car', device: 'car', firm: 'should', outcome: 1, from: '17:00', by: '10:00', when: 'every day' },
    ],
  },
};

export const HOUSEHOLD_ORDER = ['p1', 'p2', 'p3', 'p4', 'p5'];

// Energy a goal needs, in kWh
export const goalEnergy = (goal, household) => {
  if (goal.device === 'car') {
    const { capacityKwh, soc } = household.car;
    return Math.max(0, +(capacityKwh * (goal.outcome - soc)).toFixed(2));
  }
  return goal.energyKwh;
};

export const goalMaxKw = (goal, household) =>
  goal.device === 'car' ? household.car.maxKw : goal.runMin ? goal.energyKwh / (goal.runMin / 60) : goal.maxKw;

// The goal as the household reads it
export const goalSentence = (goal) => {
  const device = DEVICE_NAMES[goal.device];
  const verb = goal.firm === 'must' ? 'must' : 'should';
  const outcome =
    goal.device === 'car'
      ? `be at ${Math.round(goal.outcome * 100)}%`
      : goal.device === 'heating'
        ? `be at ${goal.outcome}`
        : `be ${goal.outcome}`;
  const by = goal.device === 'heating' ? `from ${goal.by.replace(/^0/, '')}` : `by ${goal.by.replace(/^0/, '')}`;
  const when = goal.when === 'tomorrow only' ? 'tomorrow only' : `on ${goal.when}`.replace('on every day', 'every day');
  return `${device} ${verb} ${outcome} ${by} ${when}.`;
};
