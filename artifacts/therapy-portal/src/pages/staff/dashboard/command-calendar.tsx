import { useMemo, useState } from "react";
import { Link } from "wouter";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { useListBookings, useGetAuthMe, type Booking } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ListFilter, RefreshCw } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  claimed: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  waitlisted: "Waitlisted",
};

function statusClass(status: string) {
  switch (status) {
    case "claimed": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "completed": return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "cancelled": return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case "no_show": return "border-muted-foreground/25 bg-muted text-muted-foreground";
    case "waitlisted": return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    default: return "border-primary/25 bg-primary/10 text-primary";
  }
}

export default function CommandCalendar() {
  const { data: auth } = useGetAuthMe();
  const { data: rawBookings = [], isLoading, error, refetch } = useListBookings();
  const bookings = (Array.isArray(rawBookings) ? rawBookings : []) as Booking[];
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  }), [month]);

  const staffNames = useMemo(() => Array.from(new Set(bookings.map((item) => String(item.claimedBy || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [bookings]);

  const visibleBookings = useMemo(() => bookings.filter((booking) => {
    if (statusFilter !== "all" && String(booking.status) !== statusFilter) return false;
    if (staffFilter !== "all" && String(booking.claimedBy || "") !== staffFilter) return false;
    return true;
  }), [bookings, statusFilter, staffFilter]);

  const countForDay = (day: Date) => visibleBookings.filter((booking) => {
    if (!booking.preferredDate) return false;
    const parsed = parseISO(String(booking.preferredDate).slice(0, 10) + "T12:00:00");
    return !Number.isNaN(parsed.getTime()) && isSameDay(parsed, day) && !["cancelled", "no_show"].includes(String(booking.status));
  }).length;

  const selectedBookings = useMemo(() => visibleBookings.filter((booking) => {
    if (!booking.preferredDate) return false;
    const parsed = parseISO(String(booking.preferredDate).slice(0, 10) + "T12:00:00");
    return !Number.isNaN(parsed.getTime()) && isSameDay(parsed, selectedDay);
  }).sort((a, b) => String(a.preferredTime || "").localeCompare(String(b.preferredTime || ""))), [visibleBookings, selectedDay]);

  const setCalendarMonth = (next: Date) => {
    setMonth(startOfMonth(next));
    setSelectedDay((current) => isSameMonth(current, next) ? current : next);
  };

  const firstName = String((auth as any)?.staffName || "AWS team").split(" ")[0];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[0.13] via-card to-secondary/[0.13] p-6 sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><CalendarDays className="h-4 w-4" /> AWS / Scheduling</div>
            <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight sm:text-5xl">Command Calendar<span className="text-primary">.</span></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A live calendar view of appointment demand, status, and staff assignment. Existing appointments are shown as-is; editing and session controls remain in Bookings.</p>
            <p className="mt-2 text-xs text-muted-foreground">Welcome, {firstName}. {bookings.length} appointment records available.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refetch()} disabled={isLoading}><RefreshCw className={"mr-2 h-4 w-4 " + (isLoading ? "animate-spin" : "")} /> Refresh</Button>
            <Link href="/staff/bookings"><Button>Manage bookings</Button></Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">{format(month, "MMMM yyyy")}</CardTitle>
              <CardDescription>Choose a day to inspect its appointments.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setCalendarMonth(subMonths(month, 1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => { const today = new Date(); setMonth(startOfMonth(today)); setSelectedDay(today); }}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCalendarMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const selected = isSameDay(day, selectedDay);
                const inMonth = isSameMonth(day, month);
                const count = countForDay(day);
                return (
                  <button key={day.toISOString()} type="button" onClick={() => setSelectedDay(day)}
                    className={"flex min-h-[76px] flex-col items-center gap-2 rounded-xl border p-2 text-sm transition-colors sm:min-h-[94px] " +
                      (selected ? "border-primary bg-primary/10 ring-1 ring-primary/40 " : "border-transparent hover:border-border hover:bg-muted/60 ") +
                      (inMonth ? "text-foreground " : "text-muted-foreground/45 ")}>
                    <span className={"grid h-7 w-7 place-items-center rounded-full " + (selected ? "bg-primary font-bold text-primary-foreground" : "")}>{format(day, "d")}</span>
                    {count > 0 ? <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{count} <span className="hidden sm:inline">{count === 1 ? "booking" : "bookings"}</span></span> : <span className="h-5" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground">
              <span>Counts exclude cancelled/no-show items.</span>
              <span className="ml-auto flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Has active bookings</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-2"><ListFilter className="h-4 w-4 text-primary" /><CardTitle>Calendar filters</CardTitle></div>
              <CardDescription>Filters affect the calendar counts and day list.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="space-y-1.5 text-sm"><span className="font-medium">Appointment status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3">
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Staff assignment</span>
                <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3">
                  <option value="all">All staff members</option>
                  <option value="">Unassigned</option>
                  {staffNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <div className="rounded-xl border bg-muted/25 p-3 text-sm"><p className="text-muted-foreground">Appointments on {format(selectedDay, "MMM d")}</p><p className="mt-1 text-2xl font-semibold">{selectedBookings.length}</p><p className="mt-1 text-xs text-muted-foreground">Matching the current filters.</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-xl">{format(selectedDay, "EEEE, MMMM d")}</CardTitle><CardDescription>{selectedBookings.length ? "Select a booking to continue in the booking-management screen." : "Nothing matches this day and filter combination."}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading bookings…</p> : error ? <p className="py-4 text-sm text-destructive">Could not load calendar data. Try refreshing.</p> : selectedBookings.length ? selectedBookings.map((booking) => (
                <article key={booking.id} className="rounded-xl border bg-background/60 p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{booking.clientName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{String(booking.preferredTime || "").slice(0,5) || "Time not set"} · {booking.confirmationCode}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{booking.claimedBy || "Unassigned"}</p>
                    </div>
                    <Badge variant="outline" className={statusClass(String(booking.status))}>{statusLabels[String(booking.status)] || String(booking.status)}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{booking.reason || "No booking description provided."}</p>
                </article>
              )) : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No appointments on this day.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Privacy note: appointment details follow the same permissions as the staff booking list. The calendar is a scheduling view, not a second independent source of booking data.</p>
    </div>
  );
}
