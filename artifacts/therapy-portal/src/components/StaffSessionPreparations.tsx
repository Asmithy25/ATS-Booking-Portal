import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { CalendarDays, ClipboardCheck, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type SharedPreparation = {
  id: number;
  bookingId: number;
  clientAccountId: number;
  clientName: string;
  preferredDate: string;
  preferredTime: string;
  focus: string;
  priorities: string;
  supportPreferences: string;
  mood: number | null;
  updatedAt: string;
};

export default function StaffSessionPreparations() {
  const { toast } = useToast();
  const [items, setItems] = useState<SharedPreparation[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const result = await customFetch<SharedPreparation[]>("/api/advanced/staff/session-prep", { responseType: "json" });
      setItems(Array.isArray(result) ? result : []);
    } catch (error) {
      toast({ variant: "destructive", title: "Shared session preparation unavailable", description: error instanceof Error ? error.message : "You may not have permission to view shared preparation notes." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Only responses clients explicitly chose to share are shown here.</p><h2 className="mt-1 font-serif text-3xl">Session preparation</h2></div>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />Refresh</Button>
      </div>
      {loading ? <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed p-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading shared notes…</div> : !items.length ? <Card className="rounded-2xl"><CardContent className="p-10 text-center"><ClipboardCheck className="mx-auto h-8 w-8 text-primary/60" /><p className="mt-3 font-semibold">No shared preparations</p><p className="mt-1 text-sm text-muted-foreground">When clients choose to share their pre-session notes, they’ll appear here.</p></CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => <Card key={item.id} className="overflow-hidden rounded-2xl border-primary/15">
          <CardHeader className="bg-gradient-to-r from-primary/[0.06] via-card to-secondary/[0.08]">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.clientName}</CardTitle><CardDescription className="mt-1 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{format(parseISO(item.preferredDate), "EEE, MMM d, yyyy")} · {item.preferredTime}</CardDescription></div><Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" />Client shared</Badge></div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {item.focus && <section><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session focus</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.focus}</p></section>}
            {item.priorities && <section><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What feels important</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.priorities}</p></section>}
            {item.supportPreferences && <section><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Support preferences</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.supportPreferences}</p></section>}
            {item.mood !== null && <p className="rounded-lg bg-muted/40 p-3 text-sm">Client-selected pre-session mood: <strong>{item.mood}/5</strong></p>}
            <p className="border-t pt-3 text-xs text-muted-foreground">Updated {new Date(item.updatedAt).toLocaleString()} · Preparation notes only, not a diagnosis.</p>
          </CardContent>
        </Card>)}
      </div>}
    </div>
  );
}
