import { useCallback, useEffect, useMemo, useState } from 'react';
import { households, HOUSEHOLD_ORDER } from './sim/households.js';
import { plan, findConflicts } from './sim/planner.js';
import { clockSlot } from './sim/time.js';
import { clock, euro } from './copy.js';
import Today from './ui/Today.jsx';
import Goals, { GoalBuilder } from './ui/Goals.jsx';
import Week from './ui/Week.jsx';
import Sheet from './ui/Sheet.jsx';

const NOW = clockSlot('21:15'); // "now" for tonight's overrides
const LATE_LAST_NIGHT = clockSlot('05:15');
const LATE_TONIGHT = clockSlot('04:30');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TABS = [
  ['today', 'Today'],
  ['goals', 'Goals'],
  ['week', 'Week'],
];

const freshState = (id) => ({
  goals: households[id].goals,
  paused: {},
  approvals: {},
  tonight: {}, // per-goal overrides for tonight only
  tonightGoals: {}, // per-goal sentence changes for tonight only
  mode: households[id].mode ?? 'act',
});

export default function App() {
  const [hid, setHid] = useState('p1');
  const [scenario, setScenario] = useState('normal');
  const [tab, setTab] = useState('today');
  const [s, setS] = useState(() => freshState('p1'));
  const [sheet, setSheet] = useState(null);
  const [note, setNote] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);

  const household = households[hid];
  const hasCar = s.goals.some((g) => g.device === 'car');
  const active = s.goals.filter((g) => !s.paused[g.id]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4200);
    return () => clearTimeout(t);
  }, [note]);

  const switchHousehold = (id) => {
    setHid(id);
    setS(freshState(id));
    setSheet(null);
  };

  // Last night: optionally the car was plugged in late
  const lastNight = useMemo(
    () => plan(household, {
      night: 0,
      goals: active,
      overrides: scenario === 'late' && hasCar ? { 'g-car': { fromSlot: LATE_LAST_NIGHT } } : {},
    }),
    [household, active, scenario, hasCar]
  );

  // Tonight: tonight-only changes and overrides on top of the goals
  const tonightGoals = active.map((g) => ({ ...g, ...(s.tonightGoals[g.id] ?? {}) }));
  const tonightOverrides = {
    ...(scenario === 'late' && hasCar ? { 'g-car': { fromSlot: LATE_TONIGHT } } : {}),
    ...s.tonight,
  };
  const tonightOpts = { night: 1, goals: tonightGoals, overrides: tonightOverrides };
  const tonight = useMemo(() => plan(household, tonightOpts), [household, JSON.stringify(tonightOpts)]);

  // A conflict tonight, with two ways out, each priced by the planner
  const conflict = useMemo(() => {
    const [c] = findConflicts(household, tonightOpts);
    if (!c) return null;
    const late = tonight.goals.find((g) => g.id === c.goal.id);
    const other = c.with.find((g) => g.firm === 'must') ?? c.with[0];
    const options = [
      {
        id: 'relax',
        label: `Let the car finish at ${clock(late.finishClock)} instead`,
        apply: { tonightGoals: { [c.goal.id]: { firm: 'should' } } },
      },
    ];
    if (other) {
      const earlier = clockSlot(other.from) - 4; // one hour earlier
      const opts = { ...tonightOpts, overrides: { ...tonightOverrides, [other.id]: { fromSlot: earlier } } };
      const alt = plan(household, opts);
      if (alt.allMet) {
        const delta = alt.cost - tonight.cost;
        const what = other.device === 'heating' ? 'Start heating' : 'Heat the water';
        options.push({
          id: 'earlier',
          label: `${what} an hour earlier, so both are ready (${delta > 0.04 ? `about ${euro(delta)} more` : 'no extra cost'})`,
          apply: { tonight: { [other.id]: { fromSlot: earlier } } },
        });
      }
    }
    return { goal: c.goal, with: c.with, lateBy: late.lateBy, finishClock: late.finishClock, options };
  }, [household, tonight, JSON.stringify(tonightOpts)]);

  // A simulated week: Thursday the car is plugged in late; weekends someone is home
  const nights = useMemo(
    () => DAYS.map((day, d) => {
      const h = d >= 5 ? { ...household, homeInDay: true } : household;
      const r = plan(h, { night: d, goals: active, overrides: d === 3 && hasCar ? { 'g-car': { fromSlot: LATE_LAST_NIGHT } } : {} });
      return { day, saved: r.saved, allMet: r.allMet };
    }),
    [household, active, hasCar]
  );

  const update = (patch) => setS((prev) => ({ ...prev, ...patch }));

  const openOverride = (g) => {
    const from = Math.max(NOW, g.win?.from ?? NOW);
    const alt = plan(household, { ...tonightOpts, overrides: { ...tonightOverrides, [g.id]: { asap: true, fromSlot: from } } });
    const altGoal = alt.goals.find((x) => x.id === g.id);
    setSheet({ type: 'override', g, altGoal, from, delta: altGoal.cost - g.cost, scope: 'once' });
  };

  const confirmOverride = () => {
    const { g, from, scope } = sheet;
    if (scope === 'once') {
      update({ tonight: { ...s.tonight, [g.id]: { asap: true, fromSlot: from } } });
      setNote(`Done. ${g.goal.device === 'car' ? 'The car is charging now' : 'Running now'}. Tomorrow Tend goes back to the cheapest hours.`);
    } else {
      update({ paused: { ...s.paused, [g.id]: true } });
      setNote('Done. This now runs as soon as it’s ready. Let Tend time it again from Goals.');
    }
    setSheet(null);
  };

  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <div className="stage">
      <main className="app" aria-label="Tend app (concept)">
        <div className="app-bar">
          <span className="wordmark">tend</span>
          <span className="app-bar-meta">{household.short}</span>
        </div>

        {tab === 'today' && (
          <Today
            household={household}
            lastNight={lastNight}
            tonight={tonight}
            conflict={conflict}
            mode={s.mode}
            approvals={s.approvals}
            onOverride={openOverride}
            onPause={(goal) => setSheet({ type: 'pause', goal })}
            onApprove={(goal, yes) => update({ approvals: { ...s.approvals, [goal.id]: yes } })}
            onResolve={(o) => {
              update({ tonight: { ...s.tonight, ...(o.apply.tonight ?? {}) }, tonightGoals: { ...s.tonightGoals, ...(o.apply.tonightGoals ?? {}) } });
              setNote('Done. Tonight’s plan is updated. Your goals stay as they are.');
            }}
            onEditGoals={() => setTab('goals')}
            onNote={setNote}
          />
        )}
        {tab === 'goals' && (
          <Goals
            household={household}
            goals={s.goals}
            paused={s.paused}
            onEdit={(goal) => setSheet({ type: 'edit', goal })}
            onResume={(goal) => update({ paused: { ...s.paused, [goal.id]: false } })}
          />
        )}
        {tab === 'week' && (
          <Week household={household} nights={nights} mode={s.mode} onNote={setNote} onPromote={() => { update({ mode: 'act' }); setNote('Tend will go ahead and tell you each morning.'); }} />
        )}

        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}>
              {label}
            </button>
          ))}
        </nav>

        {note && <div className="toast" role="status">{note}</div>}

        {sheet?.type === 'override' && (
          <Sheet title="Run it now" onClose={closeSheet}>
            <p className="sheet-title">{sheet.g.goal.device === 'car' ? 'Charge the car now?' : 'Run it now?'}</p>
            <p className="sheet-sub">
              {sheet.delta > 0.04
                ? <>Doing it now instead of from {clock(sheet.g.startClock)} costs about <strong>{euro(sheet.delta)}</strong> more.</>
                : <>Doing it now costs about the same as the plan.</>}{' '}
              {sheet.altGoal.finishClock && `It’ll be done by ${clock(sheet.altGoal.finishClock)}.`}
            </p>
            <fieldset className="scope">
              <legend className="visually-hidden">How long for</legend>
              <label><input type="radio" name="scope" checked={sheet.scope === 'once'} onChange={() => setSheet({ ...sheet, scope: 'once' })} /> Just tonight</label>
              <label><input type="radio" name="scope" checked={sheet.scope === 'always'} onChange={() => setSheet({ ...sheet, scope: 'always' })} /> Always run it as soon as it’s ready</label>
            </fieldset>
            <div className="actions">
              <button type="button" className="btn" onClick={confirmOverride}>{sheet.g.goal.device === 'car' ? 'Charge now' : 'Run now'}</button>
              <button type="button" className="btn ghost" onClick={closeSheet}>Keep the plan</button>
            </div>
          </Sheet>
        )}

        {sheet?.type === 'pause' && (
          <Sheet title="Stop timing this" onClose={closeSheet}>
            <p className="sheet-title">Stop timing the {sheet.goal.device === 'washing' ? 'washing' : 'dishwasher'}?</p>
            <p className="sheet-sub">It will run as soon as you start it, like before Tend. You can let Tend time it again from Goals.</p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => { update({ paused: { ...s.paused, [sheet.goal.id]: true } }); setSheet(null); setNote('Done. Tend won’t move it any more.'); }}>Stop timing it</button>
              <button type="button" className="btn ghost" onClick={closeSheet}>Keep it</button>
            </div>
          </Sheet>
        )}

        {sheet?.type === 'edit' && (
          <Sheet title="Change this goal" onClose={closeSheet}>
            <GoalBuilder
              goal={sheet.goal}
              onCancel={closeSheet}
              onSave={(draft) => {
                update({ goals: s.goals.map((g) => (g.id === draft.id ? draft : g)) });
                setSheet(null);
                setNote('Saved. Tonight’s plan is updated.');
              }}
            />
          </Sheet>
        )}
      </main>

      <aside className={`demo ${demoOpen ? 'is-open' : ''}`} aria-label="Demo controls">
        <button type="button" className="demo-toggle" aria-expanded={demoOpen} onClick={() => setDemoOpen(!demoOpen)}>
          Demo controls
        </button>
        <div className="demo-body">
          <p className="demo-kicker">Concept · simulated data</p>
          <h2 className="demo-title">Tend</h2>
          <p className="demo-text">
            Hand everyday energy decisions to automation without losing control. Pick a household and a night, then try overriding, pausing and changing goals.
          </p>
          <fieldset className="demo-group">
            <legend>Household</legend>
            {HOUSEHOLD_ORDER.map((id) => (
              <button key={id} type="button" className="demo-opt" aria-pressed={hid === id} onClick={() => switchHousehold(id)}>
                {households[id].name}
              </button>
            ))}
          </fieldset>
          <fieldset className="demo-group">
            <legend>Night</legend>
            <button type="button" className="demo-opt" aria-pressed={scenario === 'normal'} onClick={() => setScenario('normal')}>A normal night</button>
            <button type="button" className="demo-opt" aria-pressed={scenario === 'late'} disabled={!hasCar} onClick={() => setScenario('late')}>The car was plugged in late</button>
          </fieldset>
          <fieldset className="demo-group">
            <legend>How Tend acts</legend>
            <button type="button" className="demo-opt" aria-pressed={s.mode === 'suggest'} onClick={() => update({ mode: 'suggest' })}>Asks first</button>
            <button type="button" className="demo-opt" aria-pressed={s.mode === 'act'} onClick={() => update({ mode: 'act' })}>Acts, then tells you</button>
          </fieldset>
          <p className="demo-foot">
            A self-initiated concept by <a href="https://tylerhagan.co.uk">Tyler Hagan</a>. Fictional product; prices, devices and households are simulated.
          </p>
        </div>
      </aside>
    </div>
  );
}
