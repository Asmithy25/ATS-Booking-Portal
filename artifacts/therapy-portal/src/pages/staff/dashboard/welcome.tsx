import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { customFetch, useGetAuthMe } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, CalendarDays, CheckCircle2, Clock3, Eye, HeartHandshake, Search, Sparkles, UsersRound } from 'lucide-react';

type Status = { mode: string; title: string; detail: string; label: string; seasonal?: { seasonLabel: string }; experience?: { enabled: boolean; greeting: string } };
type Summary = { todayAppointments: number; upcomingAppointments: Array<any>; openTeamItems: number; unreadNotifications: number; staffCount: number; averageRating?: number | null; clients: number; feedbackCount: number };

export default function Welcome() {
  const { data: session } = useGetAuthMe();
  const [status, setStatus] = useState<Status | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      customFetch<Status>('/api/workspace/practice-status').catch(() => null),
      customFetch<Summary>('/api/workspace/founder-summary').catch(() => null),
      customFetch<any[]>('/api/portal/announcements?audience=staff').catch(() => []),
    ]).then(([nextStatus, nextSummary, nextAnnouncements]) => {
      setStatus(nextStatus);
      setSummary(nextSummary);
      setAnnouncements(Array.isArray(nextAnnouncements) ? nextAnnouncements.slice(0, 3) : []);
      setLoading(false);
    });
  }, []);

  const firstName = session?.staffName?.split(' ')[0] ?? 'there';
  const cards = useMemo(() => [
    { label: 'Today', value: summary?.todayAppointments ?? '—', hint: 'appointments', href: '/staff/bookings', icon: CalendarDays },
    { label: 'Team', value: summary?.openTeamItems ?? '—', hint: 'open work items', href: '/staff/team', icon: UsersRound },
    { label: 'Notifications', value: summary?.unreadNotifications ?? '—', hint: 'unread alerts', href: '/staff/notifications', icon: Bell },
    { label: 'Feedback', value: summary?.averageRating ?? '—', hint: summary?.feedbackCount ? 'average rating' : 'no responses yet', href: '/staff/feedback', icon: HeartHandshake },
  ], [summary]);

  return (
    <div className="space-y-7">
      <div className="rounded-[2rem] border border-primary/15 bg-primary/[0.045] p-6 sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Aydens welcome screen
            </div>
            <h1 className="font-serif text-4xl font-normal sm:text-5xl">Welcome back, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {status?.experience?.enabled ? status.experience.greeting : 'Here’s the pulse of the practice and what needs your attention.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/staff/bookings"><Button>Open bookings <CalendarDays className="ml-2 h-4 w-4" /></Button></Link>
            <Link href="/staff/search"><Button variant="outline">Search <Search className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => { const Icon = card.icon; return (
          <Link key={card.label} href={card.href}>
            <Card className="h-full rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p><Icon className="h-4 w-4 text-primary" /></div>
                <p className="mt-3 font-serif text-4xl">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ); })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Right now</CardTitle><CardDescription>The practice status currently visible to the public.</CardDescription></CardHeader>
          <CardContent>
            {status ? (
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-5">
                <div className="flex flex-wrap items-center gap-2"><Badge>{status.label}</Badge>{status.seasonal?.seasonLabel && <Badge variant="secondary">{status.seasonal.seasonLabel} experience</Badge>}</div>
                <p className="mt-4 font-serif text-2xl">{status.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{status.detail}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/staff/practice-control"><Button size="sm">Customize practice status</Button></Link>
                  <Link href="/staff/homepage-preview"><Button size="sm" variant="outline"><Eye className="mr-2 h-4 w-4" />Preview homepage</Button></Link>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading practice status…</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Upcoming</CardTitle><CardDescription>Next appointments at a glance.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : summary?.upcomingAppointments?.length ? (
              <div className="space-y-3">{summary.upcomingAppointments.slice(0, 5).map((item: any) => (
                <div key={item.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{item.clientName}</p><Clock3 className="h-4 w-4 text-primary" /></div><p className="mt-1 text-xs text-muted-foreground">{item.preferredDate} · {item.preferredTime}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.confirmationCode}</p></div>
              ))}</div>
            ) : <div className="rounded-2xl bg-muted/35 p-6 text-sm text-muted-foreground">No upcoming appointments need attention right now.</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Latest practice notes</CardTitle><CardDescription>Recent announcements for the team.</CardDescription></div><Link href="/staff/announcements"><Button variant="ghost" size="sm">Open library</Button></Link></div></CardHeader>
        <CardContent>{announcements.length ? <div className="grid gap-3 md:grid-cols-3">{announcements.map((item) => <article key={item.id} className="rounded-2xl border p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{item.metadata?.category ?? 'General'}</p><p className="mt-2 font-semibold">{item.title}</p><p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.body}</p></article>)}</div> : <div className="rounded-2xl bg-muted/35 p-6 text-sm text-muted-foreground">Nothing new has been posted to the team yet.</div>}</CardContent>
      </Card>
    </div>
  );
}
