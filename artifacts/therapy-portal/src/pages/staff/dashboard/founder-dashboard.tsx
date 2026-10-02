import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, CalendarDays, CheckCircle2, Gauge, HeartHandshake, Megaphone, ShieldCheck, UsersRound } from 'lucide-react';

type Summary = { todayAppointments: number; upcomingAppointments: any[]; bookingTotal: number; clients: number; completed: number; cancelled: number; feedbackCount: number; averageRating: number | null; openTeamItems: number; unreadNotifications: number; activeSchedules: number; staffCount: number };

export default function FounderDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const load = () => customFetch<Summary>('/api/workspace/founder-summary').then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'Founder access is required.'));
  useEffect(() => { load(); }, []);

  if (error) return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-sm">{error}</div>;
  if (!summary) return <div className="py-12 text-center text-sm text-muted-foreground">Loading founder dashboard…</div>;

  const metrics = [
    ['Today', summary.todayAppointments, 'appointments', CalendarDays],
    ['Clients', summary.clients, 'unique client phones', UsersRound],
    ['Feedback', summary.averageRating ?? '—', summary.feedbackCount ? 'average rating' : 'no ratings yet', HeartHandshake],
    ['Team', summary.openTeamItems, 'open work items', CheckCircle2],
    ['Unread', summary.unreadNotifications, 'staff notifications', Megaphone],
    ['Schedules', summary.activeSchedules, 'active practice modes', Gauge],
    ['Staff', summary.staffCount, 'people in workspace', ShieldCheck],
    ['Bookings', summary.bookingTotal, 'booking records', BarChart3],
  ] as const;

  return (
    <div className="space-y-7">
      <div><p className="text-sm text-muted-foreground">Founder-only overview of the moving parts that matter.</p><h1 className="mt-1 text-3xl font-semibold">Founder dashboard</h1><p className="mt-2 max-w-2xl text-muted-foreground">Aydens at a glance — care, team, communications, and platform health in one place.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, hint, Icon]) => <Card key={String(label)} className="rounded-2xl"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{String(label)}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 font-serif text-4xl">{String(value)}</p><p className="mt-1 text-xs text-muted-foreground">{String(hint)}</p></CardContent></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Next appointments</CardTitle></CardHeader><CardContent>{summary.upcomingAppointments.length ? <div className="space-y-3">{summary.upcomingAppointments.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.clientName}</p><p className="text-xs text-muted-foreground">{item.preferredDate} · {item.preferredTime}</p></div><Badge variant="outline">{item.status}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Founder shortcuts</CardTitle></CardHeader><CardContent className="grid gap-2">{[['Practice control','/staff/practice-control'],['Announcements','/staff/announcements'],['System health','/staff/system-health'],['Homepage preview','/staff/homepage-preview']].map(([label, href]) => <Link key={href} href={href}><Button variant="outline" className="w-full justify-start">{label}</Button></Link>)}</CardContent></Card>
      </div>
    </div>
  );
}
