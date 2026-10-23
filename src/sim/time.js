// The planning window runs from 18:00 one evening to 18:00 the next, in
// 15-minute slots: slot 0 is 18:00, slot 95 is 17:45 the next day.
export const SLOT_MIN = 15;
export const SLOTS = 96;
export const START_MIN = 18 * 60;
export const SLOT_H = SLOT_MIN / 60;

// Minutes since midnight for a slot (wraps past midnight)
export const slotMinutes = (slot) => (START_MIN + slot * SLOT_MIN) % 1440;

// "HH:MM" for a slot
export const slotClock = (slot) => {
  const m = slotMinutes(slot);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Slot for a clock time ("06:30"). Times before 18:00 fall on the next morning.
export const clockSlot = (clock) => {
  const [h, m] = clock.split(':').map(Number);
  const mins = h * 60 + m;
  const offset = (mins - START_MIN + 1440) % 1440;
  return Math.round(offset / SLOT_MIN);
};
