import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { format, isBefore, parseISO } from 'date-fns';
import {
  getClientBookingsQueryKey, getClientMeQueryKey, getResourcesQueryKey, getSupportQueryKey,
  getClientNotificationsQueryKey,
  useAnnouncements, useClientBookings, useClientLogout, useClientMe, useCreateClientBooking,
  useCreateSupportThread, useGetSettings, useSupportThreads, useUpdateClientProfile,
  useWellnessResources, useUpdateClientSupportStatus, useClientNotifications,
  useMarkClientNotificationRead, useUpdateClientPreferences,
  useUpdateClientBooking,
  useSubmitClientFeedback,
  useGetClientWellnessAssignments, useUpdateClientWellnessAssignment,
} from '@workspace/api-client-react';
import type { ClientBooking } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock3, Heart, LogOut, Mail, MessageCircle, Moon, Settings2, ShieldAlert, Sparkles, Sun, RefreshCw, XCircle, Star, BookOpen, ClipboardCheck, NotebookPen } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { WelcomeSplash } from '@/components/welcome-splash';
import { getDailyQuote } from '@/lib/motivationalQuotes';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';

function formatCountdown(target: Date, now: Date) {
  const seconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${sz} ${s <= rating ? 'fill-[#E6A23C] text-[#E6A23C]' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  );
}

function BookingCard({
  booking,
  now,
  showCountdown,
  onUpdate,
  updatePending,
  onFeedback,
  feedbackPending,
}: {
  booking: ClientBooking;
  now: Date;
  showCountdown: boolean;
  onUpdate: (data: { preferredDate?: string; preferredTime?: string; status?: 'cancelled' }) => void;
  updatePending: boolean;
  onFeedback?: (data: { rating: number; comment?: string }) => void;
  feedbackPending?: boolean;
}) {
  const statusLabel = booking.status === 'no_show' ? 'No-show' : booking.status.replace('_', ' ');
  const appointmentTime = parseISO(`${booking.preferredDate}T${booking.preferredTime}`);
  const isUpcoming = !isBefore(appointmentTime, now);
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [date, setDate] = useState(booking.preferredDate);
  const [time, setTime] = useState(booking.preferredTime);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackHover, setFeedbackHover] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const editable = isUpcoming && booking.status !== 'cancelled' && booking.status !== 'completed';
  const isCompleted = booking.status === 'completed';

  const handleFeedbackSubmit = () => {
    if (!onFeedback) return;
    onFeedback({ rating: feedbackRating, comment: feedbackComment || undefined });
    setShowFeedbackForm(false);
  };

  return <div className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><p className="font-medium">{format(parseISO(`${booking.preferredDate}T${booking.preferredTime}`), 'EEEE, MMMM d')}</p><Badge variant={booking.status === 'cancelled' ? 'destructive' : 'secondary'}>{statusLabel}</Badge></div><p className="mt-1 text-sm text-muted-foreground"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{booking.preferredTime} · {booking.reason}</p></div>
      <div className="flex items-center gap-3"><p className="font-mono text-xs text-muted-foreground">{booking.confirmationCode}</p>{showCountdown && isUpcoming && editable && <div className="rounded-xl bg-primary/10 px-3 py-2 text-right"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Starts in</p><p className="font-semibold text-primary">{formatCountdown(appointmentTime, now)}</p></div>}</div>
    </div>
    {editable && !editing && !confirmCancel && <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3"><Button type="button" size="sm" variant="outline" onClick={() => { setDate(booking.preferredDate); setTime(booking.preferredTime); setEditing(true); }}><RefreshCw className="h-3.5 w-3.5" /> Reschedule</Button><Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmCancel(true)}><XCircle className="h-3.5 w-3.5" /> Cancel appointment</Button></div>}
    {editing && <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3"><p className="text-sm font-medium">Choose a new date and time</p><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor={`reschedule-date-${booking.id}`}>Date</Label><Input id={`reschedule-date-${booking.id}`} type="date" min={format(new Date(), 'yyyy-MM-dd')} value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="space-y-1"><Label htmlFor={`reschedule-time-${booking.id}`}>Time</Label><Input id={`reschedule-time-${booking.id}`} type="time" step="900" value={time} onChange={(event) => setTime(event.target.value)} /></div></div><p className="text-xs text-muted-foreground">Any requested time is checked against business hours, closures, session length, buffers, and other appointments.</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={updatePending || !date || !time} onClick={() => { onUpdate({ preferredDate: date, preferredTime: time }); setEditing(false); }}>Save new time</Button><Button type="button" size="sm" variant="outline" disabled={updatePending} onClick={() => setEditing(false)}>Keep current time</Button></div></div>}
    {confirmCancel && <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3"><p className="text-sm font-medium">Cancel this appointment?</p><p className="text-xs text-muted-foreground">This cannot be undone. You can submit a new request later.</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="destructive" disabled={updatePending} onClick={() => { onUpdate({ status: 'cancelled' }); setConfirmCancel(false); }}>Yes, cancel appointment</Button><Button type="button" size="sm" variant="outline" disabled={updatePending} onClick={() => setConfirmCancel(false)}>Keep appointment</Button></div></div>}

    {/* Feedback section for completed bookings */}
    {isCompleted && (
      <div className="border-t border-border/60 pt-3">
        {booking.feedback ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <StarRow rating={booking.feedback.rating} />
              <span className="text-xs text-muted-foreground">Your feedback</span>
            </div>
            {booking.feedback.comment && (
              <p className="text-xs text-muted-foreground italic">"{booking.feedback.comment}"</p>
            )}
          </div>
        ) : !showFeedbackForm ? (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setShowFeedbackForm(true)}>
            <Star className="h-3.5 w-3.5" /> Rate this session
          </Button>
        ) : (
          <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
            <p className="text-sm font-medium">How was your session?</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (feedbackHover ?? feedbackRating) >= star;
                return (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    onMouseEnter={() => setFeedbackHover(star)}
                    onMouseLeave={() => setFeedbackHover(null)}
                    className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star className={`h-6 w-6 transition-colors ${active ? 'fill-[#E6A23C] text-[#E6A23C]' : 'text-muted-foreground/40'}`} />
                  </button>
                );
              })}
            </div>
            <Textarea
              placeholder="Optional: share any thoughts about your session…"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              rows={2}
              maxLength={2000}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={feedbackPending} onClick={handleFeedbackSubmit}>Submit feedback</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowFeedbackForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    )}
  </div>;
}

