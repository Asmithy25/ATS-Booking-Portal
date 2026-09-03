import { useState, type ReactNode } from 'react';
import { Activity, Bell, CalendarDays, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, MessageSquare, Search, Settings, Users } from 'lucide-react';
import './_group.css';

type BookingStatus = 'Confirmed' | 'Pending' | 'Needs follow-up';
type Booking = { id: number; name: string; initials: string; type: string; date: string; time: string; status: BookingStatus; note: string };

const initialBookings: Booking[] = [
  { id: 1, name: 'Morgan Lee', initials: 'ML', type: 'Individual session', date: 'Tue, Jun 18', time: '10:00 am', status: 'Confirmed', note: 'First session · phone' },
  { id: 2, name: 'Jasmine Carter', initials: 'JC', type: 'Follow-up session', date: 'Tue, Jun 18', time: '11:30 am', status: 'Pending', note: 'Requested a time change' },
  { id: 3, name: 'Ethan Brooks', initials: 'EB', type: 'Individual session', date: 'Tue, Jun 18', time: '2:00 pm', status: 'Confirmed', note: 'Ongoing care' },
  { id: 4, name: 'Noah Williams', initials: 'NW', type: 'Consultation', date: 'Wed, Jun 19', time: '9:30 am', status: 'Needs follow-up', note: 'New client inquiry' },
];

function SideLink({ icon, label, active = false, count }: { icon: ReactNode; label: string; active?: boolean; count?: number }) {
  return <a className={`ayden-side-link${active ? ' active' : ''}`} href={`#${label.toLowerCase().replaceAll(' ', '-')}`}>{icon}<span style={{ flex: 1 }}>{label}</span>{count ? <span className="ayden-mono" style={{ color: 'var(--ay-sun)' }}>{count}</span> : null}</a>;
}

