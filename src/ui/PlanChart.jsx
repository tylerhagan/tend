import { slotClock } from '../sim/time.js';
import { entryTitle } from '../copy.js';

// Tonight at a glance: the price through the night as a soft area, and a
// row per goal showing when Tend runs it. Covers 18:00 to 08:00.
const END = 56; // 08:00
const W = 340;
const LABEL = 104;
const ROW = 28;
const PRICE_H = 44;

export default function PlanChart({ result }) {
  const goals = result.goals.filter((g) => g.slots.some((i) => i < END));
  const H = PRICE_H + 14 + goals.length * ROW + 22;
  const x = (slot) => LABEL + ((W - LABEL) * slot) / END;
  const prices = result.world.slice(0, END).map((w) => w.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const y = (p) => PRICE_H - 4 - ((p - lo) / (hi - lo || 1)) * (PRICE_H - 12);
  const area =
    `M ${x(0)} ${PRICE_H} ` +
    prices.map((p, i) => `L ${x(i)} ${y(p)} L ${x(i + 1)} ${y(p)}`).join(' ') +
    ` L ${x(END)} ${PRICE_H} Z`;
  const ticks = [8, 24, 40]; // 20:00, 00:00, 04:00

  return (
    <figure className="plan-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="When Tend runs each goal tonight, against the electricity price">
        <text x="0" y="16" className="pc-label">Price</text>
        <text x="0" y="32" className="pc-sub">cheapest overnight</text>
        <path d={area} className="pc-price" />
        {goals.map((g, r) => {
          const top = PRICE_H + 14 + r * ROW;
          const runs = [];
          g.slots.filter((i) => i < END).forEach((i) => {
            const last = runs[runs.length - 1];
            if (last && last[1] === i) last[1] = i + 1;
            else runs.push([i, i + 1]);
          });
          return (
            <g key={g.id}>
              <text x="0" y={top + 19} className="pc-row">{entryTitle(g, 'future').replace(/ to \d+%$/, '')}</text>
              <line x1={LABEL} x2={W} y1={top + 15} y2={top + 15} className="pc-track" />
              {runs.map(([a, b]) => (
                <rect key={a} x={x(a)} y={top + 7} width={Math.max(3, x(b) - x(a))} height="16" rx="8" className={g.met ? 'pc-run' : 'pc-run late'} />
              ))}
            </g>
          );
        })}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 4} className="pc-tick">{slotClock(t).replace(/^0/, '')}</text>
        ))}
      </svg>
    </figure>
  );
}
