import PlanChart from './PlanChart.jsx';
import {
  clock, euro, entryTitle, entryWhy, entrySaving, summaryHeadline,
  missedExplanation, carPercentAt, rangeKm, overnightSaved,
} from '../copy.js';
import { clockSlot } from '../sim/time.js';

const MORNING = clockSlot('07:00');

function GoalCheck({ household, g }) {
  const label =
    g.goal.device === 'car'
      ? `Car ${Math.round(g.goal.outcome * 100)}% by ${clock(g.goal.by)}`
      : g.goal.device === 'heating'
        ? `House ${g.goal.outcome} from ${clock(g.goal.by)}`
        : `Hot water by ${clock(g.goal.by)}`;
  const value = g.met
    ? `Done ${clock(g.finishClock)}`
    : g.goal.device === 'car'
      ? `${carPercentAt(household, g, g.reachedByDeadline)}%`
      : `${g.lateBy} min late`;
  return (
    <li className={`check ${g.met ? 'is-ok' : 'is-miss'}`}>
      <span className="check-mark" aria-hidden="true">{g.met ? '✓' : '!'}</span>
      <span className="check-label">{label}</span>
      <span className="check-value">{value}</span>
    </li>
  );
}

export default function Today({
  household, lastNight, tonight, conflict, mode, approvals, pausedAll, onResumeAll,
  onOverride, onPause, onApprove, onResolve, onEditGoals, onNote,
}) {
  const missed = lastNight.goals.find((g) => g.goal.firm === 'must' && !g.met);
  const musts = lastNight.goals.filter((g) => g.goal.firm === 'must');
  const done = lastNight.goals
    .filter((g) => g.start !== undefined && g.start < MORNING)
    .sort((a, b) => a.start - b.start);
  const upcoming = tonight.goals.filter((g) => g.start !== undefined).sort((a, b) => a.start - b.start);
  const saved = overnightSaved(lastNight);
  const car = tonight.goals.find((g) => g.goal.device === 'car');

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">Tuesday morning · 07:05</p>
        <h1 className="headline">{summaryHeadline(household, lastNight)}</h1>
        <p className="lede">
          {missed
            ? missedExplanation(household, missed)
            : `Tend's timing saved ${euro(saved)} overnight, compared with running everything straight away.`}
        </p>
      </header>

      {missed?.goal.device === 'car' && (
        <section className="callout is-miss" aria-label="What this means">
          <p>
            At {carPercentAt(household, missed, missed.reachedByDeadline)}% it has enough for about{' '}
            <strong>{rangeKm(household, carPercentAt(household, missed, missed.reachedByDeadline))} km</strong>.
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => onNote('Tend will keep charging at full speed until 80%.')}>Keep charging</button>
            <button type="button" className="btn ghost" onClick={() => onNote('Tend will remind you at 21:00 if the car isn’t plugged in.')}>Remind me to plug in</button>
          </div>
        </section>
      )}

      <section aria-labelledby="goals-h">
        <h2 id="goals-h" className="section-h">Your goals last night</h2>
        <ul className="checks">
          {musts.map((g) => <GoalCheck key={g.id} household={household} g={g} />)}
        </ul>
      </section>

      <section aria-labelledby="did-h">
        <h2 id="did-h" className="section-h">What Tend did</h2>
        <ol className="timeline">
          {done.map((g) => (
            <li key={g.id} className="entry">
              <span className="entry-time">{clock(g.startClock)}</span>
              <div className="entry-body">
                <p className="entry-title">{entryTitle(g, 'past', household)}</p>
                <p className="entry-why">{entryWhy(g)}</p>
                {entrySaving(g) && <p className="entry-effect">{entrySaving(g)}</p>}
                <div className="entry-actions">
                  {g.goal.firm === 'should' ? (
                    <button type="button" className="link" onClick={() => onPause(g.goal)}>Don’t do this again</button>
                  ) : (
                    <button type="button" className="link" onClick={onEditGoals}>Change this goal</button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="plan-h" className="tonight">
        <div className="section-row">
          <h2 id="plan-h" className="section-h">Tonight’s plan</h2>
          <span className="pill">{mode === 'suggest' ? 'Asks you first' : 'Acts and tells you'}</span>
        </div>

        {pausedAll && (
          <div className="callout">
            <p className="callout-title">Tend is paused.</p>
            <p>Tonight everything runs as soon as it’s ready, the way it did before Tend. Your goals are kept.</p>
            <div className="actions"><button type="button" className="btn small" onClick={onResumeAll}>Resume Tend</button></div>
          </div>
        )}

        {conflict && (
          <div className="callout is-miss" role="alert">
            <p className="callout-title">The car and the {conflict.with[0]?.device === 'hotwater' ? 'hot water' : 'heating'} need power at the same time.</p>
            <p>The car was plugged in late tonight, so it would reach {Math.round(conflict.goal.outcome * 100)}% at {clock(conflict.finishClock)}, {conflict.lateBy} minutes after {clock(conflict.goal.by)}.</p>
            <div className="actions stack">
              {conflict.options.map((o) => (
                <button key={o.id} type="button" className="btn ghost wide" onClick={() => onResolve(o)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <PlanChart result={tonight} />

        <ol className="timeline">
          {upcoming.map((g) => {
            const approved = approvals[g.id];
            return (
              <li key={g.id} className="entry">
                <span className="entry-time">{clock(g.startClock)}</span>
                <div className="entry-body">
                  <p className="entry-title">{entryTitle(g, 'future')}</p>
                  <p className="entry-why">{entryWhy(g)}{g.met ? '' : ` · ready ${g.lateBy} min late`}</p>
                  <div className="entry-actions">
                    {mode === 'suggest' && approved === undefined ? (
                      <>
                        <button type="button" className="btn small" onClick={() => onApprove(g.goal, true)}>Yes, do this</button>
                        <button type="button" className="btn small ghost" onClick={() => onApprove(g.goal, false)}>Not tonight</button>
                      </>
                    ) : mode === 'suggest' ? (
                      <span className="entry-state">{approved ? 'You said yes' : 'Skipped tonight'}</span>
                    ) : null}
                    <button type="button" className="link" onClick={() => onOverride(g)}>Run it now instead</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="quick-h">
        <h2 id="quick-h" className="section-h">Something different today?</h2>
        <div className="quick">
          {car && <button type="button" className="btn wide" onClick={() => onOverride(car)}>I need the car sooner</button>}
          <button type="button" className="btn ghost wide" onClick={() => onNote('Daytime heating now follows your goals today. Back to normal tomorrow.')}>Someone’s home today</button>
          <button type="button" className="btn ghost wide" onClick={() => onNote('Guest mode for 3 nights: more hot water, appliances can wait.')}>We have guests</button>
        </div>
      </section>
    </div>
  );
}
