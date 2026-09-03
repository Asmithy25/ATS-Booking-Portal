import { useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Menu, Phone, ShieldCheck, X } from 'lucide-react';
import './_group.css';

const hours = ['Mon–Thu 9:00 am–6:00 pm', 'Friday 9:00 am–2:00 pm'];

function Brand() {
  return <div className="ayden-brand"><span className="ayden-mark">A</span><span>Ayden’s Therapy Services</span></div>;
}

export default function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', reason: '', date: '', time: '' });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="ayden-root ayden-noise">
      <div className="ayden-topline"><span className="ayden-mono">Private, phone-based support · South Florida and beyond</span></div>
      <header className="ayden-shell ayden-nav">
        <a className="ayden-link" href="#top"><Brand /></a>
        <nav className="ayden-navlinks">
          <a className="ayden-link" href="#approach">Our approach</a>
          <a className="ayden-link" href="#start">How to begin</a>
          <a className="ayden-link" href="#contact">Contact</a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a className="ayden-btn small sun" href="#start">Request a call <ArrowUpRight size={14} /></a>
          <button className="ayden-btn small ghost ayden-mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={15} /> : <Menu size={15} />}</button>
        </div>
      </header>
      {menuOpen && <div className="ayden-shell" style={{ padding: '14px 0', borderBottom: '1px solid var(--ay-line)', display: 'grid', gap: 11, fontSize: 12, fontWeight: 700 }}>
        <a className="ayden-link" href="#approach" onClick={() => setMenuOpen(false)}>Our approach</a>
        <a className="ayden-link" href="#start" onClick={() => setMenuOpen(false)}>How to begin</a>
        <a className="ayden-link" href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
      </div>}

      <main id="top">
        <section className="ayden-shell ayden-hero-grid" style={{ padding: '86px 0 92px', display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 70, alignItems: 'center' }}>
          <div className="ayden-fade">
            <div className="ayden-mono ayden-kicker">A place to start, without the pressure</div>
            <h1 className="ayden-display" style={{ fontSize: 'clamp(58px, 7.8vw, 112px)', lineHeight: '.88', margin: '20px 0 28px', maxWidth: 700 }}>You don’t have to carry it alone.</h1>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--ay-ink-soft)', maxWidth: 490, margin: 0 }}>Ayden’s Therapy Services offers thoughtful, phone-based therapy for the moments that ask you to pause, listen inward, and take one honest next step.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 32 }}>
              <a className="ayden-btn" href="#start">Find a time to talk <ArrowUpRight size={15} /></a>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ay-ink-soft)', fontSize: 11 }}><Phone size={14} color="var(--ay-coral)" /> 100% by phone</span>
            </div>
          </div>
          <div className="ayden-fade ayden-delay-2" style={{ minHeight: 385, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '16px 0 0 30px', background: 'var(--ay-sea)', transform: 'rotate(4deg)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'var(--ay-white)', border: '1px solid var(--ay-line)', padding: 25 }}>
              <div className="ayden-mono" style={{ color: 'var(--ay-coral)' }}>A small reminder</div>
              <div className="ayden-display" style={{ fontSize: 49, lineHeight: .98, maxWidth: 280, marginTop: 68 }}>Your pace is allowed here.</div>
              <div style={{ position: 'absolute', left: 25, right: 25, bottom: 24, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--ay-line)', paddingTop: 13, fontSize: 10, color: 'var(--ay-ink-soft)' }}><span>Ayden’s Therapy Services</span><span>01 / 03</span></div>
            </div>
            <div style={{ position: 'absolute', width: 70, height: 70, borderRadius: '50%', background: 'var(--ay-sun)', right: -25, top: 42, animation: 'ayden-drift 4s ease-in-out alternate infinite' }} />
          </div>
        </section>

        <section id="approach" style={{ background: 'var(--ay-ink)', color: 'var(--ay-paper)', padding: '74px 0 78px' }}>
          <div className="ayden-shell">
              <div className="ayden-approach-grid" style={{ display: 'grid', gridTemplateColumns: '.7fr 1.3fr', gap: 75, alignItems: 'start' }}>
              <div><div className="ayden-mono" style={{ color: 'var(--ay-sun)' }}>The Ayden approach</div><div className="ayden-display" style={{ fontSize: 49, lineHeight: .95, marginTop: 18 }}>Warmth, with somewhere to go.</div></div>
              <div>
                <p style={{ margin: 0, maxWidth: 560, fontSize: 17, lineHeight: 1.75, color: 'rgba(245,241,231,.78)' }}>Therapy can be practical and deeply human. We make room for the full picture — the pattern underneath the problem, the feeling beneath the thought, and the small changes that become a steadier life.</p>
                <div className="ayden-rule" style={{ borderColor: 'rgba(245,241,231,.2)', marginTop: 40, paddingTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
                  <div><div className="ayden-mono" style={{ color: 'var(--ay-sea)' }}>01</div><strong style={{ display: 'block', marginTop: 13, fontSize: 12 }}>Be met where you are</strong></div>
                  <div><div className="ayden-mono" style={{ color: 'var(--ay-sea)' }}>02</div><strong style={{ display: 'block', marginTop: 13, fontSize: 12 }}>Name what matters</strong></div>
                  <div><div className="ayden-mono" style={{ color: 'var(--ay-sea)' }}>03</div><strong style={{ display: 'block', marginTop: 13, fontSize: 12 }}>Move at your pace</strong></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="start" className="ayden-shell" style={{ padding: '84px 0 92px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 28, marginBottom: 34 }}>
            <div><div className="ayden-mono ayden-kicker">Take the next step</div><h2 className="ayden-display" style={{ fontSize: 56, lineHeight: .9, margin: '15px 0 0' }}>Request a consultation.</h2></div>
            <p style={{ maxWidth: 300, color: 'var(--ay-ink-soft)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>A request is not a commitment. We’ll call to learn a little about what you need and confirm a time together.</p>
          </div>
          <div className="ayden-book-grid" style={{ display: 'grid', gridTemplateColumns: '.72fr 1.28fr', gap: 18, alignItems: 'stretch' }}>
            <aside className="ayden-card" style={{ padding: 24, background: 'var(--ay-sea)' }}>
              <div className="ayden-mono">Before you begin</div>
              <div style={{ display: 'grid', gap: 22, marginTop: 32 }}>
                <div><Phone size={17} /><strong style={{ display: 'block', marginTop: 9, fontSize: 13 }}>A phone-only practice</strong><p style={{ margin: '6px 0 0', color: 'var(--ay-ink-soft)', fontSize: 11, lineHeight: 1.6 }}>No waiting room or commute. Connect from the place that feels most private to you.</p></div>
                <div><Clock3 size={17} /><strong style={{ display: 'block', marginTop: 9, fontSize: 13 }}>60-minute sessions</strong><p style={{ margin: '6px 0 0', color: 'var(--ay-ink-soft)', fontSize: 11, lineHeight: 1.6 }}>{hours.join(' · ')}. Requests are confirmed by phone.</p></div>
                <div><ShieldCheck size={17} /><strong style={{ display: 'block', marginTop: 9, fontSize: 13 }}>A private first step</strong><p style={{ margin: '6px 0 0', color: 'var(--ay-ink-soft)', fontSize: 11, lineHeight: 1.6 }}>Share only what feels right. Your information stays with the care team.</p></div>
              </div>
            </aside>
            <div className="ayden-card" style={{ padding: '25px 27px', background: 'var(--ay-white)' }}>
              {sent ? <div style={{ minHeight: 330, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 25 }}><div><div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', background: 'var(--ay-sun)', margin: '0 auto 20px' }}><Check size={21} /></div><div className="ayden-display" style={{ fontSize: 40 }}>Your request is in.</div><p style={{ color: 'var(--ay-ink-soft)', fontSize: 12, lineHeight: 1.7, maxWidth: 330 }}>Thank you, {form.name || 'there'}. A member of the team will call you at {form.phone || 'the number you shared'} to confirm the next step.</p><button className="ayden-btn ghost small" onClick={() => setSent(false)}>Send another request</button></div></div> : <form onSubmit={(event) => { event.preventDefault(); setSent(true); }}>
                <div className="ayden-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <label className="ayden-field"><span className="ayden-label">Your name</span><input className="ayden-input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Morgan Lee" required /></label>
                  <label className="ayden-field"><span className="ayden-label">Best phone number</span><input className="ayden-input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="(561) 291-8556" required /></label>
                </div>
                <label className="ayden-field" style={{ marginTop: 18 }}><span className="ayden-label">What would you like support with?</span><textarea className="ayden-input ayden-textarea" value={form.reason} onChange={(e) => update('reason', e.target.value)} placeholder="A few words are enough to begin." required minLength={10} /></label>
                <div className="ayden-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
                  <label className="ayden-field"><span className="ayden-label">Preferred date</span><input className="ayden-input" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required /></label>
                  <label className="ayden-field"><span className="ayden-label">Preferred time</span><input className="ayden-input" type="time" value={form.time} onChange={(e) => update('time', e.target.value)} required /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--ay-line)' }}><span style={{ color: 'var(--ay-ink-soft)', fontSize: 10, lineHeight: 1.5 }}>All consultations take place by phone. This form is not monitored for emergencies.</span><button className="ayden-btn" type="submit">Request my call <ArrowUpRight size={15} /></button></div>
              </form>}
            </div>
          </div>
        </section>

        <section id="contact" style={{ borderTop: '1px solid var(--ay-line)', padding: '25px 0 30px' }}>
          <div className="ayden-shell" style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <Brand /><span style={{ color: 'var(--ay-ink-soft)', fontSize: 11 }}>+1 (561) 291-8556 · aydenstherapyservices@gmail.com</span><span className="ayden-mono" style={{ color: 'var(--ay-coral)' }}>Private care, at your pace</span>
          </div>
        </section>
      </main>
    </div>
  );
}