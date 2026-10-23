import { euro } from '../copy.js';

const FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

export default function Week({ household, nights, mode, onPromote, onNote }) {
  const total = nights.reduce((s, n) => s + n.saved, 0);
  const met = nights.filter((n) => n.allMet).length;
  const late = nights.find((n) => !n.allMet);
  return (
    <div className="screen">
      <header className="screen-head">
        <p className="eyebrow">This week</p>
        <h1 className="headline">{euro(total)} saved, goals met {met} of {nights.length} nights.</h1>
        <p className="lede">Compared with running everything as soon as it could. Simulated week.</p>
      </header>

      <section aria-labelledby="nights-h">
        <h2 id="nights-h" className="section-h">Night by night</h2>
        <ul className="nights">
          {nights.map((n) => (
            <li key={n.day} className={n.allMet ? '' : 'is-miss'}>
              <span className="night-day">{n.day}</span>
              <span className="night-bar" style={{ '--w': `${Math.max(6, (n.saved / Math.max(...nights.map((x) => x.saved))) * 100)}%` }} aria-hidden="true" />
              <span className="night-val">{euro(n.saved)}</span>
              <span className="night-state">{n.allMet ? 'All ready' : 'Car late'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="noticed-h">
        <h2 id="noticed-h" className="section-h">What Tend noticed</h2>
        <div className="cards">
          {late && household.car && (
            <div className="card">
              <p className="card-title">The car was plugged in late on {FULL[late.day]}.</p>
              <p>That was the only night a goal was missed. A reminder at 21:00 on weeknights would catch it.</p>
              <button type="button" className="btn small ghost" onClick={() => onNote('Tend will remind you at 21:00 on weeknights if the car isn’t plugged in.')}>Remind me at 21:00</button>
            </div>
          )}
          {mode === 'suggest' ? (
            <div className="card is-tend">
              <p className="card-title">You said yes to Tend’s timing every night this week.</p>
              <p>Let Tend go ahead and tell you afterwards, instead of asking first? You can switch back at any time.</p>
              <button type="button" className="btn small" onClick={onPromote}>Let Tend go ahead</button>
            </div>
          ) : (
            <div className="card">
              <p className="card-title">Tend acts, then tells you each morning.</p>
              <p>Everything it did is in the morning summary, and every goal can still be changed or paused.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
