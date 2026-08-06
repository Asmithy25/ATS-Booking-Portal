import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Clock, Phone, CheckCircle2, XCircle, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface BookingPublic {
  id: number;
  confirmationCode: string;
  clientName: string;
  phone: string;
  reason: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  createdAt: string;
}

async function fetchByCode(code: string): Promise<BookingPublic> {
  const res = await fetch(`/api/bookings/confirm/${encodeURIComponent(code)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Booking not found.');
  return data as BookingPublic;
}

async function patchByCode(code: string, body: Record<string, string>): Promise<BookingPublic> {
  const res = await fetch(`/api/bookings/confirm/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Update failed.');
  return data as BookingPublic;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  claimed: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default function BookingManage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const reminderStorageKey = 'ats-appointment-reminder';

  const { data: booking, isLoading, isError, error } = useQuery<BookingPublic, Error>({
    queryKey: ['booking-public', code],
    queryFn: () => fetchByCode(code),
    enabled: !!code,
    retry: false,
  });

  const appointmentTime = useMemo(() => {
    if (!booking) return null;
    const parsed = parseISO(`${booking.preferredDate}T${booking.preferredTime}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [booking]);

  useEffect(() => {
    if (!booking) return;
    setNow(new Date());
    try {
      const saved = JSON.parse(localStorage.getItem(reminderStorageKey) ?? 'null') as {
        code?: string;
        date?: string;
        time?: string;
        enabled?: boolean;
      } | null;
      setReminderEnabled(
        saved?.enabled === true &&
          saved.code === booking.confirmationCode &&
          saved.date === booking.preferredDate &&
          saved.time === booking.preferredTime &&
          booking.status !== 'cancelled' &&
          booking.status !== 'completed',
      );
    } catch {
      setReminderEnabled(false);
    }
  }, [booking]);

  useEffect(() => {
    if (!appointmentTime || !reminderEnabled || !booking || typeof window === 'undefined') return;
    if (booking.status === 'cancelled' || booking.status === 'completed' || !isAfter(appointmentTime, new Date())) {
      return;
    }

    const notify = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Ayden’s Therapy Services', {
          body: `Your phone session is starting now. Confirmation code: ${booking.confirmationCode}`,
          tag: booking.confirmationCode,
        });
      }
      setReminderEnabled(false);
      localStorage.removeItem(reminderStorageKey);
    };

    const delay = appointmentTime.getTime() - Date.now();
    const timeout = window.setTimeout(notify, Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [appointmentTime, booking, reminderEnabled]);

  useEffect(() => {
    if (!appointmentTime || !reminderEnabled || !booking) return;
    try {
      localStorage.setItem(reminderStorageKey, JSON.stringify({
        code: booking.confirmationCode,
        date: booking.preferredDate,
        time: booking.preferredTime,
        enabled: true,
      }));
    } catch {
      // Local storage is optional; the in-page reminder still works.
    }
  }, [appointmentTime, booking, reminderEnabled]);

  useEffect(() => {
    if (!appointmentTime) return;
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, [appointmentTime]);

  const rescheduleMutation = useMutation({
    mutationFn: (body: Record<string, string>) => patchByCode(code, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['booking-public', code], updated);
      setRescheduleMode(false);
      setNewDate('');
      setNewTime('');
      toast({ title: 'Appointment rescheduled', description: `Updated to ${format(parseISO(updated.preferredDate), 'MMMM d, yyyy')} at ${updated.preferredTime}.` });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Reschedule failed', description: err.message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => patchByCode(code, { status: 'cancelled' }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['booking-public', code], updated);
      setReminderEnabled(false);
      localStorage.removeItem(reminderStorageKey);
      setConfirmCancel(false);
      toast({ title: 'Appointment cancelled', description: 'Your booking has been cancelled.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Cancel failed', description: err.message });
    },
  });

  const handleReschedule = () => {
    if (!newDate || !newTime) {
      toast({ variant: 'destructive', title: 'Please select both a date and time.' });
      return;
    }
    rescheduleMutation.mutate({ preferredDate: newDate, preferredTime: newTime });
  };

  const isEditable = booking && booking.status !== 'completed' && booking.status !== 'cancelled';
  const appointmentHasPassed = appointmentTime ? !isAfter(appointmentTime, now) : false;
  const reminderMessage = !appointmentTime
    ? 'Your appointment time will appear here.'
    : appointmentHasPassed
      ? 'This appointment time has passed.'
      : `Your session is ${formatDistanceToAppointment(appointmentTime, now)}.`;

  const enableReminder = async () => {
    if (!booking || !appointmentTime || appointmentHasPassed || !isEditable) return;
    if (typeof Notification === 'undefined') {
      toast({ variant: 'destructive', title: 'Browser reminders unavailable', description: 'Your browser does not support appointment notifications.' });
      return;
    }
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') {
      toast({ variant: 'destructive', title: 'Notifications were not enabled', description: 'You can enable notifications in your browser settings and try again.' });
      return;
    }
    setReminderEnabled(true);
    toast({ title: 'Reminder enabled', description: 'This browser will remind you at your appointment time.' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicNavbar />

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <button
            onClick={() => setLocation('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>

          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-foreground">Manage Your Booking</h1>
            <p className="text-muted-foreground mt-2">Confirmation code: <span className="font-mono font-semibold text-foreground">{code}</span></p>
          </div>

          {isLoading && (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {isError && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
              <p className="text-muted-foreground mb-6">{(error as Error)?.message || "We couldn't find a booking with that confirmation code."}</p>
              <Button variant="outline" onClick={() => setLocation('/')}>Return to Home</Button>
            </div>
          )}

          {booking && (
            <div className="space-y-6">
              {/* Status banner */}
              {booking.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3 text-red-700">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span className="font-medium">This appointment has been cancelled.</span>
                </div>
              )}
              {booking.status === 'completed' && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3 text-green-700">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="font-medium">This appointment has been completed.</span>
                </div>
              )}

              {/* Booking details card */}
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-primary/5 border-b border-border px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">{booking.clientName}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {booking.phone}
                    </p>
                  </div>
                  <Badge className={`capitalize border ${STATUS_COLORS[booking.status] ?? ''}`} variant="outline">
                    {booking.status}
                  </Badge>
                </div>

                <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Date</p>
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Calendar className="w-4 h-4 text-primary" />
                      {format(parseISO(booking.preferredDate), 'MMMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Time</p>
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Clock className="w-4 h-4 text-primary" />
                      {booking.preferredTime}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Reason</p>
                    <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 border border-border/50">{booking.reason}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Booked on</p>
                    <p className="text-sm text-muted-foreground">{format(parseISO(booking.createdAt), 'MMMM d, yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* Appointment reminder */}
              <div className="bg-secondary/10 border border-secondary/25 rounded-2xl px-6 py-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Appointment reminder</p>
                    <p className="font-medium text-foreground">{reminderMessage}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {reminderEnabled ? 'Browser notification enabled for this booking.' : 'Keep this page open for the live reminder, or enable a browser notification.'}
                    </p>
                  </div>
                  {isEditable && !appointmentHasPassed && (
                    <Button variant={reminderEnabled ? 'outline' : 'default'} onClick={enableReminder} className="shrink-0">
                      {reminderEnabled ? 'Reminder enabled' : 'Enable browser reminder'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Actions — only for pending/claimed */}
              {isEditable && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-border">
                    <h3 className="font-semibold text-foreground">Manage Appointment</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">You can reschedule or cancel your appointment below.</p>
                  </div>

                  <div className="px-6 py-6 space-y-6">
                    {/* Reschedule */}
                    {!confirmCancel && (
                      <div>
                        {!rescheduleMode ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setNewDate(booking.preferredDate);
                              setNewTime(booking.preferredTime);
                              setRescheduleMode(true);
                            }}
                            className="gap-2"
                          >
                            <RefreshCw className="w-4 h-4" /> Reschedule Appointment
                          </Button>
                        ) : (
                          <div className="space-y-4">
                            <h4 className="font-medium text-foreground">Choose a new date and time</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground block mb-1.5">New Date</label>
                                <Input
                                  type="date"
                                  value={newDate}
                                  min={format(new Date(), 'yyyy-MM-dd')}
                                  onChange={(e) => setNewDate(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground block mb-1.5">New Time</label>
                                <Input
                                  type="time"
                                  value={newTime}
                                  onChange={(e) => setNewTime(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Button
                                onClick={handleReschedule}
                                disabled={rescheduleMutation.isPending}
                                className="gap-2"
                              >
                                {rescheduleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirm Reschedule
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setRescheduleMode(false)}
                                disabled={rescheduleMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancel */}
                    {!rescheduleMode && (
                      <div className="border-t border-border pt-6">
                        {!confirmCancel ? (
                          <div>
                            <p className="text-sm text-muted-foreground mb-3">Need to cancel? This action cannot be undone.</p>
                            <Button
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-2"
                              onClick={() => setConfirmCancel(true)}
                            >
                              <XCircle className="w-4 h-4" /> Cancel Appointment
                            </Button>
                          </div>
                        ) : (
                          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-4">
                            <p className="font-medium text-foreground">Are you sure you want to cancel this appointment?</p>
                            <p className="text-sm text-muted-foreground">This cannot be undone. You'll need to submit a new booking request if you change your mind.</p>
                            <div className="flex gap-3">
                              <Button
                                variant="destructive"
                                onClick={() => cancelMutation.mutate()}
                                disabled={cancelMutation.isPending}
                                className="gap-2"
                              >
                                {cancelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Yes, Cancel It
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setConfirmCancel(false)}
                                disabled={cancelMutation.isPending}
                              >
                                Keep Appointment
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Save your confirmation code <span className="font-mono font-semibold">{code}</span> to manage this booking later.
              </p>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function formatDistanceToAppointment(appointment: Date, current: Date): string {
  const minutes = Math.max(1, Math.round((appointment.getTime() - current.getTime()) / 60_000));
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${hours}h ${remainingMinutes}m`;
}
