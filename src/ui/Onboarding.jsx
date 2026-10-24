import { useState } from 'react';
import { GoalBuilder } from './Goals.jsx';

// First run: what's in the home, a first goal, then how Tend should act.
// The first goal is pre-filled, so most people only confirm it (A2).
const DEVICES = [
  ['car', 'Electric car'],
  ['heating', 'Heat pump'],
  ['hotwater', 'Hot water'],
  ['battery', 'Home battery'],
  ['dishwasher', 'Dishwasher'],
];

export default function Onboarding({ household, onDone }) {
  const [step, setStep] = useState(0);
  const [have, setHave] = useState(() => new Set(['car', 'heating']));
  const [goal, setGoal] = useState(household.goals.find((g) => g.device === 'car') ?? household.goals[0]);

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Setup · step {step + 1} of 3</p>
        <h1 className="headline">
          {['What’s in your home?', 'Your first goal', 'How should Tend act?'][step]}
        </h1>
        <p className="lede">
          {[
            'Solar is a given. Pick what Tend can look after; you can add more later.',
            'Most people start with the car. Change anything that’s different for you.',
            'You can change this at any time, for each device on its own.',
          ][step]}
        </p>
      </header>

      {step === 0 && (
        <div className="options" role="group" aria-label="Devices">
          {DEVICES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="btn ghost"
              aria-pressed={have.has(id)}
              onClick={() => { const n = new Set(have); n.has(id) ? n.delete(id) : n.add(id); setHave(n); }}
            >
              {label}
            </button>
          ))}
          <div className="actions" style={{ width: '100%', marginTop: 'var(--space-4)' }}>
            <button type="button" className="btn" onClick={() => setStep(1)}>Continue</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <GoalBuilder household={household} goal={goal} title="" onCancel={() => setStep(0)} onSave={(g) => { setGoal(g); setStep(2); }} />
      )}

      {step === 2 && (
        <div className="cards">
          <button type="button" className="card choice-card" onClick={() => onDone(goal, 'suggest')}>
            <span className="card-title">Ask me first (recommended)</span>
            <span>Tend suggests each action and waits for a yes. Once you trust it, it can go ahead on its own.</span>
          </button>
          <button type="button" className="card choice-card" onClick={() => onDone(goal, 'act')}>
            <span className="card-title">Go ahead and tell me</span>
            <span>Tend acts, then explains everything in a short summary each morning.</span>
          </button>
        </div>
      )}
    </div>
  );
}
