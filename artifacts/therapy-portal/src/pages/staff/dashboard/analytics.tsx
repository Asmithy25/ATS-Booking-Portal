import { useMemo } from 'react';
import { usePortalAnalytics } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, CalendarCheck2, Clock3, Percent, Users, TrendingUp } from 'lucide-react';

function Metric({ label, value, icon: Icon, detail }: { label: string; value: string | number; icon: typeof Users; detail: string }) {
  return <Card className="rounded-2xl"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span></div><p className="text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

export default function Analytics() {
  const { data, isLoading, error } = usePortalAnalytics();
  const max = useMemo(() => Math.max(...(data?.monthly.map((item) => item.count) ?? [1]), 1), [data]);
  if (isLoading) return <div className="space-y-5"><Skeleton className="h-10 w-64" /><div className="grid gap-4 md:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}</div></div>;
  if (error || !data) return <Card className="rounded-2xl"><CardContent className="p-6 text-destructive">Analytics are unavailable for your account.</CardContent></Card>;
  return <div className="space-y-7">
    <div><p className="text-sm text-muted-foreground">Practice overview</p><h1 className="text-3xl font-semibold">Analytics</h1><p className="mt-2 text-muted-foreground">A calm, data-informed view of your practice.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Total appointments" value={data.totalAppointments} icon={CalendarCheck2} detail="All recorded sessions" />
      <Metric label="Active clients" value={data.clientCount} icon={Users} detail="Unique client records" />
      <Metric label="Returning clients" value={`${data.returningPercentage}%`} icon={TrendingUp} detail="Clients with more than one session" />
      <Metric label="Completion rate" value={`${data.completionRate}%`} icon={Percent} detail="Sessions marked completed" />
      <Metric label="Weekly average" value={data.weeklyAverage} icon={BarChart3} detail="Appointments per week" />
      <Metric label="No-show rate" value={`${data.noShowRate}%`} icon={Clock3} detail={`${data.cancellationRate}% cancellation rate`} />
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <Card className="rounded-2xl"><CardHeader><CardTitle>Monthly appointments</CardTitle></CardHeader><CardContent><div className="flex h-56 items-end gap-3 pt-4">{data.monthly.length ? data.monthly.map((item) => <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-40 w-full items-end"><div className="w-full rounded-t-lg bg-primary/75 transition-all" style={{ height: `${Math.max((item.count / max) * 100, 5)}%` }} title={`${item.count} appointments`} /></div><span className="truncate text-[10px] text-muted-foreground">{item.month.slice(5)}</span></div>) : <p className="text-sm text-muted-foreground">Appointment trends will appear here as bookings arrive.</p>}</div></CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle>Practice patterns</CardTitle></CardHeader><CardContent className="space-y-5"><div><p className="text-xs uppercase tracking-[.15em] text-muted-foreground">Most popular day</p><p className="mt-1 text-2xl font-semibold">{data.popularDay}</p></div><div><p className="text-xs uppercase tracking-[.15em] text-muted-foreground">Peak hour</p><p className="mt-1 text-2xl font-semibold">{data.peakHour}</p></div><div className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Use these patterns to shape office hours, reminder timing, and availability.</div></CardContent></Card>
    </div>
  </div>;
}