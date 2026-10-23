import { useEffect, useMemo, useState } from 'react';
import { customFetch, useGetAuthMe } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpRight, Bell, CheckCheck, CircleAlert, CircleCheck, Loader2, Mail, MessageSquareText, Save, SlidersHorizontal } from 'lucide-react';
import { Switch as SwitchComponent } from '@/components/ui/switch';

type StaffNotification = { id: number; title: string; body: string; read: boolean; createdAt?: string };
type ChannelStatus = { configured: boolean; provider?: string; sender?: string; missing?: string[] };
type DeliveryStatus = { email?: ChannelStatus; sms?: ChannelStatus };
type Preferences = { appointmentAlerts: boolean; teamAssignments: boolean; teamMentions: boolean; practiceAnnouncements: boolean; feedbackAlerts: boolean; systemAlerts: boolean; emailDigest: boolean };

const DEFAULT_PREFS: Preferences = { appointmentAlerts: true, teamAssignments: true, teamMentions: true, practiceAnnouncements: true, feedbackAlerts: true, systemAlerts: true, emailDigest: false };

export default function Notifications() {
  const { toast } = useToast();
  const { data: session } = useGetAuthMe();
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [notifications, preferences] = await Promise.all([
        customFetch<StaffNotification[]>('/api/settings/staff-preferences/notifications'),
        customFetch<Preferences>('/api/settings/staff-preferences/notification-preferences'),
      ]);
      setItems(Array.isArray(notifications) ? notifications : []);
      setPrefs({ ...DEFAULT_PREFS, ...(preferences || {}) });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load notifications', description: err instanceof Error ? err.message : 'Please refresh.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!session?.isAdmin) return;
    customFetch<DeliveryStatus>('/api/delivery-settings/status')
      .then((value) => setDelivery(value ?? null))
      .catch(() => setDelivery(null));
  }, [session?.isAdmin]);

  const visible = useMemo(() => filter === 'unread' ? items.filter((item) => !item.read) : items, [filter, items]);
  const unread = items.filter((item) => !item.read).length;

  const markRead = async (id: number) => {
    try {
      await customFetch('/api/settings/staff-preferences/notifications/' + id + '/read', { method: 'PATCH' });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch { toast({ variant: 'destructive', title: 'Could not update notification' }); }
  };

  const markAllRead = async () => {
    try {
      await customFetch('/api/settings/staff-preferences/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      toast({ title: 'All caught up', description: 'Your notifications are clear.' });
    } catch (err) { toast({ variant: 'destructive', title: 'Could not mark notifications read', description: err instanceof Error ? err.message : 'Please try again.' }); }
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      await customFetch('/api/settings/staff-preferences/notification-preferences', { method: 'PUT', body: JSON.stringify(prefs) });
      toast({ title: 'Notification preferences saved', description: 'Your alert mix is now personalized to your workspace.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save preferences', description: err instanceof Error ? err.message : 'Please try again.' });
    } finally { setSavingPrefs(false); }
  };

  const prefItems: Array<[keyof Preferences, string, string]> = [
    ['appointmentAlerts', 'Appointment alerts', 'Reminders and booking activity.'],
    ['teamAssignments', 'Team assignments', 'Tasks and workspace items assigned to you.'],
    ['teamMentions', 'Team mentions', 'When someone mentions you in team chat.'],
    ['practiceAnnouncements', 'Practice announcements', 'Internal announcements posted to the team.'],
    ['feedbackAlerts', 'Feedback alerts', 'New client feedback notifications.'],
    ['systemAlerts', 'System alerts', 'Platform and account alerts.'],
    ['emailDigest', 'Email digest', 'Allow a future email digest for lower-priority updates.'],
  ];

  return (
    <div className="aws-command-page max-w-5xl space-y-6 sm:space-y-7">
      <div className="aws-command-hero relative overflow-hidden rounded-[1.75rem] border p-6 sm:p-8">
        <div className="aws-hero-orb aws-hero-orb-one" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="aws-kicker mb-3"><Bell className="h-3.5 w-3.5" /> WORKSPACE SIGNALS</div>
            <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">Notification command center<span className="text-primary">.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Your in-app alerts, personal notification controls, and communication setup—kept clear and in one place.</p>
          </div>
          <Badge variant={unread ? 'default' : 'secondary'} className="w-fit rounded-full px-3 py-1">{unread} unread</Badge>
        </div>
      </div>

      {session?.isAdmin && (
        <Card className="aws-glass-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <div className="aws-kicker"><MessageSquareText className="h-3.5 w-3.5" /> DELIVERY READINESS</div>
              <CardTitle className="mt-2">Email &amp; SMS channels</CardTitle>
              <CardDescription>Check provider setup before sending test messages.</CardDescription>
            </div>
            <Link href="/staff/delivery-settings"><Button variant="outline" size="sm">Manage <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Email', Icon: Mail, channel: delivery?.email },
              { label: 'SMS / text messages', Icon: MessageSquareText, channel: delivery?.sms },
            ].map(({ label, Icon, channel }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border bg-background/45 p-4">
                <span className="aws-icon-tile aws-icon-tile-small"><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{channel?.provider || (delivery ? 'Provider setup needed' : 'Checking setup…')}</p>
                </div>
                {channel?.configured ? <Badge className="rounded-full"><CircleCheck className="mr-1 h-3 w-3" />Configured</Badge> : <Badge variant="secondary" className="rounded-full"><CircleAlert className="mr-1 h-3 w-3" />Not ready</Badge>}
              </div>
            ))}
            <p className="text-[11px] leading-5 text-muted-foreground sm:col-span-2">“Configured” means required settings are present. Delivery receipts and send/retry history are not shown here unless the provider returns them through a separate delivery-log integration.</p>
          </CardContent>
        </Card>
      )}

      <Card className="aws-glass-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Your notifications</CardTitle><CardDescription>Notifications are private to your staff account.</CardDescription></div><div className="flex flex-wrap gap-2"><Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button><Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>Unread</Button><Button variant="outline" size="sm" onClick={markAllRead} disabled={!unread}><CheckCheck className="mr-1 h-4 w-4" />Mark all read</Button></div></CardHeader>
        <CardContent>{loading ? <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : visible.length ? <div className="space-y-3">{visible.map((item) => <button key={item.id} type="button" onClick={() => !item.read && markRead(item.id)} className={['w-full rounded-2xl border p-4 text-left transition', item.read ? 'bg-background opacity-65' : 'bg-primary/[0.045] hover:bg-primary/[0.08]'].join(' ')}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p></div>{!item.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />}</div>{item.createdAt && <p className="mt-3 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>}</button>)}</div> : <div className="rounded-2xl bg-muted/35 p-10 text-center"><p className="font-medium">{filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}</p><p className="mt-1 text-sm text-muted-foreground">New staff alerts will show up here.</p></div>}</CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" /> Notification preferences</CardTitle><CardDescription>This is the customization you were looking for: choose which kinds of alerts belong in your workspace.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {prefItems.map(([key, label, description]) => <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border p-4"><div><p className="font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><SwitchComponent checked={prefs[key]} onCheckedChange={(checked) => setPrefs((current) => ({ ...current, [key]: checked }))} /></div>)}
          <div className="pt-3"><Button onClick={savePrefs} disabled={savingPrefs}><Save className="mr-2 h-4 w-4" />{savingPrefs ? 'Saving…' : 'Save notification preferences'}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
