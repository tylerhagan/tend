// The simulated world around a household: a dynamic tariff, a solar
// forecast and the household's own background use. All values are
// plausible for a German home in late October, and all of them are invented.
import { SLOTS, slotMinutes } from './time.js';

// Dynamic tariff, € per kWh including fees, by hour of day. Expensive in the
// evening peak, cheapest overnight and around midday.
const HOURLY_PRICE = {
  0: 0.23, 1: 0.21, 2: 0.2, 3: 0.2, 4: 0.21, 5: 0.24, 6: 0.29, 7: 0.33,
  8: 0.31, 9: 0.27, 10: 0.23, 11: 0.21, 12: 0.2, 13: 0.21, 14: 0.23, 15: 0.26,
  16: 0.3, 17: 0.34, 18: 0.36, 19: 0.38, 20: 0.34, 21: 0.3, 22: 0.27, 23: 0.25,
};

// What exported solar earns per kWh; the opportunity cost of using it at home
export const FEED_IN = 0.08;

export const priceAt = (slot) => {
  const m = slotMinutes(slot);
  const h = Math.floor(m / 60);
  const next = HOURLY_PRICE[(h + 1) % 24];
  const t = (m % 60) / 60;
  // Interpolate within the hour, plus a small deterministic wobble so the
  // curve looks like a market rather than a staircase
  const wobble = Math.sin(slot * 1.7) * 0.004;
  return +(HOURLY_PRICE[h] * (1 - t) + next * t + wobble).toFixed(4);
};

export const prices = () => Array.from({ length: SLOTS }, (_, i) => priceAt(i));

// Solar output in kW for a system of `kwp`. Late-October day: roughly
// 07:45 to 17:15, peaking at about 55% of rated power.
export const solarAt = (slot, kwp, sky = 0.55) => {
  const h = slotMinutes(slot) / 60;
  const rise = 7.75;
  const set = 17.25;
  if (h <= rise || h >= set) return 0;
  return +(kwp * sky * Math.sin((Math.PI * (h - rise)) / (set - rise))).toFixed(3);
};

// Background household use in kW (lights, cooking, fridge), scaled by the
// number of people and whether someone is home in the day
export const baseLoadAt = (slot, people, homeInDay) => {
  const h = slotMinutes(slot) / 60;
  let kw;
  if (h >= 18 && h < 22) kw = 0.55 + 0.22 * people; // evening
  else if (h >= 22 || h < 6) kw = 0.18 + 0.03 * people; // night
  else if (h >= 6 && h < 9) kw = 0.45 + 0.18 * people; // morning
  else kw = homeInDay ? 0.35 + 0.1 * people : 0.2 + 0.02 * people; // day
  return +kw.toFixed(3);
};