export default function StaffWorkspace() {
  const [bookings, setBookings] = useState(initialBookings);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | BookingStatus>('All');
  const [toast, setToast] = useState('');
  const visible = bookings.filter((booking) => (filter === 'All' || booking.status === filter) && `${booking.name} ${booking.type}`.toLowerCase().includes(query.toLowerCase()));
  const updateStatus = (id: number, status: BookingStatus) => {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
    setToast(status === 'Confirmed' ? 'Appointment confirmed' : 'Booking moved to follow-up');
    window.setTimeout(() => setToast(''), 2400);
  };

  return <div className="ayden-root ayden-staff ayden-noise">
    <div className="ayden-topline"><span className="ayden-mono">Ayden’s Therapy Services · Staff workspace</span><span className="ayden-mono">Tuesday, June 18, 2024 · 8:42 am</span></div>
    <div className="ayden-staff-layout">
      <aside className="ayden-sidebar">
        <div className="ayden-brand"><span className="ayden-mark">A</span><span>Ayden’s<br />Therapy Services</span></div>
        <div className="ayden-mono" style={{ color: 'rgba(245,241,231,.42)', padding: '0 10px 10px' }}>Workspace</div>
        <nav>
          <SideLink icon={<LayoutDashboard size={15} />} label="Overview" active />
          <SideLink icon={<CalendarDays size={15} />} label="Bookings" count={3} />
          <SideLink icon={<Users size={15} />} label="Clients" />
          <SideLink icon={<MessageSquare size={15} />} label="Support inbox" count={2} />
          <SideLink icon={<FileText size={15} />} label="Message templates" />
          <SideLink icon={<Activity size={15} />} label="Activity history" />
        </nav>
        <div className="ayden-side-foot"><div style={{ display: 'flex', gap: 9, alignItems: 'center', color: 'var(--ay-paper)', marginBottom: 12 }}><span className="ayden-avatar" style={{ background: 'var(--ay-sun)' }}>AR</span><span>Alex Rivera<br /><small style={{ color: 'rgba(245,241,231,.6)' }}>Administrator</small></span></div>Private workspace for care coordination.<div style={{ display: 'flex', gap: 13, marginTop: 22 }}><Settings size={14} /><LogOut size={14} /></div></div>
      </aside>
      <main className="ayden-workspace">
        <header className="ayden-staff-head">
          <div><div className="ayden-mono ayden-kicker">Tuesday rhythm</div><h1 className="ayden-display ayden-staff-title">Good morning, Alex.</h1><p style={{ color: 'var(--ay-ink-soft)', margin: 0, fontSize: 12 }}>A clear view of the people and moments that need your attention.</p></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><button className="ayden-btn small ghost" aria-label="Search"><Search size={14} /></button><button className="ayden-btn small ghost" aria-label="Notifications"><Bell size={14} /><span className="ayden-pill" style={{ padding: '2px 5px', border: 0, background: 'var(--ay-sun)' }}>2</span></button><span className="ayden-avatar">AR</span></div>
        </header>
        <section className="ayden-metric-grid">
          <div className="ayden-metric featured"><div className="ayden-mono">Today’s schedule</div><div className="ayden-metric-value">04</div><div className="ayden-metric-caption">phone appointments</div></div>
          <div className="ayden-metric"><div className="ayden-mono">Open requests</div><div className="ayden-metric-value">03</div><div className="ayden-metric-caption">awaiting a response</div></div>
          <div className="ayden-metric"><div className="ayden-mono">Active clients</div><div className="ayden-metric-value">28</div><div className="ayden-metric-caption">in current care</div></div>
          <div className="ayden-metric"><div className="ayden-mono">Support inbox</div><div className="ayden-metric-value">02</div><div className="ayden-metric-caption">messages to review</div></div>
        </section>
        <div className="ayden-staff-grid">
          <section className="ayden-card" id="bookings">
            <div className="ayden-panel-head"><div><div className="ayden-mono ayden-kicker">Live queue</div><div className="ayden-panel-title" style={{ marginTop: 7 }}>Bookings that need you</div></div><button className="ayden-btn small sun"><CalendarDays size={13} /> Full calendar</button></div>
            <div style={{ padding: '13px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--ay-line)', flexWrap: 'wrap' }}>
              {(['All', 'Confirmed', 'Pending', 'Needs follow-up'] as const).map((item) => <button key={item} className={`ayden-pill${filter === item ? '' : ' ghost'}`} style={{ background: filter === item ? 'var(--ay-ink)' : 'transparent', color: filter === item ? 'var(--ay-paper)' : 'var(--ay-ink-soft)' }} onClick={() => setFilter(item)}>{item}</button>)}
              <label style={{ marginLeft: 'auto', minWidth: 130, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ay-ink-soft)' }}><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" style={{ border: 0, outline: 0, background: 'transparent', width: 105, fontSize: 11 }} /></label>
            </div>
            <div className="ayden-table-wrap"><table className="ayden-table"><thead><tr><th className="ayden-mono">Client</th><th className="ayden-mono">Requested time</th><th className="ayden-mono">Status</th><th className="ayden-mono">Action</th></tr></thead><tbody>{visible.map((booking) => <tr key={booking.id}><td><div className="ayden-client-cell"><span className="ayden-avatar" style={{ background: booking.id % 2 ? 'var(--ay-sea)' : 'var(--ay-sun)' }}>{booking.initials}</span><span><strong>{booking.name}</strong><span>{booking.type} · {booking.note}</span></span></div></td><td><strong style={{ fontSize: 11 }}>{booking.date}</strong><span style={{ display: 'block', fontSize: 10, color: 'var(--ay-ink-soft)', marginTop: 4 }}>{booking.time}</span></td><td><span className={`ayden-status ${booking.status === 'Pending' ? 'pending' : booking.status === 'Needs follow-up' ? 'cancelled' : ''}`}>{booking.status}</span></td><td>{booking.status === 'Pending' ? <button className="ayden-btn small sun" onClick={() => updateStatus(booking.id, 'Confirmed')}>Confirm</button> : <button className="ayden-btn small ghost" onClick={() => updateStatus(booking.id, 'Needs follow-up')}>Review <ChevronRight size={13} /></button>}</td></tr>)}</tbody></table>{visible.length === 0 && <div style={{ padding: 30, textAlign: 'center', fontSize: 12, color: 'var(--ay-ink-soft)' }}>No bookings match this view.</div>}</div>
          </section>
          <aside>
            <section className="ayden-card"><div className="ayden-panel-head"><div><div className="ayden-mono ayden-kicker">Care notes</div><div className="ayden-panel-title" style={{ marginTop: 7 }}>Keep in view</div></div><ClipboardList size={16} color="var(--ay-coral)" /></div><div className="ayden-note"><strong style={{ fontSize: 12 }}>Jasmine Carter</strong><p>Requested a new time for today’s follow-up. Review the updated request before calling.</p><button className="ayden-link" style={{ border: 0, background: 'transparent', padding: 0, marginTop: 12, fontSize: 10, fontWeight: 800 }} onClick={() => updateStatus(2, 'Confirmed')}>Mark handled →</button></div><div className="ayden-note"><strong style={{ fontSize: 12 }}>Noah Williams</strong><p>New consultation request came in last night. A first call is still needed.</p><button className="ayden-link" style={{ border: 0, background: 'transparent', padding: 0, marginTop: 12, fontSize: 10, fontWeight: 800 }} onClick={() => updateStatus(4, 'Confirmed')}>Confirm request →</button></div></section>
            <section className="ayden-quick"><div className="ayden-mono" style={{ color: 'var(--ay-sun)' }}>Quick message</div><div className="ayden-display" style={{ fontSize: 27, lineHeight: 1, marginTop: 12 }}>Small clarity goes a long way.</div><p style={{ fontSize: 11, lineHeight: 1.6, color: 'rgba(245,241,231,.68)', margin: '12px 0 0' }}>Send a prepared note to someone who is waiting for a call.</p><button className="ayden-btn sun" onClick={() => setToast('Message composer opened')}>Open message templates <ChevronRight size={14} /></button></section>
          </aside>
        </div>
      </main>
    </div>
    {toast && <div className="ayden-toast">{toast}</div>}
  </div>;
}