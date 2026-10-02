import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useGetAuthMe, useStaffLogout, getGetAuthMeQueryKey, customFetch } from '@workspace/api-client-react';
import { Calendar, Users, Settings as SettingsIcon, LogOut, Loader2, UserCog, Menu, X, BarChart3, History, Megaphone, MessageCircle, Mail, Clock3, UsersRound, Copy, ArrowUpRight, Bell, NotebookPen, Star, ShieldCheck, Eye, Leaf, Search as SearchIcon, Activity, UserRound, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { useGetSettings } from '@workspace/api-client-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getDailyQuote } from '@/lib/motivationalQuotes';

export default function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [portalPrefs, setPortalPrefs] = useState({ layout: 'composed', density: 'comfortable', navigation: 'classic', dashboard: 'balanced' });
  const [staffNotifications, setStaffNotifications] = useState<Array<{ id: number; title: string; body: string; read: boolean }>>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { data: settings } = useGetSettings();

  const { data: session, isLoading, error } = useGetAuthMe({
    query: {
      queryKey: getGetAuthMeQueryKey(),
      retry: false,
    },
  });

  const logout = useStaffLogout({
    mutation: {
      onSuccess: () => {
        setLocation('/staff/login');
      },
    },
  });

  useEffect(() => {
    if (!isLoading && (error || !session?.authenticated)) {
      setLocation('/staff/login');
    }
  }, [session, isLoading, error, setLocation]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || typeof detail !== 'object') return;
      setPortalPrefs((current) => ({
        ...current,
        layout: typeof detail.layout === 'string' ? detail.layout : current.layout,
        density: typeof detail.density === 'string' ? detail.density : current.density,
        navigation: typeof detail.navigation === 'string' ? detail.navigation : current.navigation,
        dashboard: typeof detail.dashboard === 'string' ? detail.dashboard : current.dashboard,
      }));
    };
    window.addEventListener('ats-staff-preferences-updated', handlePreferencesUpdated);
    return () => window.removeEventListener('ats-staff-preferences-updated', handlePreferencesUpdated);
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    customFetch<{ layout?: string; density?: string; navigation?: string; dashboard?: string }>('/api/settings/staff-preferences')
      .then((value) => value && setPortalPrefs((current) => ({
        ...current,
        layout: value.layout ?? current.layout,
        density: value.density ?? current.density,
        navigation: value.navigation ?? current.navigation,
        dashboard: value.dashboard ?? current.dashboard,
      })))
      .catch(() => undefined);
    const loadNotifications = () => customFetch('/api/settings/staff-preferences/notifications')
      .then((value) => setStaffNotifications(Array.isArray(value) ? value : []))
      .catch(() => undefined);
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(interval);
  }, [session?.authenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return null;
  }

  const unreadNotifications = staffNotifications.filter((item) => !item.read).length;

  const navItem = (href: string, icon: React.ReactNode, label: string) => {
    const active = location === href || location.startsWith(href + '/');
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
          active
            ? 'border-secondary bg-sidebar-accent text-sidebar-foreground'
            : 'border-transparent text-sidebar-foreground/60 hover:border-sidebar-accent hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        }`}
      >
        {icon}
        <span className={portalPrefs.navigation === "rail" ? "hidden md:inline-block md:sr-only" : ""}>{label}</span>
      </Link>
    );
  };

  return (
      <div className={`ats-staff-shell min-h-screen flex text-foreground dark:bg-background ats-paper ${portalPrefs.layout === "relaxed" ? "bg-[#f4f0ea]" : portalPrefs.layout === "focused" ? "bg-[#eef1f5]" : portalPrefs.layout === "minimal" ? "bg-background" : "bg-[#edf0eb]"}`}>
      {/* Sidebar */}
      <aside className={`${portalPrefs.navigation === "rail" ? "w-20" : portalPrefs.navigation === "compact" ? "w-56" : "w-64"} bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed h-full z-30 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="border-b border-sidebar-border p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-sidebar-primary p-1">
              <img src={settings?.logoUrl || logoUrl} alt="" className="h-full w-full object-cover object-top mix-blend-multiply" />
            </span>
            <div>
              <h2 className="font-serif text-xl font-normal text-sidebar-foreground">Ayden’s</h2>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[.12em] text-sidebar-foreground/55">Care workspace</p>
            </div>
          </div>
          <div className="mt-7 flex items-center gap-2 border-t border-sidebar-border pt-4 text-xs">
            <span className="h-2 w-2 rounded-full bg-sidebar-primary" />
            <span className="truncate font-semibold">{session.staffName}</span>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[.1em] text-sidebar-foreground/45">online</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <p className="px-3 pb-3 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-sidebar-foreground/40">Workspace</p>
          {navItem('/staff/welcome', <Leaf className="h-4 w-4" />, 'Welcome Screen')}
          {navItem('/staff/bookings', <Calendar className="h-4 w-4" />, 'Bookings')}
          {navItem('/staff/clients', <Users className="h-4 w-4" />, 'Clients')}
          {navItem('/staff/wellness', <NotebookPen className="h-4 w-4" />, 'Wellness Journey')}
          {navItem('/staff/analytics', <BarChart3 className="h-4 w-4" />, 'Analytics')}
          {navItem('/staff/support', <MessageCircle className="h-4 w-4" />, 'Support inbox')}
          {navItem('/staff/notifications', <Bell className="h-4 w-4" />, 'Notification center')}
           {navItem('/staff/team-chat', <MessageCircle className="h-4 w-4" />, 'Team chat')}
           {navItem('/staff/team', <UsersRound className="h-4 w-4" />, 'Team workspace')}
          {navItem('/staff/messages', <Mail className="h-4 w-4" />, 'Message templates')}
           {((session.isAdmin || (session as typeof session & { role?: string }).role === 'manager')) && navItem('/staff/client-templates', <Copy className="h-4 w-4" />, 'Client Templates')}
           {((session.isAdmin || (session as typeof session & { role?: string }).role === 'manager')) && navItem('/staff/rollout', <Megaphone className="h-4 w-4" />, 'Rollout')}
          {((session.isAdmin || (session as typeof session & { role?: string }).role === 'manager')) && navItem('/staff/announcements', <Megaphone className="h-4 w-4" />, 'Announcements')}
          {((session.isAdmin || (session as typeof session & { role?: string }).role === 'manager')) && navItem('/staff/activity', <History className="h-4 w-4" />, 'Activity history')}
          {navItem('/staff/settings', <SettingsIcon className="h-4 w-4" />, 'Settings')}
          {navItem('/staff/feedback', <Star className="h-4 w-4" />, 'Feedback')}
          {navItem('/staff/homepage-preview', <Eye className="h-4 w-4" />, 'Homepage preview')}
          {navItem('/staff/security', <ShieldCheck className="h-4 w-4" />, 'Security')}
          {navItem('/staff/search', <SearchIcon className="h-4 w-4" />, 'Global Search')}
          {navItem('/staff/practice-control', <Leaf className="h-4 w-4" />, 'Practice Control')}
          {session.isAdmin && navItem('/staff/homepage-controls', <Eye className="h-4 w-4" />, 'Homepage Controls')}
          {navItem('/staff/staff-directory', <UserRound className="h-4 w-4" />, 'Staff Directory')}
          {session.isAdmin && navItem('/staff/founder-dashboard', <Crown className="h-4 w-4" />, 'Founder Dashboard')}
          {navItem('/staff/system-health', <Activity className="h-4 w-4" />, 'System Health')}

          {/* Employees — admin only */}
          {session.isAdmin && (
            <div className="mt-4 border-t border-sidebar-border pt-4">
              {navItem('/staff/employees', <UserCog className="h-4 w-4" />, 'Employees')}
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {logout.isPending ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-sidebar" className="fixed inset-0 z-20 bg-[hsl(25_29%_21%_/.35)] md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main Content */}
      <main className={`flex-1 p-4 pt-20 md:p-10 md:pt-9 ${portalPrefs.navigation === "rail" ? "md:ml-20" : portalPrefs.navigation === "compact" ? "md:ml-56" : "md:ml-64"} ${portalPrefs.density === "compact" ? "staff-compact" : portalPrefs.density === "spacious" ? "staff-spacious" : "staff-comfortable"}`}>
        <div className="fixed top-0 left-0 right-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-secondary p-1">
              <img src={settings?.logoUrl || logoUrl} alt="" className="h-full w-full object-cover object-top mix-blend-multiply" />
            </span>
            <span className="font-serif text-lg">{settings?.siteName ?? "Ayden's Therapy Services"}</span>
          </div>
          <Button data-testid="button-open-sidebar" variant="outline" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        <div className={`mx-auto ats-rise ${portalPrefs.dashboard === "cards" ? "max-w-6xl" : portalPrefs.dashboard === "flow" ? "max-w-5xl" : "max-w-7xl"}`}>
          <div className="mb-9 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">Today’s rhythm</p>
              <h1 className="mt-2 font-serif text-4xl font-normal leading-none sm:text-5xl">
                {now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {session.staffName.split(' ')[0]}.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{getDailyQuote().quote}</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="hidden items-center gap-2 border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono tabular-nums text-foreground">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className="relative">
                <Button type="button" variant="outline" size="icon" aria-label="Notifications" onClick={() => setNotificationsOpen((value) => !value)}>
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadNotifications}</span>}
                </Button>
                {notificationsOpen && <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border bg-card p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Notifications</p><span className="text-xs text-muted-foreground">{unreadNotifications} unread</span></div>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {staffNotifications.length === 0 ? <p className="p-3 text-sm text-muted-foreground">You’re all caught up.</p> : staffNotifications.map((item) => (
                      <button key={item.id} type="button" className={`w-full rounded-xl border p-3 text-left ${item.read ? "opacity-60" : "bg-primary/5"}`} onClick={() => {
                        customFetch('/api/settings/staff-preferences/notifications/' + item.id + '/read', { method: 'PATCH' }).catch(() => undefined);
                        setStaffNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
                      }}>
                        <p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
                      </button>
                    ))}
                  </div>
                  <Button type="button" variant="ghost" className="mt-2 w-full justify-center text-xs" onClick={() => { setNotificationsOpen(false); setLocation('/staff/notifications'); }}>
                    Open notification center
                  </Button>
                </div>}
              </div>
              <ThemeToggle compact />
              <Button type="button" variant="secondary" className="hidden sm:inline-flex" onClick={() => setLocation('/staff/bookings')}>
                Open bookings <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
