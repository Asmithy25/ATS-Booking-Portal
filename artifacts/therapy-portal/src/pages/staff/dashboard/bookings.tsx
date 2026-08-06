import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, isBefore, parseISO, startOfToday } from 'date-fns';
import {
  useListBookings,
  useGetBookingStats,
  useUpdateBooking,
  useDeleteBooking,
  getListBookingsQueryKey,
  getGetBookingStatsQueryKey,
  useGetAuthMe,
  useCreateStaffBooking,
  type Booking,
} from '@workspace/api-client-react';

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CelebrationConfetti } from '@/components/celebration-confetti';
import {
  Loader2, Trash2, CheckCircle2, XCircle, UserPlus, Clock, ArrowRight,
  StickyNote, ChevronDown, ChevronUp, CalendarDays, Hash, Plus, Copy, CheckCheck,
  Search, SlidersHorizontal,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  clientName: '',
  phone: '',
  reason: '',
  preferredDate: '',
  preferredTime: '',
  status: 'claimed' as 'pending' | 'claimed' | 'completed' | 'waitlisted',
  priority: 1,
  sessionNotes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Bookings() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [rescheduleMode, setRescheduleMode] = useState<Record<number, boolean>>({});
  const [rescheduleDraft, setRescheduleDraft] = useState<Record<number, { date: string; time: string }>>({});
  const [promotionBooking, setPromotionBooking] = useState<Booking | null>(null);
  const [promotionDraft, setPromotionDraft] = useState({ date: '', time: '' });

  // New booking dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [celebrationKey, setCelebrationKey] = useState(0);

  const { data: authData } = useGetAuthMe();
  const staffName = authData?.staffName || 'Staff';

  const { data: bookings, isLoading: loadingBookings } = useListBookings();
  const { data: stats, isLoading: loadingStats } = useGetBookingStats();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createStaffBooking = useCreateStaffBooking({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingStatsQueryKey() });
        setCreatedCode(data.confirmationCode);
        setForm(EMPTY_FORM);
        setCelebrationKey((key) => key + 1);
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create booking.';
        toast({ variant: 'destructive', title: 'Error', description: msg });
      },
    },
  });

  const updateBooking = useUpdateBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingStatsQueryKey() });
        toast({ title: 'Booking updated successfully' });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        toast({ variant: 'destructive', title: 'Update failed', description: msg });
      },
    },
  });

  const deleteBooking = useDeleteBooking({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBookingStatsQueryKey() });
        toast({ title: 'Booking deleted' });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        toast({ variant: 'destructive', title: 'Delete failed', description: msg });
      },
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const today = startOfToday();
  const baseFilteredBookings = (bookings ?? [])
    .filter((b) => {
      const matchesStatus = activeTab === 'all' || b.status === activeTab;
      const matchesDate = selectedDate
        ? b.preferredDate === selectedDate
        : datePreset === 'today'
          ? b.preferredDate === format(today, 'yyyy-MM-dd')
          : datePreset === 'upcoming'
            ? !isBefore(parseISO(b.preferredDate), today) && b.status !== 'cancelled'
            : true;
      const haystack = `${b.clientName} ${b.phone} ${b.confirmationCode}`.toLowerCase();
      return matchesStatus && matchesDate && (!normalizedSearch || haystack.includes(normalizedSearch));
    });

  const todayKey = format(now, 'yyyy-MM-dd');
  const todayBookings = useMemo(
    () => (bookings ?? []).filter((booking) => booking.preferredDate === todayKey && booking.status !== 'cancelled'),
    [bookings, todayKey],
  );
  const nextBooking = useMemo(
    () => (bookings ?? [])
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'completed')
      .filter((booking) => parseISO(`${booking.preferredDate}T${booking.preferredTime}`) >= now)
      .sort((a, b) => `${a.preferredDate}T${a.preferredTime}`.localeCompare(`${b.preferredDate}T${b.preferredTime}`))[0],
    [bookings, now],
  );
  const nextBookingDate = nextBooking ? parseISO(`${nextBooking.preferredDate}T${nextBooking.preferredTime}`) : null;
  const countdown = nextBookingDate
    ? (() => {
        const remaining = Math.max(0, nextBookingDate.getTime() - now.getTime());
        const hours = Math.floor(remaining / 3_600_000);
        const minutes = Math.floor((remaining % 3_600_000) / 60_000);
        const seconds = Math.floor((remaining % 60_000) / 1_000);
        return `${hours}h ${minutes}m ${seconds}s`;
      })()
    : 'No upcoming sessions';
  const scheduleCapacity = 8;
  const scheduleProgress = Math.min(100, Math.round((todayBookings.length / scheduleCapacity) * 100));
  const missedAppointments = bookings?.filter((booking) => booking.status === 'no_show').length ?? 0;
  const newClientsThisMonth = new Set(
    (bookings ?? [])
      .filter((booking) => booking.createdAt.slice(0, 7) === todayKey.slice(0, 7))
      .map((booking) => booking.phone),
  ).size;

  const setDateFilter = (preset: 'all' | 'today' | 'upcoming') => {
    setDatePreset(preset);
    setSelectedDate('');
  };

  const handleStatusUpdate = (id: number, status: 'claimed' | 'completed' | 'cancelled' | 'no_show' | 'waitlisted') => {
    updateBooking.mutate({ id, data: { status, ...(status === 'claimed' ? { claimedBy: staffName } : {}) } });
  };

  const handleSaveNotes = (id: number) => {
    updateBooking.mutate({ id, data: { sessionNotes: notesDraft[id] } });
  };

  const handleReschedule = (id: number) => {
    const draft = rescheduleDraft[id];
    if (!draft?.date || !draft?.time) {
      toast({ variant: 'destructive', title: 'Select both a date and time.' });
      return;
    }
    updateBooking.mutate(
      { id, data: { preferredDate: draft.date, preferredTime: draft.time } },
      { onSuccess: () => setRescheduleMode(prev => ({ ...prev, [id]: false })) }
    );
  };

  const openReschedule = (id: number, date: string, time: string) => {
    setRescheduleDraft(prev => ({ ...prev, [id]: { date, time } }));
    setRescheduleMode(prev => ({ ...prev, [id]: true }));
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName || !form.phone || !form.reason || !form.preferredDate || !form.preferredTime) {
      toast({ variant: 'destructive', title: 'All fields except notes are required.' });
      return;
    }
    createStaffBooking.mutate({
      clientName: form.clientName.trim(),
      phone: form.phone.trim(),
      reason: form.reason.trim(),
      preferredDate: form.preferredDate,
      preferredTime: form.preferredTime,
      status: form.status,
      priority: form.status === 'waitlisted' ? form.priority : undefined,
      sessionNotes: form.sessionNotes.trim() || undefined,
    });
  };

  const handleCopyCode = () => {
    if (!createdCode) return;
    navigator.clipboard.writeText(createdCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const openPromotion = (booking: Booking) => {
    setPromotionBooking(booking);
    setPromotionDraft({ date: booking.preferredDate, time: booking.preferredTime });
  };

  const closePromotion = () => {
    setPromotionBooking(null);
    setPromotionDraft({ date: '', time: '' });
  };

  const handlePromote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!promotionBooking || !promotionDraft.date || !promotionDraft.time) {
      toast({ variant: 'destructive', title: 'Choose a date and time for this client.' });
      return;
    }
    updateBooking.mutate(
      {
        id: promotionBooking.id,
        data: {
          status: 'claimed',
          claimedBy: staffName,
          preferredDate: promotionDraft.date,
          preferredTime: promotionDraft.time,
          priority: 1,
        },
      },
      { onSuccess: closePromotion },
    );
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCreatedCode(null);
    setCodeCopied(false);
    setForm(EMPTY_FORM);
  };

  // ── Status colors ──────────────────────────────────────────────────────────

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500',
    claimed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500',
    no_show: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500',
    waitlisted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };

  const waitlistBookings = (bookings ?? [])
    .filter((booking) => booking.status === 'waitlisted')
    .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1) || a.createdAt.localeCompare(b.createdAt));
  const waitlistCount = waitlistBookings.length;
  const filteredBookings = activeTab === 'waitlisted'
    ? waitlistBookings.filter((booking) => {
        const matchesSearch = !normalizedSearch || `${booking.clientName} ${booking.phone} ${booking.confirmationCode}`.toLowerCase().includes(normalizedSearch);
        const matchesDate = selectedDate ? booking.preferredDate === selectedDate : true;
        return matchesSearch && matchesDate;
      })
    : baseFilteredBookings.sort((a, b) => `${b.preferredDate}T${b.preferredTime}`.localeCompare(`${a.preferredDate}T${a.preferredTime}`));

  if (loadingBookings || loadingStats) {
    return <div className="space-y-5"><div className="h-10 w-48 rounded-xl bg-muted animate-pulse" /><div className="h-24 rounded-2xl bg-muted animate-pulse" /><div className="h-72 rounded-2xl bg-muted animate-pulse" /></div>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary mb-2">Care coordination</p>
          <h1 className="text-3xl font-serif font-bold text-foreground">Bookings</h1>
          <p className="text-muted-foreground mt-2">Manage all session requests and history.</p>
        </div>
        <Button data-testid="button-new-booking" onClick={() => { setDialogOpen(true); setCreatedCode(null); }} className="shrink-0 rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden rounded-[1.75rem] border-primary/15 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="relative grid h-32 w-32 shrink-0 place-items-center">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(hsl(var(--primary)) ${scheduleProgress}%, hsl(var(--muted)) ${scheduleProgress}% 100%)` }}
              />
              <div className="relative grid h-24 w-24 place-items-center rounded-full bg-card shadow-inner">
                <span className="font-serif text-2xl font-semibold text-primary">{scheduleProgress}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Today&apos;s rhythm</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">Your schedule is {scheduleProgress}% booked.</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {todayBookings.length ? `${todayBookings.length} appointment${todayBookings.length === 1 ? '' : 's'} on the calendar today.` : 'A clear calendar is still a chance to prepare, connect, and reset.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-background/70 px-3 py-1.5">{todayBookings.length} today</span>
                <span className="rounded-full bg-background/70 px-3 py-1.5">{missedAppointments} missed total</span>
                <span className="rounded-full bg-background/70 px-3 py-1.5">{newClientsThisMonth} new this month</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.75rem]">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" /> Next appointment</CardTitle></CardHeader>
          <CardContent>
            {nextBooking ? (
              <>
                <p className="font-serif text-2xl font-semibold">{nextBooking.clientName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{format(nextBookingDate!, 'EEEE, MMM d')} at {nextBooking.preferredTime}</p>
                <p className="mt-4 font-mono text-lg tabular-nums text-primary">{countdown}</p>
                <p className="mt-1 text-xs text-muted-foreground">counting down in your local time</p>
              </>
            ) : <p className="text-sm text-muted-foreground">No upcoming sessions are scheduled.</p>}
          </CardContent>
        </Card>
      </div>

       <CelebrationConfetti trigger={celebrationKey} />

       <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
         {[
          ['Today', todayBookings.length, 'appointments'],
          ['Pending', stats?.pending ?? 0, 'needs attention'],
          ['New clients', newClientsThisMonth, 'this month'],
          ['Goal progress', `${Math.min(100, Math.round(((stats?.completed ?? 0) / 20) * 100))}%`, '20 completed sessions'],
        ].map(([label, value, detail], index) => (
           <Card key={label} className="ats-stat-card rounded-2xl transition-all duration-500 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${index * 90}ms` }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 animate-in fade-in slide-in-from-bottom-2 text-2xl font-semibold duration-700">{value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          {createdCode ? (
            /* ── Success state ── */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Booking Created
                </DialogTitle>
                <DialogDescription>
                  The appointment has been added. Share the confirmation code with the client so they can manage their booking.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Confirmation Code
                  </p>
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-xl px-6 py-4 font-mono text-2xl font-bold tracking-widest text-primary select-all">
                    {createdCode}
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={handleCopyCode}>
                  {codeCopied
                    ? <><CheckCheck className="w-4 h-4 mr-2 text-green-600" />Copied!</>
                    : <><Copy className="w-4 h-4 mr-2" />Copy Code</>}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeDialog}>Done</Button>
                <Button variant="outline" onClick={() => { setCreatedCode(null); setCodeCopied(false); }}>
                  Add Another
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* ── Form state ── */
            <form onSubmit={handleCreateBooking}>
              <DialogHeader>
                <DialogTitle>New Booking</DialogTitle>
                <DialogDescription>
                  Create an appointment on behalf of a client. A confirmation code will be generated automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="py-5 space-y-4">
                {/* Row 1: Name + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nb-name">Client Name</Label>
                    <Input
                      id="nb-name"
                      placeholder="Jane Smith"
                      value={form.clientName}
                      onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nb-phone">Phone Number</Label>
                    <Input
                      id="nb-phone"
                      placeholder="(555) 000-0000"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label htmlFor="nb-reason">Reason for Session</Label>
                  <Textarea
                    id="nb-reason"
                    placeholder="Brief description of why the client is seeking therapy..."
                    className="resize-none min-h-[80px]"
                    value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    required
                  />
                </div>

                {/* Row 2: Date + Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nb-date">Preferred Date</Label>
                    <Input
                      id="nb-date"
                      type="date"
                      value={form.preferredDate}
                      onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nb-time">Preferred Time</Label>
                    <Input
                      id="nb-time"
                      type="time"
                      value={form.preferredTime}
                      onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* Row 3: Status */}
                 <div className="space-y-1.5">
                  <Label>Initial Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={v => setForm(f => ({ ...f, status: v as typeof f.status }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claimed">Claimed — assign to me immediately</SelectItem>
                      <SelectItem value="pending">Pending — unassigned</SelectItem>
                      <SelectItem value="waitlisted">Waitlist — hold for an opening</SelectItem>
                      <SelectItem value="completed">Completed — session already done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                 {form.status === 'waitlisted' && (
                   <div className="space-y-1.5">
                     <Label>Waitlist Priority</Label>
                     <Select
                       value={String(form.priority)}
                       onValueChange={v => setForm(f => ({ ...f, priority: Number(v) }))}
                     >
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="3">Urgent — contact first</SelectItem>
                         <SelectItem value="2">High — prioritize soon</SelectItem>
                         <SelectItem value="1">Normal — standard queue</SelectItem>
                         <SelectItem value="0">Low — flexible timing</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 )}

                {/* Session Notes (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="nb-notes">Session Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="nb-notes"
                    placeholder="Any internal notes about this booking..."
                    className="resize-none min-h-[60px]"
                    value={form.sessionNotes}
                    onChange={e => setForm(f => ({ ...f, sessionNotes: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={createStaffBooking.isPending}>
                  {createStaffBooking.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Booking
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

       <Dialog open={Boolean(promotionBooking)} onOpenChange={(open) => { if (!open) closePromotion(); }}>
         <DialogContent className="max-w-md">
           <form onSubmit={handlePromote}>
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5 text-primary" /> Promote from waitlist</DialogTitle>
               <DialogDescription>
                 {promotionBooking
                   ? `Choose an open slot for ${promotionBooking.clientName}. The practice hours, closures, buffers, and existing appointments will be checked before promotion.`
                   : 'Choose an open slot for this client.'}
               </DialogDescription>
             </DialogHeader>
             <div className="grid grid-cols-2 gap-3 py-5">
               <div className="space-y-1.5">
                 <Label htmlFor="waitlist-promote-date">Appointment date</Label>
                 <Input
                   id="waitlist-promote-date"
                   type="date"
                   value={promotionDraft.date}
                   onChange={(event) => setPromotionDraft((draft) => ({ ...draft, date: event.target.value }))}
                   required
                 />
               </div>
               <div className="space-y-1.5">
                 <Label htmlFor="waitlist-promote-time">Appointment time</Label>
                 <Input
                   id="waitlist-promote-time"
                   type="time"
                   value={promotionDraft.time}
                   onChange={(event) => setPromotionDraft((draft) => ({ ...draft, time: event.target.value }))}
                   required
                 />
               </div>
             </div>
             <DialogFooter>
               <Button type="button" variant="outline" onClick={closePromotion}>Keep on waitlist</Button>
               <Button type="submit" disabled={updateBooking.isPending}>
                 {updateBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                 Promote to appointment
               </Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats?.total ?? 0 },
          { label: 'Pending', value: stats?.pending ?? 0 },
          { label: 'Claimed', value: stats?.claimed ?? 0 },
          { label: 'Completed', value: stats?.completed ?? 0 },
          { label: 'Cancelled', value: stats?.cancelled ?? 0 },
          { label: 'No-show', value: stats?.noShow ?? 0 },
           { label: 'Waitlist', value: waitlistCount },
        ].map(({ label, value }) => (
          <Card key={label} className="rounded-2xl shadow-sm">
            <CardHeader className="py-4"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
          </Card>
        ))}
        <Card className="bg-primary/5 border-primary/20 rounded-2xl shadow-sm">
          <CardHeader className="py-4"><CardTitle className="text-xs font-medium text-primary">Returning</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{stats?.returningClients ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Bookings Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <div className="p-4 border-b border-border flex flex-col gap-3">
             <div className="flex flex-col lg:flex-row lg:items-center gap-3">
             <TabsList className="w-max overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="claimed">Claimed</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
               <TabsTrigger value="no_show">No-show</TabsTrigger>
               <TabsTrigger value="waitlisted" className="gap-1.5">
                 Waitlist
                 {waitlistCount > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{waitlistCount}</span>}
               </TabsTrigger>
            </TabsList>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:ml-auto">
                <div className="relative flex-1 sm:min-w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    aria-label="Search bookings"
                    placeholder="Search client, phone, or code"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <label htmlFor="booking-day-filter" className="text-sm font-medium whitespace-nowrap">Specific date</label>
               <Input
                 id="booking-day-filter"
                 type="date"
                 value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setDatePreset('all');
                  }}
                 className="w-full sm:w-auto"
               />
               {selectedDate && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDateFilter('all')}>Clear</Button>
               )}
             </div>
             </div>
             <div className="flex flex-wrap items-center gap-2">
               <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                 <SlidersHorizontal className="w-3.5 h-3.5" />
                 Quick view
               </div>
               <Button type="button" size="sm" variant={datePreset === 'all' && !selectedDate ? 'secondary' : 'ghost'} onClick={() => setDateFilter('all')}>
                 All dates
               </Button>
               <Button type="button" size="sm" variant={datePreset === 'today' ? 'secondary' : 'ghost'} onClick={() => setDateFilter('today')}>
                 Today
               </Button>
               <Button type="button" size="sm" variant={datePreset === 'upcoming' ? 'secondary' : 'ghost'} onClick={() => setDateFilter('upcoming')}>
                 Upcoming
               </Button>
               <span className="ml-auto text-sm text-muted-foreground">
                 Showing <span className="font-semibold text-foreground">{filteredBookings.length}</span> of {bookings?.length ?? 0}
               </span>
             </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Confirmation Code</TableHead>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Claimed By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                       {selectedDate ? `No ${activeTab === 'all' ? '' : `${activeTab} `}bookings on ${format(parseISO(selectedDate), 'MMMM d, yyyy')}.` : 'No bookings found for this filter.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((b) => (
                    <React.Fragment key={b.id}>
                      {/* Main row */}
                      <TableRow className="group">
                        <TableCell>
                          <Button
                            variant="ghost" size="icon" className="w-6 h-6 rounded-full"
                            onClick={() => {
                              if (expandedRow !== b.id) {
                                setNotesDraft(prev => ({ ...prev, [b.id]: b.sessionNotes || '' }));
                                setRescheduleMode(prev => ({ ...prev, [b.id]: false }));
                              }
                              setExpandedRow(expandedRow === b.id ? null : b.id);
                            }}
                          >
                            {expandedRow === b.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-foreground">{b.clientName}</div>
                          <div className="text-sm text-muted-foreground">{b.phone}</div>
                          {b.isReturningClient && (
                            <Badge variant="outline" className="mt-1 text-[10px] bg-primary/10 text-primary border-primary/20">
                              Returning ({b.previousSessionCount} sessions)
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-sm font-semibold tracking-wide text-foreground select-all">
                              {b.confirmationCode}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div>{format(parseISO(b.preferredDate), 'MMM d, yyyy')}</div>
                              <div className="text-sm text-muted-foreground">{b.preferredTime}</div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className={`${statusColors[b.status as keyof typeof statusColors]} border-0 capitalize`}>
                            {b.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {b.claimedBy || '-'}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            {b.status === 'pending' && (
                              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(b.id, 'claimed')}>
                                Claim
                              </Button>
                            )}
                             {b.status === 'waitlisted' && (
                               <>
                                 <Select
                                   value={String(b.priority ?? 1)}
                                   onValueChange={(value) => updateBooking.mutate({ id: b.id, data: { priority: Number(value) } })}
                                 >
                                   <SelectTrigger className="h-8 w-[116px] text-xs"><SelectValue /></SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="3">Urgent</SelectItem>
                                     <SelectItem value="2">High</SelectItem>
                                     <SelectItem value="1">Normal</SelectItem>
                                     <SelectItem value="0">Low</SelectItem>
                                   </SelectContent>
                                 </Select>
                                 <Button size="sm" onClick={() => openPromotion(b)}>
                                   <ArrowRight className="h-4 w-4" /> Promote
                                 </Button>
                                 <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => {
                                   if (confirm(`Remove ${b.clientName} from the waitlist? The request will remain in history as cancelled.`)) {
                                     handleStatusUpdate(b.id, 'cancelled');
                                   }
                                 }}>
                                   Remove
                                 </Button>
                               </>
                             )}
                               {b.status === 'waitlisted' && (
                                 <div className="border-t border-border pt-5 space-y-3">
                                   <h4 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Waitlist controls</h4>
                                   <p className="text-sm text-muted-foreground">This request is holding its place until an appointment slot is available. Change priority or promote it when you have a valid opening.</p>
                                   <div className="flex flex-wrap gap-2">
                                     <Select
                                       value={String(b.priority ?? 1)}
                                       onValueChange={(value) => updateBooking.mutate({ id: b.id, data: { priority: Number(value) } })}
                                     >
                                       <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                         <SelectItem value="3">Urgent priority</SelectItem>
                                         <SelectItem value="2">High priority</SelectItem>
                                         <SelectItem value="1">Normal priority</SelectItem>
                                         <SelectItem value="0">Low priority</SelectItem>
                                       </SelectContent>
                                     </Select>
                                     <Button size="sm" onClick={() => openPromotion(b)}><ArrowRight className="h-4 w-4" /> Promote to appointment</Button>
                                   </div>
                                 </div>
                               )}

                               {(b.status === 'pending' || b.status === 'claimed') && (
                              <>
                                <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleStatusUpdate(b.id, 'completed')}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleStatusUpdate(b.id, 'cancelled')}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-purple-700 hover:text-purple-800" onClick={() => handleStatusUpdate(b.id, 'no_show')}>
                                  No-show
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm" variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this booking?')) {
                                  deleteBooking.mutate({ id: b.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {expandedRow === b.id && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-6 border-t border-border space-y-6">

                              {/* Reason + Notes */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-primary" /> Reason for Therapy
                                  </h4>
                                  <p className="text-sm text-muted-foreground bg-background p-4 rounded-lg border border-border">
                                    {b.reason}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <StickyNote className="w-4 h-4 text-primary" /> Session Notes
                                  </h4>
                                  <div className="space-y-3">
                                    <Textarea
                                      className="min-h-[100px] bg-background resize-none"
                                      placeholder="Add notes from the consultation..."
                                      value={notesDraft[b.id] ?? ''}
                                      onChange={e => setNotesDraft({ ...notesDraft, [b.id]: e.target.value })}
                                    />
                                    <Button
                                      size="sm"
                                      disabled={notesDraft[b.id] === b.sessionNotes || updateBooking.isPending}
                                      onClick={() => handleSaveNotes(b.id)}
                                    >
                                      {updateBooking.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                      Save Notes
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Reschedule + Cancel (active bookings only) */}
                              {(b.status === 'pending' || b.status === 'claimed') && (
                                <div className="border-t border-border pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <CalendarDays className="w-4 h-4 text-primary" /> Reschedule
                                    </h4>
                                    {!rescheduleMode[b.id] ? (
                                      <Button size="sm" variant="outline" onClick={() => openReschedule(b.id, b.preferredDate, b.preferredTime)}>
                                        Change Date / Time
                                      </Button>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-xs text-muted-foreground block mb-1">New Date</label>
                                            <Input
                                              type="date"
                                              value={rescheduleDraft[b.id]?.date ?? ''}
                                              onChange={e => setRescheduleDraft(prev => ({ ...prev, [b.id]: { ...prev[b.id], date: e.target.value } }))}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs text-muted-foreground block mb-1">New Time</label>
                                            <Input
                                              type="time"
                                              value={rescheduleDraft[b.id]?.time ?? ''}
                                              onChange={e => setRescheduleDraft(prev => ({ ...prev, [b.id]: { ...prev[b.id], time: e.target.value } }))}
                                            />
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" disabled={updateBooking.isPending} onClick={() => handleReschedule(b.id)}>
                                            {updateBooking.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                            Confirm
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => setRescheduleMode(prev => ({ ...prev, [b.id]: false }))}>
                                            Discard
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                      <XCircle className="w-4 h-4 text-destructive" /> Cancel Appointment
                                    </h4>
                                    <Button
                                      size="sm" variant="outline"
                                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                                      disabled={updateBooking.isPending}
                                      onClick={() => {
                                        if (confirm(`Cancel appointment for ${b.clientName}? This cannot be undone.`)) {
                                          handleStatusUpdate(b.id, 'cancelled');
                                        }
                                      }}
                                    >
                                      Cancel Appointment
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
