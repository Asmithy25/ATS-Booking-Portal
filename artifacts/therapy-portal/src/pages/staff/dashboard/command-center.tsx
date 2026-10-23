import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { customFetch, useGetAuthMe, useListBookings, type Booking } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarClock,
  CalendarDays, CheckCircle2, CircleAlert, Clock3, Mail, MessageSquareText,
  RefreshCw, ShieldCheck, Sparkles, UsersRound, Zap,
} from 'lucide-react';

type DeliveryChannel = {
  configured: boolean;
  provider?: string;
  sender?: string;
  missing?: string[];
};
type DeliveryStatus = { email?: DeliveryChannel; sms?: DeliveryChannel; replyTo?: string };
type StaffNotification = { id: number; title: string; body: string; read: boolean; createdAt?: string };
type LiveSession = { bookingId: number; clientName: string; confirmationCode: string; preferredDate: string; preferredTime: string; startedAt: string };

const statusLabel: Record<string, string> = {
  pending: 'New request',
  claimed: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  waitlisted: 'Waitlisted',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Date not set';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const timeValue = (value?: string | null) => String(value ?? '').slice(0, 5);

function MetricCard({ label, value, detail, icon: Icon, trend }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  trend?: 'up' | 'down' | 'steady';
}) {
  return (
    <Card className="aws-glass-card overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[.1em] text-muted-foreground">{label}</p>
            <p className="mt-3 font-serif text-4xl tracking-tight">{value}</p>
          </div>
          <span className="aws-icon-tile"><Icon className="h-[18px] w-[18px]" /></span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          {trend === 'up' ? <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> : trend === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
          <span>{detail}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommandCenter() {
  const { data: session } = useGetAuthMe();
  const { data: bookingsData = [], isLoading: bookingsLoading, refetch: refetchBookings } = useListBookings();
  const { toast } = useToast();
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const bookings = (Array.isArray(bookingsData) ? bookingsData : []) as Booking[];
  const loadSignals = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    const results = await Promise.allSettled([
      customFetch<DeliveryStatus>('/api/delivery-settings/status'),
      customFetch<StaffNotification[]>('/api/settings/staff-preferences/notifications'),
      customFetch<LiveSession[]>('/api/bookings/sessions/active', { cache: 'no-store' }),
    ]);
    if (results[0].status === 'fulfilled') setDelivery(results[0].value ?? null);
    if (results[1].status === 'fulfilled') setNotifications(Array.isArray(results[1].value) ? results[1].value : []);
    if (results[2].status === 'fulfilled') setSessions(Array.isArray(results[2].value) ? results[2].value : []);
    setLastUpdated(new Date());
    setRefreshing(false);
    const failures = results.filter((result) => result.status === 'rejected').length;
    if (failures && !quiet) {
      toast({
        title: 'Some workspace signals are unavailable',
        description: 'Appointment data is still shown where available. Check System Health or delivery settings for details.',
      });
    }
  }, [toast]);

  useEffect(() => { void loadSignals(true); }, [loadSignals]);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const counts = useMemo(() => {
    const get = (status: string) => bookings.filter((booking) => String(booking.status ?? '').toLowerCase() === status).length;
    return {
      today: bookings.filter((booking) => String(booking.preferredDate ?? '').slice(0, 10) === today && !['cancelled', 'no_show'].includes(String(booking.status).toLowerCase())).length,
      pending: get('pending'),
      claimed: get('claimed'),
      waitlisted: get('waitlisted'),
      completed: get('completed'),
      cancelled: get('cancelled'),
      noShow: get('no_show'),
    };
  }, [bookings, today]);

  const attentionBookings = useMemo(() => bookings
    .filter((booking) => ['pending', 'waitlisted'].includes(String(booking.status ?? '').toLowerCase()))
    .sort((a, b) => {
      const left = `${a.preferredDate ?? '9999-12-31'} ${a.preferredTime ?? ''}`;
      const right = `${b.preferredDate ?? '9999-12-31'} ${b.preferredTime ?? ''}`;
      return left.localeCompare(right);
    })
    .slice(0, 5), [bookings]);

  const upcoming = useMemo(() => bookings
    .filter((booking) => String(booking.preferredDate ?? '').slice(0, 10) >= today && ['claimed', 'pending'].includes(String(booking.status ?? '').toLowerCase()))
    .sort((a, b) => `${a.preferredDate ?? ''} ${a.preferredTime ?? ''}`.localeCompare(`${b.preferredDate ?? ''} ${b.preferredTime ?? ''}`))
    .slice(0, 5), [bookings, today]);

  const unread = notifications.filter((item) => !item.read).length;
  const emailReady = Boolean(delivery?.email?.configured);
  const smsReady = Boolean(delivery?.sms?.configured);
  const readyChannels = Number(emailReady) + Number(smsReady);
  const firstName = session?.staffName?.split(' ')[0] ?? 'there';

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchBookings(), loadSignals(true)]);
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const goToBookings = () => { window.location.href = '/staff/bookings'; };

  return (
    <div className="aws-command-page space-y-6 sm:space-y-7">
      <section className="aws-command-hero relative overflow-hidden rounded-[1.75rem] border p-6 sm:p-8 lg:p-9">
        <div className="aws-hero-orb aws-hero-orb-one" />
        <div className="aws-hero-orb aws-hero-orb-two" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="aws-kicker mb-4"><Sparkles className="h-3.5 w-3.5" /> AWS / OPERATIONS</div>
            <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Command center<span className="text-primary">.</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Good to see you, {firstName}. A clear view of appointments, live sessions, and communication readiness—without the noise.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="aws-status-pip" />
              <span>Connected to your AWS workspace</span>
              {lastUpdated && <span className="ml-1 border-l pl-3">Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={refresh} variant="outline" className="aws-quiet-button" disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={goToBookings} className="shadow-sm">
              Open appointments <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="TODAY'S APPOINTMENTS" value={bookingsLoading ? '—' : counts.today} detail="Scheduled for today" icon={CalendarDays} />
        <MetricCard label="NEEDS ATTENTION" value={bookingsLoading ? '—' : counts.pending + counts.waitlisted} detail={`${counts.pending} new · ${counts.waitlisted} waitlisted`} icon={CircleAlert} trend={counts.pending + counts.waitlisted ? 'up' : 'steady'} />
        <MetricCard label="LIVE SESSIONS" value={sessions.length} detail="Currently in progress" icon={Activity} />
        <MetricCard label="MESSAGE CHANNELS" value={delivery ? `${readyChannels}/2` : '—'} detail={delivery ? (readyChannels === 2 ? 'Email and SMS configured' : 'Delivery setup needs a look') : 'Checking channel setup'} icon={MessageSquareText} trend={readyChannels === 2 ? 'steady' : 'down'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="aws-glass-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <div className="aws-kicker"><CalendarClock className="h-3.5 w-3.5" /> APPOINTMENT FLOW</div>
              <CardTitle className="mt-2 text-xl">Lifecycle overview</CardTitle>
              <CardDescription className="mt-1">Track requests from first touch to completed care.</CardDescription>
            </div>
            <Link href="/staff/bookings"><Button size="sm" variant="outline" className="shrink-0">Manage <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'New requests', value: counts.pending, tone: 'amber', hint: 'Review & claim' },
                { label: 'Scheduled', value: counts.claimed, tone: 'green', hint: 'Assigned to staff' },
                { label: 'Completed', value: counts.completed, tone: 'neutral', hint: 'Care delivered' },
                { label: 'Follow-up', value: counts.noShow + counts.cancelled, tone: 'rose', hint: 'Cancelled / no-show' },
              ].map((step) => (
                <div key={step.label} className="aws-lifecycle-step">
                  <span className={`aws-step-dot ${step.tone}`} />
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{bookingsLoading ? '—' : step.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{step.hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Badge variant="outline" className="rounded-full px-3 py-1">{counts.waitlisted} waitlisted</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">{counts.cancelled} cancelled</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">{counts.noShow} no-show</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="aws-glass-card">
          <CardHeader>
            <div className="aws-kicker"><ShieldCheck className="h-3.5 w-3.5" /> COMMUNICATIONS</div>
            <CardTitle className="mt-2 text-xl">Delivery readiness</CardTitle>
            <CardDescription>Email and SMS setup at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Email', Icon: Mail, channel: delivery?.email },
              { label: 'Text messages', Icon: MessageSquareText, channel: delivery?.sms },
            ].map(({ label, Icon, channel }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-background/45 p-3">
                <span className="aws-icon-tile aws-icon-tile-small"><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{channel?.provider || (channel ? 'Provider setup needed' : 'Checking configuration…')}</p>
                </div>
                <Badge variant={channel?.configured ? 'default' : 'secondary'} className="shrink-0 rounded-full">
                  {channel?.configured ? 'Configured' : delivery ? 'Needs setup' : 'Checking'}
                </Badge>
              </div>
            ))}
            <Link href="/staff/delivery-settings">
              <Button variant="outline" className="aws-quiet-button w-full">Open delivery controls <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <p className="text-[11px] leading-5 text-muted-foreground">Configured means the provider settings are present. It does not guarantee a message was delivered.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="aws-glass-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <div className="aws-kicker"><Clock3 className="h-3.5 w-3.5" /> PRIORITY QUEUE</div>
              <CardTitle className="mt-2 text-xl">Needs a decision</CardTitle>
              <CardDescription>New and waitlisted requests waiting for a next step.</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">{counts.pending + counts.waitlisted} open</Badge>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading appointment queue…</div> :
              attentionBookings.length ? <div className="divide-y">{attentionBookings.map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="aws-date-chip"><span>{formatDate(booking.preferredDate).split(' ')[0]}</span><strong>{formatDate(booking.preferredDate).split(' ').slice(1).join(' ') || '—'}</strong></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{booking.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{booking.confirmationCode} · {timeValue(booking.preferredTime) || 'Time unset'}</p>
                  </div>
                  <Badge variant={String(booking.status).toLowerCase() === 'pending' ? 'default' : 'secondary'}>{statusLabel[String(booking.status).toLowerCase()] ?? booking.status}</Badge>
                </div>
              ))}</div> : <div className="aws-empty-state"><CheckCircle2 className="h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">You're all caught up.</p><p className="mt-1 text-xs text-muted-foreground">No new or waitlisted requests need a decision.</p></div></div>}
            <Link href="/staff/bookings"><Button variant="ghost" className="mt-3 px-0 text-primary">View full appointment list <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>

        <Card className="aws-glass-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <div className="aws-kicker"><CalendarDays className="h-3.5 w-3.5" /> COMING UP</div>
              <CardTitle className="mt-2 text-xl">Next on the calendar</CardTitle>
              <CardDescription>Your next appointments with an active booking status.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading calendar…</div> :
              upcoming.length ? <div className="divide-y">{upcoming.map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="aws-date-chip"><span>{formatDate(booking.preferredDate).split(' ')[0]}</span><strong>{formatDate(booking.preferredDate).split(' ').slice(1).join(' ') || '—'}</strong></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{booking.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeValue(booking.preferredTime) || 'Time unset'} · {booking.claimedBy || 'Awaiting assignment'}</p>
                  </div>
                  <Badge variant={String(booking.status).toLowerCase() === 'claimed' ? 'default' : 'secondary'}>{statusLabel[String(booking.status).toLowerCase()] ?? booking.status}</Badge>
                </div>
              ))}</div> : <div className="aws-empty-state"><CalendarDays className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm font-semibold">No upcoming appointments found.</p><p className="mt-1 text-xs text-muted-foreground">New bookings will appear here as they arrive.</p></div></div>}
            <Link href="/staff/bookings"><Button variant="ghost" className="mt-3 px-0 text-primary">Open calendar view <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Link href="/staff/notifications" className="block">
          <Card className="aws-glass-card aws-quick-link h-full transition-colors">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="aws-icon-tile"><Bell className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold">Notification center</p><p className="mt-1 text-xs text-muted-foreground">{unread} unread staff alerts</p></div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/staff/system-health" className="block">
          <Card className="aws-glass-card aws-quick-link h-full transition-colors">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="aws-icon-tile"><Activity className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold">System health</p><p className="mt-1 text-xs text-muted-foreground">Inspect platform status and diagnostics</p></div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/staff/operations" className="block">
          <Card className="aws-glass-card aws-quick-link h-full transition-colors">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="aws-icon-tile"><UsersRound className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold">Care operations</p><p className="mt-1 text-xs text-muted-foreground">Team tasks, client messages, and uploads</p></div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </section>

      <p className="px-1 text-[11px] text-muted-foreground">Operational data is refreshed on request. Delivery readiness reflects provider configuration, not individual delivery receipts.</p>
    </div>
  );
}
