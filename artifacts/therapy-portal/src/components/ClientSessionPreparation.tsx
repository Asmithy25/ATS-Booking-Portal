import { useEffect, useMemo, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import type { ClientLanguage } from "@/lib/clientPortalCopy";
import { format, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, ClipboardList, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Booking = {
  id: number;
  confirmationCode: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
};

type Preparation = {
  id: number;
  bookingId: number;
  focus: string;
  priorities: string;
  supportPreferences: string;
  mood: number | null;
  shareWithStaff: boolean;
  updatedAt: string;
};

export default function ClientSessionPreparation({ bookings, language = "en", defaultShare = false }: { bookings: Booking[]; language?: ClientLanguage; defaultShare?: boolean }) {
  const es = language === "es";
  const { toast } = useToast();
  const [items, setItems] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focus, setFocus] = useState("");
  const [priorities, setPriorities] = useState("");
  const [supportPreferences, setSupportPreferences] = useState("");
  const [mood, setMood] = useState("");
  const [shareWithStaff, setShareWithStaff] = useState(false);

  const upcoming = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return bookings
      .filter((booking) => ["pending", "claimed"].includes(booking.status) && booking.preferredDate >= today)
      .sort((a, b) => (a.preferredDate + a.preferredTime).localeCompare(b.preferredDate + b.preferredTime));
  }, [bookings]);

  useEffect(() => {
    if (selectedId === null && upcoming.length) setSelectedId(upcoming[0].id);
  }, [upcoming, selectedId]);

  useEffect(() => {
    let active = true;
    void customFetch<Preparation[]>("/api/advanced/client/session-prep", { responseType: "json" })
      .then((result) => { if (active) setItems(Array.isArray(result) ? result : []); })
      .catch((error) => {
        if (active) toast({ variant: "destructive", title: es ? "La preparación no está disponible" : "Session preparation unavailable", description: error instanceof Error ? error.message : es ? "Actualiza la página e inténtalo de nuevo." : "Refresh and try again." });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const current = items.find((item) => item.bookingId === selectedId);
  useEffect(() => {
    setFocus(current?.focus ?? "");
    setPriorities(current?.priorities ?? "");
    setSupportPreferences(current?.supportPreferences ?? "");
    setMood(current?.mood ? String(current.mood) : "");
    setShareWithStaff(current?.shareWithStaff ?? defaultShare);
  }, [selectedId, items, defaultShare]);

  const save = async () => {
    if (selectedId === null) return;
    if (!focus.trim() && !priorities.trim() && !supportPreferences.trim() && !mood) {
      toast({ variant: "destructive", title: "Nothing to save yet", description: es ? "Responde al menos una pregunta opcional." : "Add a response to at least one optional question." });
      return;
    }
    setSaving(true);
    try {
      const saved = await customFetch<Preparation>("/api/advanced/client/session-prep", {
        method: "POST",
        body: JSON.stringify({
          bookingId: selectedId,
          focus: focus.trim(),
          priorities: priorities.trim(),
          supportPreferences: supportPreferences.trim(),
          mood: mood ? Number(mood) : null,
          shareWithStaff,
        }),
        responseType: "json",
      });
      setItems((previous) => [...previous.filter((item) => item.bookingId !== selectedId), saved]);
      toast({ title: es ? "Preparación guardada" : "Session preparation saved", description: shareWithStaff ? (es ? "Las notas seleccionadas se comparten con tu equipo de atención." : "Your chosen notes are shared with your care team.") : (es ? "La preparación permanece privada en tu cuenta." : "Your preparation remains private to your client account.") });
    } catch (error) {
      toast({ variant: "destructive", title: es ? "No se pudo guardar la preparación" : "Could not save preparation", description: error instanceof Error ? error.message : es ? "Inténtalo de nuevo en un momento." : "Try again in a moment." });
    } finally {
      setSaving(false);
    }
  };

  const selectedBooking = upcoming.find((booking) => booking.id === selectedId);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card className="overflow-hidden rounded-2xl border-primary/15 shadow-sm">
        <CardHeader className="bg-gradient-to-br from-primary/[0.08] via-card to-secondary/[0.10]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></span>
            <div>
              <CardTitle className="font-serif text-2xl">Before your session</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-6">Take a moment to note what matters to you. Every question is optional, and you can update your answers before the appointment.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {loading ? <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading your preparation…</div> : !upcoming.length ? <div className="rounded-xl border border-dashed p-8 text-center"><CalendarDays className="mx-auto h-8 w-8 text-primary/70" /><p className="mt-3 font-semibold">No upcoming session yet</p><p className="mt-1 text-sm text-muted-foreground">Once you have an upcoming phone consultation, you can prepare here.</p></div> : <>
            <div className="space-y-2">
              <label htmlFor="prep-booking" className="text-sm font-medium">Prepare for</label>
              <select id="prep-booking" value={selectedId ?? ""} onChange={(event) => setSelectedId(Number(event.target.value))} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {upcoming.map((booking) => <option key={booking.id} value={booking.id}>{format(parseISO(booking.preferredDate), "MMMM d, yyyy")} · {booking.preferredTime} · {booking.confirmationCode}</option>)}
              </select>
            </div>
            {selectedBooking && <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 text-sm"><CalendarDays className="h-5 w-5 text-primary" /><div><p className="font-medium">{format(parseISO(selectedBooking.preferredDate), "EEEE, MMMM d")}</p><p className="text-muted-foreground">{selectedBooking.preferredTime} · Phone consultation · Eastern Time</p></div></div>}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><label htmlFor="prep-focus" className="text-sm font-medium">What would you like to focus on?</label><Textarea id="prep-focus" maxLength={200} rows={3} value={focus} onChange={(event) => setFocus(event.target.value)} placeholder=es ? "Un tema, situación o sentimiento que quieras conversar…" : "A topic, situation, or feeling you want to make room for…" /><p className="text-xs text-muted-foreground">{focus.length}/200</p></div>
              <div className="space-y-2"><label htmlFor="prep-priorities" className="text-sm font-medium">What feels most important right now?</label><Textarea id="prep-priorities" maxLength={1800} rows={3} value={priorities} onChange={(event) => setPriorities(event.target.value)} placeholder=es ? "Algunas cosas que quisieras que tu equipo conozca…" : "A few things you'd like your care team to know…" /><p className="text-xs text-muted-foreground">{priorities.length}/1800</p></div>
              <div className="space-y-2"><label htmlFor="prep-support" className="text-sm font-medium">What helps you feel supported?</label><Textarea id="prep-support" maxLength={1200} rows={3} value={supportPreferences} onChange={(event) => setSupportPreferences(event.target.value)} placeholder=es ? "Por ejemplo: hacer una pausa, hacer preguntas o mantener una estructura…" : "For example: taking a pause, asking questions, or keeping things structured…" /><p className="text-xs text-muted-foreground">{supportPreferences.length}/1200</p></div>
              <div className="space-y-2"><label htmlFor="prep-mood" className="text-sm font-medium">How are you feeling before this session? (optional)</label><select id="prep-mood" value={mood} onChange={(event) => setMood(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="">Prefer not to say</option><option value="1">1 · Very low</option><option value="2">2 · A little low</option><option value="3">3 · In the middle</option><option value="4">4 · Doing okay</option><option value="5">5 · Feeling good</option></select><p className="text-xs leading-5 text-muted-foreground">This is a personal check-in, not a diagnosis or a clinical score.</p></div>
            </div>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
              <input type="checkbox" checked={shareWithStaff} onChange={(event) => setShareWithStaff(event.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span><span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Share these responses with my care team</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Off by default. If enabled, authorized staff can read the responses above to help prepare for this appointment. Your private journal and daily mood check-ins are not included.</span></span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs leading-5 text-muted-foreground">These notes are for session preparation, not emergency support. You can change the sharing choice by saving again.</p>
              <Button type="button" onClick={() => void save()} disabled={saving || !selectedBooking} className="rounded-xl">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{saving ? es ? "Guardando…" : "Saving…" : es ? "Guardar preparación" : "Save preparation"}</Button>
            </div>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}
