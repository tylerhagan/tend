import { useState } from 'react';
import { goalSentence } from '../sim/households.js';
import { clock } from '../copy.js';

// Options a household can pick for each clause of a goal sentence
export const CLAUSES = {
  firm: { label: 'How firm', options: ['must', 'should'] },
  outcome: {
    label: 'Outcome',
    options: {
      car: [0.6, 0.8, 1, { km: 50 }, { km: 150 }, { km: 300 }],
      heating: ['19 °C', '20 °C', '21 °C', '22 °C'],
      hotwater: ['ready'],
      dishwasher: ['finished'],
      washing: ['finished'],
    },
  },
  by: { label: 'Time', options: ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '10:00', '16:00'] },
  when: { label: 'When', options: ['weekdays', 'every day', 'tomorrow only'] },
};

const KM_PER_KWH = 6;
const show = (key, v) =>
  key === 'outcome' && v?.km ? `enough for ${v.km} km` : key === 'outcome' && typeof v === 'number' ? `${Math.round(v * 100)}%` : key === 'by' ? clock(v) : v;

// Clause-by-clause builder: the sentence is the form
export function GoalBuilder({ goal, household, onSave, onCancel, title = 'Change this goal' }) {
  const [draft, setDraft] = useState(goal);
  const [open, setOpen] = useState(null);
  // A range goal is stored as the charge level it needs, so the planner is unchanged
  const pick = (key, v) => {
    if (key === 'outcome' && v?.km && household?.car) {
      const level = Math.min(1, household.car.soc + v.km / KM_PER_KWH / household.car.capacityKwh);
      setDraft({ ...draft, outcome: +level.toFixed(2), km: v.km });
    } else if (key === 'outcome') setDraft({ ...draft, outcome: v, km: undefined });
    else setDraft({ ...draft, [key]: v });
    setOpen(null);
  };
  const current = (key) => (key === 'outcome' && draft.km ? { km: draft.km } : draft[key]);
  const chip = (key) => (
    <button
      type="button"
      className="chip"
      aria-expanded={open === key}
      aria-label={`${CLAUSES[key].label}: ${show(key, current(key))}. Change`}
      onClick={() => setOpen(open === key ? null : key)}
    >
      {show(key, current(key))}
    </button>
  );
  const options = open === 'outcome' ? CLAUSES.outcome.options[draft.device] : open ? CLAUSES[open].options : [];
  const subject = { car: 'The car', heating: 'The house', hotwater: 'Hot water', dishwasher: 'The dishwasher', washing: 'The washing' }[draft.device];
  const verb = draft.device === 'heating' ? 'from' : 'by';
  const be = draft.km ? 'have' : ['hotwater', 'dishwasher', 'washing'].includes(draft.device) ? 'be' : 'be at';

  return (
    <div className="builder">
      {title && <p className="sheet-title">{title}</p>}
      <p className="sheet-sub">Tap any underlined part.</p>
      <p className="sentence">
        {subject} {chip('firm')} {be} {chip('outcome')} {verb} {chip('by')} {draft.when === 'tomorrow only' ? '' : draft.when === 'every day' ? '' : 'on '}{chip('when')}.
      </p>
      {open && (
        <div className="options" role="group" aria-label={CLAUSES[open].label}>
          {options.map((v) => (
            <button
              key={String(v)}
              type="button"
              className="btn small ghost"
              aria-pressed={JSON.stringify(current(open)) === JSON.stringify(v)}
              onClick={() => pick(open, v)}
            >
              {show(open, v)}
            </button>
          ))}
        </div>
      )}
      <p className="readback">
        {draft.firm === 'must'
          ? 'Tend will always have this done on time, even on an expensive night.'
          : 'Tend aims for this, and may finish later if doing it on time would cost a lot more.'}
      </p>
      <div className="actions">
        <button type="button" className="btn" onClick={() => onSave(draft)}>Save goal</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function Goals({ household, goals, paused, onEdit, onResume }) {
  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">{household.name}</p>
        <h1 className="headline">Your goals</h1>
        <p className="lede">Say what needs to be ready, and when. Tend decides the hours.</p>
      </header>
      <ul className="goal-list">
        {goals.map((g) => (
          <li key={g.id} className={`goal ${paused[g.id] ? 'is-paused' : ''}`}>
            <p className="goal-sentence">{goalSentence(g)}</p>
            <div className="goal-meta">
              <span className="pill">{paused[g.id] ? 'Paused: runs when you start it' : g.firm === 'must' ? 'Never missed to save money' : 'Flexible if it saves a lot'}</span>
              {paused[g.id] ? (
                <button type="button" className="link" onClick={() => onResume(g)}>Let Tend time it again</button>
              ) : (
                <button type="button" className="link" onClick={() => onEdit(g)}>Change</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