export default function ClientPortal() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session, isLoading: loadingSession, error: sessionError } = useClientMe({ query: { retry: false } });
  const { data: bookings = [], isLoading: loadingBookings } = useClientBookings({ query: { enabled: Boolean(session?.authenticated), retry: false } });
  const { data: settings } = useGetSettings();
  const { data: resources = [] } = useWellnessResources();
  const { data: wellnessAssignments = [] } = useGetClientWellnessAssignments({
    query: { enabled: Boolean(session?.authenticated), retry: false },
  });
  const updateWellnessAssignment = useUpdateClientWellnessAssignment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/portal/client/wellness-assignments'] });
        toast({ title: 'Progress updated' });
      },
      onError: () => {
        toast({
          variant: 'destructive',
          title: 'Could not update progress',
          description: 'Please try again.',
        });
      },
    },
  });
  const { data: announcements = [] } = useAnnouncements('client');
  const { data: threads = [] } = useSupportThreads({ query: { enabled: Boolean(session?.authenticated), retry: false } });
  const { data: notifications = [] } = useClientNotifications({ query: { enabled: Boolean(session?.authenticated), retry: false, refetchInterval: 30000 } });
  const logout = useClientLogout({ mutation: { onSuccess: () => { queryClient.clear(); setLocation('/portal/login'); } } });
  const updateProfile = useUpdateClientProfile({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getClientMeQueryKey() }); toast({ title: 'Profile updated' }); } } });
  const createSupport = useCreateSupportThread({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getSupportQueryKey() });
        setSupport({ subject: '', body: '' });
        toast({ title: 'Message sent', description: 'Our team will reply as soon as possible.' });
      },
      onError: (error) => {
        const message = (error as { data?: { error?: string } })?.data?.error;
        toast({
          variant: 'destructive',
          title: 'Message could not be sent',
          description: message ?? 'Please try again.',
        });
      },
    },
  });
  const updateSupportStatus = useUpdateClientSupportStatus({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getSupportQueryKey() }),
    },
  });
  const markNotificationRead = useMarkClientNotificationRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getClientNotificationsQueryKey() }),
    },
  });
  const updatePreferences = useUpdateClientPreferences({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getClientMeQueryKey() }),
      onError: () => toast({ variant: 'destructive', title: 'Preference not saved', description: 'Please try again.' }),
    },
  });
  const createBooking = useCreateClientBooking({
    mutation: {
      onSuccess: (booking) => {
        queryClient.invalidateQueries({ queryKey: getClientBookingsQueryKey() });
        setBooking({ reason: '', preferredDate: '', preferredTime: '' });
        setBookingConfirmation(booking.confirmationCode);
        toast({ title: 'Session request sent', description: 'Your appointment request is now with the care team.' });
      },
      onError: (error) => {
        const message = (error as { data?: { error?: string } })?.data?.error;
        toast({ variant: 'destructive', title: 'Could not request a session', description: message ?? 'Please choose another time and try again.' });
      },
    },
  });
  const updateBooking = useUpdateClientBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getClientBookingsQueryKey() });
        toast({ title: 'Appointment updated' });
      },
      onError: (error) => {
        const message = (error as { data?: { error?: string } })?.data?.error;
        toast({ variant: 'destructive', title: 'Appointment could not be updated', description: message ?? 'Please choose another time and try again.' });
      },
    },
  });
  const submitFeedback = useSubmitClientFeedback({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getClientBookingsQueryKey() });
        toast({ title: 'Feedback submitted', description: 'Thank you for sharing your experience.' });
      },
      onError: (error) => {
        const message = (error as { data?: { error?: string } })?.data?.error;
        toast({ variant: 'destructive', title: 'Feedback could not be submitted', description: message ?? 'Please try again.' });
      },
    },
  });
  const [support, setSupport] = useState({ subject: '', body: '' });
  const [booking, setBooking] = useState({ reason: '', preferredDate: '', preferredTime: '' });
  const [bookingConfirmation, setBookingConfirmation] = useState('');
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [now, setNow] = useState(() => new Date());
  const [recognizedDevice, setRecognizedDevice] = useState(false);

  useEffect(() => { if (session?.client) setProfile({ name: session.client.name, phone: session.client.phone ?? '' }); }, [session]);
  useEffect(() => {
    if (!session?.client) return;
    const key = `ats-recognized-client:${session.client.id}`;
    try {
      localStorage.setItem(key, JSON.stringify({ recognized: true }));
      setRecognizedDevice(true);
    } catch {
      setRecognizedDevice(false);
    }
  }, [session?.client]);
  useEffect(() => { if (!loadingSession && (sessionError || !session?.authenticated)) setLocation('/portal/login'); }, [loadingSession, session, sessionError, setLocation]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = useMemo(() => bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && !isBefore(parseISO(`${b.preferredDate}T${b.preferredTime}`), new Date())), [bookings]);
  const past = bookings.filter((b) => !upcoming.includes(b));
  if (loadingSession || !session?.client) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>;

  return <main className="ats-client-portal min-h-screen bg-[#f7f2e9] text-foreground dark:bg-background">
     <WelcomeSplash name={session.client.name.split(' ')[0]} storageKey="ats-client-welcome-seen" />
     <header className="border-b border-border bg-background/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-secondary p-1"><img src={settings?.logoUrl || logoUrl} alt="Ayden's Therapy Services" className="h-full w-full object-cover mix-blend-multiply" /></span><div><p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-destructive">Private client space</p><p className="font-serif text-2xl font-normal">Welcome back, {session.client.name.split(' ')[0]}</p></div></div><div className="flex items-center gap-2"><ThemeToggle compact /><Link href="/" className="hidden text-xs font-semibold text-muted-foreground hover:text-destructive sm:block">Practice home</Link><Button variant="ghost" size="sm" onClick={() => logout.mutate()}><LogOut className="h-4 w-4" /> Sign out</Button></div></div></header>
     <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
       {announcements[0] && <Alert className="mb-8 border-primary/20 bg-primary/5"><Sparkles className="h-4 w-4" /><AlertTitle>{announcements[0].title}</AlertTitle><AlertDescription>{announcements[0].body}</AlertDescription></Alert>}
       <div className="mb-9 flex flex-col justify-between gap-4 border-b border-border pb-7 sm:flex-row sm:items-end"><div><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p><h1 className="font-serif text-5xl font-normal leading-[.9] sm:text-6xl">Your care, in one clear space.</h1></div><p className="max-w-xs text-sm leading-6 text-muted-foreground">A calm place to keep the practical pieces of care together.</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="h-auto"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="wellness"><Heart className="mr-1.5 h-4 w-4" />Wellness Journey</TabsTrigger><TabsTrigger value="notifications">Updates {notifications.some((item) => !item.read) && <span className="ml-1 h-2 w-2 rounded-full bg-destructive" />}</TabsTrigger><TabsTrigger value="book">Book a session</TabsTrigger><TabsTrigger value="resources">Wellness resources</TabsTrigger><TabsTrigger value="support">Support</TabsTrigger><TabsTrigger value="profile">My information</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-6">
           <div className="grid gap-4 md:grid-cols-3"><Card className="rounded-2xl bg-primary text-primary-foreground"><CardHeader><CardDescription className="text-primary-foreground/70">Upcoming sessions</CardDescription><CardTitle className="text-4xl">{upcoming.length}</CardTitle></CardHeader><CardContent><CalendarDays className="h-5 w-5 opacity-70" /></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardDescription>Next appointment</CardDescription><CardTitle className="text-2xl">{upcoming[0] ? format(parseISO(upcoming[0].preferredDate), 'MMM d') : 'Nothing booked'}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{upcoming[0] ? `${upcoming[0].preferredTime} · ${upcoming[0].reason}` : 'Ready when you are.'}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardDescription>Need help?</CardDescription><CardTitle className="text-2xl">We’re here</CardTitle></CardHeader><CardContent><button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setActiveTab('support')}>Contact support →</button></CardContent></Card></div>
           <Card className="overflow-hidden rounded-2xl border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/10"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.18em] text-primary">A thought for today</p><p className="font-serif text-xl leading-8">“{getDailyQuote().quote}”</p><p className="mt-1 text-sm text-muted-foreground">{getDailyQuote().author}</p></div><Sparkles className="hidden h-10 w-10 text-primary/50 sm:block" /></CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle>Upcoming appointments</CardTitle><CardDescription>Your next sessions and confirmation details. You can reschedule or cancel an upcoming appointment here.</CardDescription></CardHeader><CardContent className="space-y-3">{loadingBookings ? <p className="text-sm text-muted-foreground">Loading appointments…</p> : upcoming.length ? upcoming.map((booking) => <BookingCard key={booking.id} booking={booking} now={now} showCountdown={recognizedDevice && settings?.featureFlags?.clientPortalCountdown !== false} onUpdate={(data) => updateBooking.mutate({ id: booking.id, data })} updatePending={updateBooking.isPending} />) : <div className="rounded-2xl bg-muted/50 p-6 text-center"><Heart className="mx-auto mb-2 h-6 w-6 text-primary" /><p className="font-medium">No upcoming appointments</p><Button type="button" variant="link" className="mt-2 h-auto p-0" onClick={() => setActiveTab('book')}>Book a session</Button></div>}</CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle>Past appointments</CardTitle></CardHeader><CardContent className="space-y-3">{past.slice(0, 5).map((b) => <BookingCard key={b.id} booking={b} now={now} showCountdown={false} onUpdate={() => undefined} updatePending={false} onFeedback={(data) => submitFeedback.mutate({ bookingId: b.id, data })} feedbackPending={submitFeedback.isPending} />)}{!past.length && <p className="text-sm text-muted-foreground">Your completed sessions will appear here.</p>}</CardContent></Card>
        </TabsContent>
                 <TabsContent value="wellness" className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-primary/15">
            <CardHeader className="bg-gradient-to-br from-primary/10 via-card to-secondary/10">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Your Wellness Journey
              </CardTitle>
              <CardDescription>
                Personalized activities and reflections assigned by your care team to support your growth between sessions.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {wellnessAssignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-primary/70" />
                  <h3 className="mt-3 font-serif text-xl font-semibold">
                    Your journey starts here
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Your care team has not assigned any wellness activities yet.
                    Check back after your next session.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {wellnessAssignments.map((assignment) => {
                    const typeLabel =
                      assignment.type === 'wellness_journey'
                        ? 'Wellness Journey'
                        : assignment.type === 'notebook'
                          ? 'Notebook'
                          : 'Homework';

                    const TypeIcon =
                      assignment.type === 'wellness_journey'
                        ? Heart
                        : assignment.type === 'notebook'
                          ? NotebookPen
                          : ClipboardCheck;

                    return (
                      <div
                        key={assignment.id}
                        className="rounded-2xl border border-border/70 bg-background/60 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-3">
                            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                              <TypeIcon className="h-5 w-5" />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">
                                  {assignment.title}
                                </h3>
                                <Badge variant="secondary">
                                  {typeLabel}
                                </Badge>
                              </div>

                              {assignment.dueDate && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Due {format(parseISO(assignment.dueDate), 'MMMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>

                          <Badge
                            variant={
                              assignment.status === 'completed'
                                ? 'default'
                                : 'secondary'
                            }
                            className="w-fit capitalize"
                          >
                            {assignment.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="mt-4 rounded-xl bg-muted/30 p-4">
                          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {assignment.content}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {assignment.status === 'assigned' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                updateWellnessAssignment.mutate({
                                  id: assignment.id,
                                  status: 'in_progress',
                                })
                              }
                              disabled={updateWellnessAssignment.isPending}
                            >
                              <BookOpen className="h-4 w-4" />
                              Start activity
                            </Button>
                          )}

                          {assignment.status === 'in_progress' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                updateWellnessAssignment.mutate({
                                  id: assignment.id,
                                  status: 'completed',
                                })
                              }
                              disabled={updateWellnessAssignment.isPending}
                            >
                              <ClipboardCheck className="h-4 w-4" />
                              Mark completed
                            </Button>
                          )}

                          {assignment.status === 'completed' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateWellnessAssignment.mutate({
                                  id: assignment.id,
                                  status: 'in_progress',
                                })
                              }
                              disabled={updateWellnessAssignment.isPending}
                            >
                              Reopen activity
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

<TabsContent value="notifications" className="space-y-6">
           <Card className="rounded-2xl"><CardHeader><CardTitle>Updates from your care team</CardTitle><CardDescription>Important messages and practice updates stay here until you mark them read.</CardDescription></CardHeader><CardContent className="space-y-3">{notifications.length ? notifications.map((notification) => <button key={notification.id} type="button" onClick={() => !notification.read && markNotificationRead.mutate(notification.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${notification.read ? 'border-border/60 bg-muted/20' : 'border-primary/25 bg-primary/5 hover:bg-primary/10'}`}><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{notification.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{notification.body}</p></div>{!notification.read && <Badge className="shrink-0">New</Badge>}</div><p className="mt-3 text-xs text-muted-foreground">{format(new Date(notification.createdAt), 'MMM d, yyyy')}</p></button>) : <div className="rounded-2xl bg-muted/40 p-8 text-center"><Sparkles className="mx-auto mb-3 h-7 w-7 text-primary" /><p className="font-medium">No updates yet</p><p className="mt-1 text-sm text-muted-foreground">New messages from the care team will appear here.</p></div>}</CardContent></Card>
         </TabsContent>
           <TabsContent value="book"><Card className="mx-auto max-w-3xl overflow-hidden rounded-2xl border-primary/15"><CardHeader className="bg-gradient-to-br from-primary/10 via-card to-secondary/10"><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Request a session</CardTitle><CardDescription>Choose a time that works for you. Your name and contact information are already saved to your client account.</CardDescription></CardHeader><CardContent className="p-6">{bookingConfirmation ? <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarDays className="h-6 w-6" /></div><h3 className="mt-4 font-serif text-2xl font-semibold">Request received</h3><p className="mt-2 text-sm text-muted-foreground">The care team will review your request and follow up with confirmation.</p><p className="mt-4 text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Confirmation code</p><p className="mt-2 font-mono text-xl font-bold tracking-widest text-primary">{bookingConfirmation}</p><Button className="mt-5 rounded-xl" onClick={() => setBookingConfirmation('')}>Request another time</Button></div> : settings?.sessionRequestsOpen === false ? <div className="rounded-2xl bg-muted/50 p-6 text-center"><p className="font-medium">Session requests are currently closed</p><p className="mt-1 text-sm text-muted-foreground">Please use Support to contact the care team about scheduling.</p><Button variant="outline" className="mt-4 rounded-xl" onClick={() => setActiveTab('support')}>Contact support</Button></div> : <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); createBooking.mutate(booking); }}><div className="rounded-xl bg-muted/35 p-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">{session.client.name}</span> · {session.client.phone || 'No phone number saved'}</div><div className="space-y-2"><Label htmlFor="client-booking-reason">What would you like support with?</Label><Textarea id="client-booking-reason" value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} placeholder="Share a brief reason for your session…" minLength={10} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="client-booking-date">Preferred date</Label><Input id="client-booking-date" type="date" min={format(new Date(), 'yyyy-MM-dd')} value={booking.preferredDate} onChange={(event) => setBooking({ ...booking, preferredDate: event.target.value })} required /></div><div className="space-y-2"><Label htmlFor="client-booking-time">Preferred time</Label><Input id="client-booking-time" type="time" value={booking.preferredTime} onChange={(event) => setBooking({ ...booking, preferredTime: event.target.value })} required /></div></div><Button className="rounded-xl" disabled={createBooking.isPending}><CalendarDays className="h-4 w-4" /> {createBooking.isPending ? 'Sending request…' : 'Request session'}</Button></form>}</CardContent></Card></TabsContent>
           <TabsContent value="resources"><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <Card key={resource.id} className={`rounded-2xl ${resource.isEmergency ? 'border-destructive/30 bg-destructive/5' : ''}`}><CardHeader><div className="mb-2 flex items-center justify-between"><Badge variant={resource.isEmergency ? 'destructive' : 'secondary'}>{resource.category}</Badge>{resource.isEmergency && <ShieldAlert className="h-5 w-5 text-destructive" />}</div><CardTitle>{resource.title}</CardTitle><CardDescription>{resource.description}</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{resource.content}</p></CardContent></Card>)}</div></TabsContent>
         <TabsContent value="support" className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><Card className="rounded-2xl"><CardHeader><CardTitle>Contact the team</CardTitle><CardDescription>Send a private support message about scheduling or your account.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createSupport.mutate(support); }}><div className="space-y-2"><Label>Subject</Label><Input value={support.subject} onChange={(e) => setSupport({ ...support, subject: e.target.value })} required /></div><div className="space-y-2"><Label>Message</Label><Textarea value={support.body} onChange={(e) => setSupport({ ...support, body: e.target.value })} required /></div><Button disabled={createSupport.isPending}><Mail className="h-4 w-4" /> Send message</Button></form></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle>Your support threads</CardTitle><CardDescription>You can close a resolved conversation and reopen it whenever you need more help.</CardDescription></CardHeader><CardContent className="space-y-4">{threads.length ? threads.map((thread) => <div key={thread.id} className={`rounded-2xl border p-4 ${thread.status === 'closed' ? 'border-border/60 bg-muted/25' : 'border-primary/20 bg-card'}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{thread.subject}</p><div className="flex items-center gap-2"><Badge className={thread.status === 'closed' ? 'border-0 bg-muted text-muted-foreground' : 'border-0 bg-[#E6C27A]/35 text-[#664A22] dark:bg-[#9A7535]/35 dark:text-[#F3D99A]'}>{thread.status}</Badge><Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={updateSupportStatus.isPending} onClick={() => updateSupportStatus.mutate({ id: thread.id, status: thread.status === 'closed' ? 'open' : 'closed' })}>{thread.status === 'closed' ? 'Reopen' : 'Close'}</Button></div></div><div className="mt-3 space-y-2">{thread.messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.senderType === 'staff' ? 'bg-primary/10' : 'bg-muted'}`}><p className="mb-1 text-xs font-medium text-muted-foreground">{message.senderName}</p>{message.body}</div>)}</div></div>) : <p className="text-sm text-muted-foreground">No support conversations yet.</p>}</CardContent></Card></TabsContent>
        <TabsContent value="profile"><Card className="max-w-xl rounded-2xl"><CardHeader><CardTitle>My information</CardTitle><CardDescription>Keep your contact details current for appointment reminders.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(profile); }}><div className="space-y-2"><Label>Name</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></div><div className="space-y-2"><Label>Email</Label><Input value={session.client.email} disabled /></div><div className="space-y-2"><Label>Phone</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} required /></div><Button disabled={updateProfile.isPending}>Save information</Button></form></CardContent></Card></TabsContent>
          <TabsContent value="settings"><Card className="max-w-2xl rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Portal settings</CardTitle><CardDescription>Make this private space feel comfortable for you. Your theme preference is saved on this device.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between rounded-2xl border bg-muted/30 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Moon className="h-5 w-5 dark:hidden" /><Sun className="hidden h-5 w-5 dark:block" /></div><div><p className="font-medium">Appearance</p><p className="text-sm text-muted-foreground">Use a warm light canvas or a softer evening view.</p></div></div><ThemeToggle /></div>{settings?.featureFlags?.clientUpdatesOptIn !== false && <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/30 p-4"><div><p className="font-medium">Receive practice updates</p><p className="text-sm text-muted-foreground">Allow the care team to send non-urgent updates to your notification wall.</p></div><input aria-label="Receive practice updates" type="checkbox" checked={session.client.updatesOptIn === true} onChange={(event) => updatePreferences.mutate({ updatesOptIn: event.target.checked })} className="h-5 w-5 accent-[hsl(var(--primary))]" /></div>}<div className="rounded-2xl bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">Your care information remains private. The client portal is for coordination and support messages, not emergency response.</div></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  </main>;
}