import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { customFetch, useGetAuthMe } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, ArrowUpRight, CalendarDays, Megaphone, MessageCircle, UserRound,
  UsersRound, Sparkles, ShieldCheck, Settings, BarChart3, Bell, HeartHandshake,
  Database, Activity, Palette, SlidersHorizontal, Clock3, Command,
} from 'lucide-react';

type Result = { type: string; id: string; title: string; subtitle: string; href: string };
type Feature = Result & { keywords: string; adminOnly?: boolean; permission?: string };

const icons: Record<string, any> = {
  booking: CalendarDays,
  client: UserRound,
  announcement: Megaphone,
  workspace: MessageCircle,
  staff: UsersRound,
  feature: Command,
};

const FEATURES: Feature[] = [
  { type: 'feature', id: 'live-sessions', title: 'Live Session Mode', subtitle: 'See sessions in progress and safely confirm when one ends.', href: '/staff/bookings', keywords: 'ongoing session active start end live appointments timer' , permission: 'viewClients' },
  { type: 'feature', id: 'bookings', title: 'Bookings & calendar', subtitle: 'Search appointments, claim sessions, reschedule and review history.', href: '/staff/bookings', keywords: 'appointment calendar schedule date time confirmation code' , permission: 'viewClients' },
  { type: 'feature', id: 'clients', title: 'Client directory', subtitle: 'Find client profiles and appointment history.', href: '/staff/clients', keywords: 'client directory phone email search profile' , permission: 'viewClients' },
  { type: 'feature', id: 'notifications', title: 'Notification Center', subtitle: 'Review staff alerts and customize notification preferences.', href: '/staff/notifications', keywords: 'alerts inbox notification preferences unread' },
  { type: 'feature', id: 'announcements', title: 'Announcements', subtitle: 'Publish internal team updates and manage existing notices.', href: '/staff/announcements', keywords: 'news bulletin banner team update post' , permission: 'postAnnouncements' },
  { type: 'feature', id: 'aurora', title: 'Aurora AI', subtitle: 'Open the staff-side assistant for administrative support.', href: '/staff/aurora', keywords: 'assistant ai aurora help summarize draft' , permission: 'useAuroraAI' },
  { type: 'feature', id: 'analytics', title: 'Analytics', subtitle: 'Review booking and practice trends.', href: '/staff/analytics', keywords: 'metrics charts reporting statistics trends' , permission: 'viewAnalytics' },
  { type: 'feature', id: 'founder', title: 'Founder Command Center', subtitle: 'Founder overview of bookings, team activity and platform operations.', href: '/staff/founder-dashboard', keywords: 'founder owner command center overview operations' , adminOnly: true },
  { type: 'feature', id: 'aws-operations-center', title: 'Operations Command Center', subtitle: 'Appointment lifecycle, priority queue, live sessions and communication readiness.', href: '/staff/command-center', keywords: 'aws 3.1 appointments lifecycle pending waitlisted delivery email sms notifications readiness live sessions', adminOnly: true },
  { type: 'feature', id: 'system-health', title: 'System Health', subtitle: 'Inspect API, database, scheduler and frontend status.', href: '/staff/system-health', keywords: 'server api database health downtime uptime errors' },
  { type: 'feature', id: 'backup', title: 'Backup & Recovery', subtitle: 'Open backup tools and inspect the available recovery workflow.', href: '/staff/backup', keywords: 'backup restore recovery database data safety' , adminOnly: true },
  { type: 'feature', id: 'security', title: 'Security Center', subtitle: 'Manage account security and staff sign-in options.', href: '/staff/security', keywords: 'security passkey pin login account sessions permissions' },
  { type: 'feature', id: 'personal-settings', title: 'My Settings & Appearance', subtitle: 'Personalize staff colors, dark mode, and workspace preferences.', href: '/staff/my-settings', keywords: 'theme dark mode accent color appearance preference layout' },
  { type: 'feature', id: 'website-settings', title: 'Website & Branding Settings', subtitle: 'Manage website-level branding and client-facing options.', href: '/staff/website-settings', keywords: 'branding logo favicon color theme website brand studio', adminOnly: true },
  { type: 'feature', id: 'homepage', title: 'Homepage Controls', subtitle: 'Manage homepage content and announcements shown to clients.', href: '/staff/homepage-controls', keywords: 'homepage public website client-facing content' , adminOnly: true },
  { type: 'feature', id: 'staff-directory', title: 'Staff Directory', subtitle: 'Find team members and review staff profiles.', href: '/staff/staff-directory', keywords: 'team employee staff roster people' },
  { type: 'feature', id: 'activity', title: 'Activity History', subtitle: 'Review recent administrative and workspace activity.', href: '/staff/activity', keywords: 'audit log history changes records' , permission: 'viewAuditLogs' },
  { type: 'feature', id: 'feedback', title: 'Client Feedback', subtitle: 'Review ratings and client session feedback.', href: '/staff/feedback', keywords: 'ratings reviews satisfaction comments' },
  { type: 'feature', id: 'wellness', title: 'Wellness Journey', subtitle: 'Manage wellness assignments and client resources.', href: '/staff/wellness', keywords: 'wellness exercises assignments resources care journey' , permission: 'manageAssignments' },
  { type: 'feature', id: 'team', title: 'Team Workspace & Chat', subtitle: 'Open shared team tasks, collaboration, and conversation.', href: '/staff/team', keywords: 'collaboration task work chat team messages' },
  { type: 'feature', id: 'practice-status', title: 'Practice Status', subtitle: 'Manage the public practice status and operating message.', href: '/staff/practice-control', keywords: 'practice status open closed accepting booking hours' },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  manager: ['viewClients', 'editAppointments', 'sendEmails', 'manageSettings', 'postAnnouncements', 'viewAnalytics', 'viewAuditLogs', 'manageUploads', 'manageAssignments', 'viewClientMessages', 'manageTasks', 'manageResources', 'viewSystemHealth', 'useAuroraAI'],
  therapist: ['viewClients', 'editAppointments', 'viewAnalytics', 'manageAssignments', 'viewClientMessages'],
  customer_service_representative: ['viewClients', 'editAppointments', 'sendEmails', 'viewClientMessages', 'manageUploads'],
  receptionist: ['viewClients', 'editAppointments', 'sendEmails', 'viewClientMessages', 'manageUploads', 'manageTasks'],
};

