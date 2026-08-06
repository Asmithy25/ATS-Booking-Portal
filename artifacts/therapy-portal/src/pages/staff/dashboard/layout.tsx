import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useGetAuthMe, useStaffLogout, getGetAuthMeQueryKey } from '@workspace/api-client-react';
import { Calendar, Users, Settings as SettingsIcon, LogOut, Loader2, UserCog, Menu, X, BarChart3, History, Megaphone, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoUrl from '@assets/ATS_FALL_1785938831030.png';
import { useGetSettings } from '@workspace/api-client-react';

export default function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const navItem = (href: string, icon: React.ReactNode, label: string) => {
    const active = location === href || location.startsWith(href + '/');
    return (
        <Link
        href={href}
          onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          active
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted text-foreground'
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-muted/30 ats-paper">
      {/* Sidebar */}
      <aside className={`w-72 bg-[hsl(32_32%_92%)] border-r border-border flex flex-col fixed h-full z-30 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <img src={settings?.logoUrl || logoUrl} alt="" className="h-12 w-12 rounded-full object-cover object-top" />
            <div>
              <h2 className="font-serif font-bold text-lg text-primary">Staff Portal</h2>
              <p className="text-xs text-muted-foreground mt-0.5">A clear space to care</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-card/70 px-3 py-2.5 flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-[hsl(75_18%_44%)]" />
            <span className="text-muted-foreground">Welcome,</span>
            <span className="font-medium truncate">{session.staffName}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Workspace</p>
          {navItem('/staff/bookings', <Calendar className="h-4 w-4" />, 'Bookings')}
          {navItem('/staff/clients', <Users className="h-4 w-4" />, 'Clients')}
          {navItem('/staff/analytics', <BarChart3 className="h-4 w-4" />, 'Analytics')}
          {navItem('/staff/support', <MessageCircle className="h-4 w-4" />, 'Support inbox')}
          {navItem('/staff/messages', <Mail className="h-4 w-4" />, 'Message templates')}
          {((session.isAdmin || (session as typeof session & { role?: string }).role === 'manager')) && navItem('/staff/announcements', <Megaphone className="h-4 w-4" />, 'Announcements')}
          {((session.isAdmin || (session as typeof session & { role?: string }).role === 'manager')) && navItem('/staff/activity', <History className="h-4 w-4" />, 'Activity history')}
          {navItem('/staff/settings', <SettingsIcon className="h-4 w-4" />, 'Settings')}

          {/* Employees — admin only */}
          {session.isAdmin && (
            <div className="pt-3 mt-3 border-t border-border">
              {navItem('/staff/employees', <UserCog className="h-4 w-4" />, 'Employees')}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
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
      <main className="flex-1 md:ml-72 p-4 pt-20 md:p-8 md:pt-8">
        <div className="fixed top-0 left-0 right-0 z-20 h-16 bg-card/95 backdrop-blur border-b border-border px-4 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <img src={settings?.logoUrl || logoUrl} alt="" className="h-9 w-9 rounded-full object-cover object-top" />
            <span className="font-serif font-semibold text-primary">{settings?.siteName ?? "Ayden's Therapy Services"}</span>
          </div>
          <Button data-testid="button-open-sidebar" variant="outline" size="icon" className="rounded-xl" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        <div className="max-w-6xl mx-auto ats-rise">{children}</div>
      </main>
    </div>
  );
}
