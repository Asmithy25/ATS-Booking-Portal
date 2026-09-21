import { useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardCheck, Heart, Loader2, NotebookPen, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { customFetch } from '@workspace/api-client-react/custom-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type WellnessAssignment = {
  id: number;
  bookingId: number | null;
  type: 'wellness_journey' | 'notebook' | 'homework' | string;
  title: string;
  content: string;
  dueDate: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | string;
  createdAt: string;
  updatedAt: string;
};

type LookupResponse = {
  booking: {
    clientName: string;
    confirmationCode: string;
    preferredDate: string;
    preferredTime: string;
    status: string;
    therapist: string | null;
  };
  assignments: WellnessAssignment[];
};

const typeLabels: Record<string, string> = {
  wellness_journey: 'Wellness Journey',
  notebook: 'Notebook',
  homework: 'Homework',
};

function AssignmentIcon({ type }: { type: string }) {
  if (type === 'wellness_journey') return <Heart className="h-5 w-5" />;
  if (type === 'notebook') return <NotebookPen className="h-5 w-5" />;
  return <ClipboardCheck className="h-5 w-5" />;
}

export function WellnessLookup() {
  const [code, setCode] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setResult(null);

    const normalizedCode = code.trim().toUpperCase();
    const normalizedPhone = phoneLast4.replace(/\D/g, '');

    if (!normalizedCode || !/^\d{4}$/.test(normalizedPhone)) {
      setError('Enter your confirmation code and the last 4 digits of the phone number used for your booking.');
      return;
    }

    setLoading(true);
    try {
      const data = await customFetch<LookupResponse>(
        `/api/bookings/confirm/${encodeURIComponent(normalizedCode)}/wellness-assignments?phone=${normalizedPhone}`,
      );
      setResult(data);
    } catch {
      setError("We couldn't find a booking matching that information. Please check your confirmation code and phone number and try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (assignmentId: number, status: 'in_progress' | 'completed') => {
    if (!result) return;
    setUpdatingId(assignmentId);
    try {
      const updated = await customFetch<WellnessAssignment>(
        `/api/bookings/confirm/${encodeURIComponent(result.booking.confirmationCode)}/wellness-assignments/${assignmentId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ phone: phoneLast4, status }),
        },
      );
      setResult((current) =>
        current
          ? {
              ...current,
              assignments: current.assignments.map((assignment) =>
                assignment.id === assignmentId ? updated : assignment,
              ),
            }
          : current,
      );
    } catch {
      setError('We could not update that assignment. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section id="wellness-lookup" className="border-y border-border/50 bg-card py-20">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Your care between sessions</p>
          <h2 className="mt-3 text-4xl font-serif font-bold">Find Your Wellness Assignments</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Already have a booking? Enter your confirmation code and the last 4 digits of the phone number used for that booking.
          </p>
        </div>

        <Card className="mx-auto mt-10 max-w-2xl rounded-[1.75rem] border-primary/15 shadow-lg">
          <CardHeader>
            <CardTitle>Look up your booking</CardTitle>
            <CardDescription>Your information is verified together before any assignment details are shown.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={lookup} className="grid gap-5 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="wellness-confirmation-code">Confirmation code</Label>
                <Input
                  id="wellness-confirmation-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABC12345"
                  autoComplete="off"
                  className="font-mono uppercase tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wellness-phone-last4">Phone last 4</Label>
                <Input
                  id="wellness-phone-last4"
                  value={phoneLast4}
                  onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={loading} className="rounded-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Finding…' : 'Find assignments'}
              </Button>
            </form>

            {error && (
              <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card className="mx-auto mt-8 max-w-4xl rounded-[1.75rem] border-primary/15">
            <CardHeader className="bg-primary/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Welcome, {result.booking.clientName}</CardTitle>
                  <CardDescription className="mt-2">
                    Confirmation {result.booking.confirmationCode}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="w-fit capitalize">{result.booking.status.replace('_', ' ')}</Badge>
              </div>
              <div className="grid gap-3 pt-3 text-sm text-muted-foreground sm:grid-cols-3">
                <span><CalendarDays className="mr-1 inline h-4 w-4" />{format(parseISO(result.booking.preferredDate), 'MMMM d, yyyy')}</span>
                <span>Appointment: {result.booking.preferredTime}</span>
                <span>Therapist: {result.booking.therapist || 'Not assigned yet'}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {result.assignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <Heart className="mx-auto h-8 w-8 text-primary/60" />
                  <p className="mt-3 font-medium">No wellness assignments yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your care team will add activities here when they are ready.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {result.assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-border/70 bg-background/60 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3">
                          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <AssignmentIcon type={assignment.type} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{assignment.title}</h3>
                              <Badge variant="secondary">{typeLabels[assignment.type] ?? assignment.type}</Badge>
                            </div>
                            {assignment.dueDate && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Due {format(parseISO(assignment.dueDate), 'MMMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant={assignment.status === 'completed' ? 'default' : 'secondary'} className="w-fit capitalize">
                          {assignment.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="mt-4 rounded-xl bg-muted/30 p-4">
                        <p className="whitespace-pre-wrap text-sm leading-6">{assignment.content}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {assignment.status === 'assigned' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => updateStatus(assignment.id, 'in_progress')}
                            disabled={updatingId === assignment.id}
                          >
                            {updatingId === assignment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Start activity
                          </Button>
                        )}
                        {assignment.status === 'in_progress' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => updateStatus(assignment.id, 'completed')}
                            disabled={updatingId === assignment.id}
                          >
                            {updatingId === assignment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Mark completed
                          </Button>
                        )}
                        {assignment.status === 'completed' && (
                          <p className="text-xs font-medium text-primary">
                            <CheckCircle2 className="mr-1 inline h-4 w-4" /> Completed
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
