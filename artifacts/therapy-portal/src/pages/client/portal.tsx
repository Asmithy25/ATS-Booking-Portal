import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { format, isBefore, parseISO } from 'date-fns';
import {
  getClientBookingsQueryKey, getClientMeQueryKey, getResourcesQueryKey, getSupportQueryKey,
  useAnnouncements, useClientBookings, useClientLogout, useClientMe, useCreateSupportThread,
  useSupportThreads, useUpdateClientProfile, useWellnessResources,
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
import { CalendarDays, Clock3, Heart, LogOut, Mail, MessageCircle, ShieldAlert, Sparkles } from 'lucide-react';

function BookingCard({ booking }: { booking: ClientBooking }) {
  const statusLabel = booking.status === 'no_show' ? 'No-show' : booking.status.replace('_', ' ');
  return <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div><div className="flex items-center gap-2"><p className="font-medium">{format(parseISO(`${booking.preferredDate}T${booking.preferredTime}`), 'EEEE, MMMM d')}</p><Badge variant={booking.status === 'cancelled' ? 'destructive' : 'secondary'}>{statusLabel}</Badge></div><p className="mt-1 text-sm text-muted-foreground"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{booking.preferredTime} · {booking.reason}</p></div>
    <p className="font-mono text-xs text-muted-foreground">{booking.confirmationCode}</p>
  </div>;
}

export default function ClientPortal() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session, isLoading: loadingSession, error: sessionError } = useClientMe({ query: { retry: false } });
  const { data: bookings = [], isLoading: loadingBookings } = useClientBookings({ query: { enabled: Boolean(session?.authenticated), retry: false } });
  const { data: resources = [] } = useWellnessResources();
  const { data: announcements = [] } = useAnnouncements('client');
  const { data: threads = [] } = useSupportThreads({ query: { enabled: Boolean(session?.authenticated), retry: false } });
  const logout = useClientLogout({ mutation: { onSuccess: () => { queryClient.clear(); setLocation('/portal/login'); } } });
  const updateProfile = useUpdateClientProfile({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getClientMeQueryKey() }); toast({ title: 'Profile updated' }); } } });
  const createSupport = useCreateSupportThread({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getSupportQueryKey() }); setSupport({ subject: '', body: '' }); toast({ title: 'Message sent', description: 'Our team will reply as soon as possible.' }); } } });
  const [support, setSupport] = useState({ subject: '', body: '' });
  const [profile, setProfile] = useState({ name: '', phone: '' });

  useEffect(() => { if (session?.client) setProfile({ name: session.client.name, phone: session.client.phone ?? '' }); }, [session]);
  useEffect(() => { if (!loadingSession && (sessionError || !session?.authenticated)) setLocation('/portal/login'); }, [loadingSession, session, sessionError, setLocation]);

  const upcoming = useMemo(() => bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && !isBefore(parseISO(`${b.preferredDate}T${b.preferredTime}`), new Date())), [bookings]);
  const past = bookings.filter((b) => !upcoming.includes(b));
  if (loadingSession || !session?.client) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>;

  return <main className="min-h-screen bg-muted/25">
    <header className="border-b border-border/70 bg-background/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Client portal</p><p className="font-serif text-xl font-semibold">Welcome back, {session.client.name.split(' ')[0]}</p></div><div className="flex items-center gap-2"><Link href="/" className="hidden text-sm text-muted-foreground hover:text-primary sm:block">Practice home</Link><Button variant="ghost" size="sm" onClick={() => logout.mutate()}><LogOut className="h-4 w-4" /> Sign out</Button></div></div></header>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      {announcements[0] && <Alert className="mb-6 rounded-2xl border-primary/20 bg-primary/5"><Sparkles className="h-4 w-4" /><AlertTitle>{announcements[0].title}</AlertTitle><AlertDescription>{announcements[0].body}</AlertDescription></Alert>}
      <div className="mb-8"><p className="mb-2 text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p><h1 className="text-3xl font-semibold sm:text-4xl">Your care, in one clear space.</h1></div>
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-background p-1 sm:w-auto"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="resources">Wellness resources</TabsTrigger><TabsTrigger value="support">Support</TabsTrigger><TabsTrigger value="profile">My information</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3"><Card className="rounded-2xl bg-primary text-primary-foreground"><CardHeader><CardDescription className="text-primary-foreground/70">Upcoming sessions</CardDescription><CardTitle className="text-4xl">{upcoming.length}</CardTitle></CardHeader><CardContent><CalendarDays className="h-5 w-5 opacity-70" /></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardDescription>Next appointment</CardDescription><CardTitle className="text-2xl">{upcoming[0] ? format(parseISO(upcoming[0].preferredDate), 'MMM d') : 'Nothing booked'}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{upcoming[0] ? `${upcoming[0].preferredTime} · ${upcoming[0].reason}` : 'Ready when you are.'}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardDescription>Need help?</CardDescription><CardTitle className="text-2xl">We’re here</CardTitle></CardHeader><CardContent><button className="text-sm font-medium text-primary hover:underline" onClick={() => document.querySelector('[data-state="inactive"][value="support"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>Contact support →</button></CardContent></Card></div>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Upcoming appointments</CardTitle><CardDescription>Your next sessions and confirmation details.</CardDescription></CardHeader><CardContent className="space-y-3">{loadingBookings ? <p className="text-sm text-muted-foreground">Loading appointments…</p> : upcoming.length ? upcoming.map((booking) => <BookingCard key={booking.id} booking={booking} />) : <div className="rounded-2xl bg-muted/50 p-6 text-center"><Heart className="mx-auto mb-2 h-6 w-6 text-primary" /><p className="font-medium">No upcoming appointments</p><Link href="/#book" className="mt-2 inline-block text-sm text-primary hover:underline">Book a session</Link></div>}</CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Past appointments</CardTitle></CardHeader><CardContent className="space-y-3">{past.slice(0, 5).map((booking) => <BookingCard key={booking.id} booking={booking} />)}{!past.length && <p className="text-sm text-muted-foreground">Your completed sessions will appear here.</p>}</CardContent></Card>
        </TabsContent>
        <TabsContent value="resources"><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <Card key={resource.id} className={`rounded-2xl ${resource.isEmergency ? 'border-destructive/30 bg-destructive/5' : ''}`}><CardHeader><div className="mb-2 flex items-center justify-between"><Badge variant={resource.isEmergency ? 'destructive' : 'secondary'}>{resource.category}</Badge>{resource.isEmergency && <ShieldAlert className="h-5 w-5 text-destructive" />}</div><CardTitle>{resource.title}</CardTitle><CardDescription>{resource.description}</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{resource.content}</p></CardContent></Card>)}</div></TabsContent>
        <TabsContent value="support" className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><Card className="rounded-2xl"><CardHeader><CardTitle>Contact the team</CardTitle><CardDescription>Send a private support message about scheduling or your account.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createSupport.mutate(support); }}><div className="space-y-2"><Label>Subject</Label><Input value={support.subject} onChange={(e) => setSupport({ ...support, subject: e.target.value })} required /></div><div className="space-y-2"><Label>Message</Label><Textarea value={support.body} onChange={(e) => setSupport({ ...support, body: e.target.value })} required /></div><Button disabled={createSupport.isPending}><Mail className="h-4 w-4" /> Send message</Button></form></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle>Your support threads</CardTitle></CardHeader><CardContent className="space-y-4">{threads.length ? threads.map((thread) => <div key={thread.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between"><p className="font-medium">{thread.subject}</p><Badge variant="outline">{thread.status}</Badge></div><div className="mt-3 space-y-2">{thread.messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.senderType === 'staff' ? 'bg-primary/10' : 'bg-muted'}`}><p className="mb-1 text-xs font-medium text-muted-foreground">{message.senderName}</p>{message.body}</div>)}</div></div>) : <p className="text-sm text-muted-foreground">No support conversations yet.</p>}</CardContent></Card></TabsContent>
        <TabsContent value="profile"><Card className="max-w-xl rounded-2xl"><CardHeader><CardTitle>My information</CardTitle><CardDescription>Keep your contact details current for appointment reminders.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateProfile.mutate(profile); }}><div className="space-y-2"><Label>Name</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></div><div className="space-y-2"><Label>Email</Label><Input value={session.client.email} disabled /></div><div className="space-y-2"><Label>Phone</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} required /></div><Button disabled={updateProfile.isPending}>Save information</Button></form></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  </main>;
}