function canUseFeature(feature: Feature, session: any): boolean {
  const isFounder = session?.isAdmin === true || session?.role === 'founder';
  if (feature.adminOnly && !isFounder) return false;
  if (!feature.permission || isFounder) return true;
  const permissions = session?.permissions ?? {};
  if (Object.prototype.hasOwnProperty.call(permissions, feature.permission)) return permissions[feature.permission] === true;
  return (ROLE_DEFAULTS[String(session?.role ?? '')] ?? []).includes(feature.permission);
}

export default function GlobalSearch() {
  const { data: auth } = useGetAuthMe();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const allowedFeatures = useMemo(() => FEATURES.filter((item) => canUseFeature(item, auth)), [auth]);
  const featureMatches = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return allowedFeatures.slice(0, 8);
    return allowedFeatures.filter((feature) =>
      `${feature.title} ${feature.subtitle} ${feature.keywords}`.toLowerCase().includes(value),
    ).slice(0, 12);
  }, [allowedFeatures, query]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await customFetch<Result[]>('/api/workspace/search?q=' + encodeURIComponent(value));
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  const remoteMatches = useMemo(() => items.filter((item) => item.type !== 'feature'), [items]);
  const showNoResults = query.trim().length >= 2 && !loading && featureMatches.length === 0 && remoteMatches.length === 0;

  return (
    <div className="max-w-5xl space-y-7">
      <div className="rounded-[1.5rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 sm:p-8">
        <div className="flex items-center gap-3 text-primary"><div className="rounded-xl bg-primary/10 p-3"><Search className="h-5 w-5" /></div><Badge variant="outline">AWS 3.1</Badge><span className="text-xs font-semibold uppercase tracking-[.18em]">Feature Search</span></div>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Find it. Open it. Done.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Search features, pages, settings, clients, bookings, announcements, team items, and staff. Results adapt to your staff permissions.</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2 text-xs text-muted-foreground"><Command className="h-3.5 w-3.5" /> Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">⌘ K</kbd> or <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Ctrl K</kbd> from anywhere in the staff workspace.</div>
      </div>

      <Card className="rounded-2xl border-primary/15 shadow-sm"><CardContent className="p-4 sm:p-5"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" /><Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-13 pl-10 text-base" placeholder="Try “session”, “branding”, “dark mode”, a client name, or a confirmation code…" aria-label="Search features and workspace records" /></div><p className="mt-2 text-xs text-muted-foreground">Tip: search a task like “change logo” instead of remembering which menu it lives in.</p></CardContent></Card>

      {featureMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{query.trim() ? 'Feature matches' : 'Popular shortcuts'}</h2><Badge variant="secondary">{featureMatches.length}</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {featureMatches.map((item) => {
              const Icon = item.id === 'live-sessions' ? Clock3 : item.id === 'website-settings' ? Palette : item.id === 'security' ? ShieldCheck : item.id === 'analytics' ? BarChart3 : item.id === 'notifications' ? Bell : item.id === 'personal-settings' ? SlidersHorizontal : item.id === 'system-health' ? Activity : item.id === 'backup' ? Database : item.id === 'announcements' ? Megaphone : item.id === 'wellness' ? HeartHandshake : item.id === 'clients' ? UserRound : item.id === 'staff-directory' ? UsersRound : item.id === 'practice-status' ? Settings : Sparkles;
              return <Link key={item.id} href={item.href}><Card className="h-full rounded-xl transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><CardContent className="flex h-full items-start gap-3 p-4"><span className="rounded-xl border border-primary/15 bg-primary/10 p-2.5 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title}</span>{item.adminOnly && <Badge variant="outline">Founder</Badge>}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.subtitle}</span></span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></CardContent></Card></Link>;
            })}
          </div>
        </section>
      )}

      {loading && <p className="text-sm text-muted-foreground">Searching client and workspace records…</p>}
      {remoteMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Workspace results</h2><Badge variant="secondary">{remoteMatches.length}</Badge></div>
          <div className="space-y-3">{remoteMatches.map((item) => { const Icon = icons[item.type] ?? Search; return <Link key={item.type + item.id} href={item.href}><Card className="rounded-xl transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"><CardContent className="flex items-center gap-4 p-4"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge variant="outline">{item.type}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" /></CardContent></Card></Link>; })}</div>
        </section>
      )}
      {showNoResults && <div className="rounded-2xl border border-dashed p-10 text-center"><p className="font-medium">Nothing matched that search.</p><p className="mt-1 text-sm text-muted-foreground">Try another word, a client name, booking code, or a shorter phrase.</p></div>}
    </div>
  );
}
