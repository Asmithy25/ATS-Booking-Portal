import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { customFetch, useGetAuthMe, getListBookingsQueryKey, getGetBookingStatsQueryKey } from '@workspace/api-client-react';
import { Activity, CheckCircle2, Clock3, Loader2, ShieldAlert, Timer, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export type LiveSession = {
  bookingId: number;
  clientName: string;
  staffName: string;
  staffEmail: string;
  confirmationCode: string;
  preferredDate: string;
  preferredTime: string;
  startedAt: string;
  autoStarted: boolean;
};

type Props = {
  scope?: 'mine' | 'all';
  showEmpty?: boolean;
  onSessionsChange?: (sessions: LiveSession[]) => void;
};

function normalizeName(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function sameStaffName(left: unknown, right: unknown) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // The built-in founder account is displayed as "Ayden" in the staff login.
  return ['ayden', 'ayden smith'].includes(a) && ['ayden', 'ayden smith'].includes(b);
}

export default function LiveSessionPanel({ scope = 'mine', showEmpty = false, onSessionsChange }: Props) {
  const { data: auth } = useGetAuthMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endTarget, setEndTarget] = useState<LiveSession | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await customFetch<LiveSession[]>('/api/bookings/sessions/active');
      const next = Array.isArray(response) ? response : [];
      setSessions(next);
      onSessionsChange?.(next);
    } catch (error) {
      // Keep the workspace usable when the live-session API is temporarily unavailable.
      toast({
        variant: 'destructive',
        title: 'Live session status unavailable',
        description: error instanceof Error ? error.message : 'Refresh the page to try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [onSessionsChange, toast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [load]);

  const visibleSessions = useMemo(() => {
    if (scope === 'all') return sessions;
    return sessions.filter((item) => sameStaffName(item.staffName, auth?.staffName));
  }, [auth?.staffName, scope, sessions]);

  const mayEnd = useCallback((session: LiveSession) => {
    if ((auth as any)?.isAdmin === true || (auth as any)?.role === 'founder') return true;
    const email = String((auth as any)?.email ?? '').trim().toLowerCase();
    if (email && session.staffEmail?.trim().toLowerCase() === email) return true;
    return sameStaffName(session.staffName, auth?.staffName);
  }, [auth]);

  const confirmEndSession = async () => {
    if (!endTarget || ending) return;
    setEnding(true);
    try {
      await customFetch('/api/bookings/' + endTarget.bookingId + '/session/end', { method: 'POST' });
      toast({
        title: 'Session ended',
        description: endTarget.clientName + "'s session has been marked complete.",
      });
      setEndTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetBookingStatsQueryKey() }),
      ]);
      await load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'The session was not ended',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setEnding(false);
    }
  };

  if (loading && !sessions.length) {
    if (!showEmpty) return null;
  }
  if (!loading && visibleSessions.length === 0 && !showEmpty) return null;

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-primary/25 bg-gradient-to-br from-primary/10 via-card to-secondary/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5 text-primary" /> {scope === 'all' ? 'Live Session Board' : 'Your ongoing sessions'}
              </CardTitle>
              <CardDescription className="mt-1">
                Session status updates automatically at the scheduled start time.
              </CardDescription>
            </div>
            <Badge className="w-fit border border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-200">
              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              {visibleSessions.length} active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleSessions.length > 0 ? visibleSessions.map((session) => (
            <article key={session.bookingId} className="rounded-xl border border-primary/15 bg-background/80 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-orange-500/15 text-orange-800 dark:text-orange-200">ONGOING SESSION</Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">{session.confirmationCode}</span>
                  </div>
                  <h3 className="mt-2 truncate text-lg font-semibold">Ongoing session with {session.clientName}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> {session.staffName}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Scheduled {session.preferredDate} at {session.preferredTime}</span>
                    <span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" /> Started {new Date(session.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </p>
                </div>
                {mayEnd(session) ? (
                  <Button variant="destructive" onClick={() => setEndTarget(session)} className="shrink-0">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> End session
                  </Button>
                ) : (
                  <Badge variant="outline" className="w-fit shrink-0"><ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Assigned staff only</Badge>
                )}
              </div>
            </article>
          )) : loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking session status…</div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 font-medium">No sessions in progress</p>
              <p className="mt-1 text-sm text-muted-foreground">Assigned sessions will appear here at their scheduled start time.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(endTarget)} onOpenChange={(open) => { if (!open && !ending) setEndTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Confirm end session
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end the session with <strong>{endTarget?.clientName ?? 'this client'}</strong>?
              Confirming marks this appointment as completed. If the session is still underway, choose Cancel to keep it open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {endTarget && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <p className="font-semibold">{endTarget.clientName}</p>
              <p className="mt-1 text-muted-foreground">{endTarget.preferredDate} · {endTarget.preferredTime} · {endTarget.confirmationCode}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>Cancel — keep session open</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={ending || !endTarget} onClick={() => void confirmEndSession()}>
              {ending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {ending ? 'Ending…' : 'Yes, end session'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
