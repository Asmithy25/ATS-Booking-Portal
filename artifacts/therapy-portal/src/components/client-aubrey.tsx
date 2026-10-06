import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Send, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { customFetch } from "@workspace/api-client-react";

type AubreyMessage = { id?: number; role: "user" | "assistant"; body: string; createdAt?: string };

const suggestions = [
  "Give me a simple way to reset after a stressful day.",
  "Help me make a realistic self-care plan for this week.",
  "Give me a journaling prompt for today.",
];

export default function ClientAubrey() {
  const [messages, setMessages] = useState<AubreyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const hasConversation = messages.length > 0;
  const canSend = draft.trim().length > 0 && draft.trim().length <= 4000 && !sending;
  const greeting = useMemo(() => "Hi — I’m Aubrey, the Aydens Wellness Assistant. I can help with general wellness ideas, planning, reflection prompts, and encouragement.", []);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    customFetch<AubreyMessage[]>("/api/advanced/client/assistant/history", { method: "GET", responseType: "json" })
      .then((history) => { if (active) setMessages(Array.isArray(history) ? history : []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load Aubrey right now."); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, sending]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setError("");
    setDraft("");
    setSending(true);
    setMessages((current) => [...current, { role: "user", body: message }]);
    try {
      const response = await customFetch<{ reply?: string; name?: string }>("/api/advanced/client/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ message }),
        responseType: "json",
      });
      const reply = String(response?.reply ?? "").trim();
      if (!reply) throw new Error("Aubrey returned an empty response. Please try again.");
      setMessages((current) => [...current, { role: "assistant", body: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aydens Wellness Assistant is unavailable right now.");
    } finally { setSending(false); }
  };

  const clearConversation = () => { setMessages([]); setError(""); };

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/15">
      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><CardTitle>Aydens Wellness Assistant</CardTitle><Badge variant="secondary">Aubrey</Badge></div>
            <CardDescription className="mt-2 max-w-2xl leading-6">A private AI wellness support space for general guidance, planning, reflection, and encouragement.</CardDescription>
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">Aydens Wellness Services information, hours, contact details & public updates</div>
              <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">General wellness guidance, planning, reflection & encouragement</div>
              <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">Booking questions using your confirmation code</div>
              <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">Eligible appointment cancellations & rescheduling</div>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearConversation} disabled={!hasConversation && !error}><RotateCcw className="h-4 w-4" />Clear chat</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="min-h-[360px] max-h-[560px] space-y-4 overflow-y-auto rounded-2xl border border-border/70 bg-background/60 p-4">
          {!hasConversation && !loadingHistory && <div className="mx-auto max-w-xl rounded-2xl border border-primary/15 bg-primary/5 p-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
            <h3 className="mt-3 font-serif text-xl font-semibold">Hi — I’m Aubrey.</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{greeting.replace("Hi — I’m Aubrey. ", "")}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">I’m for general wellness support — not diagnosis, emergency response, or a replacement for professional care.</p>
          </div>}
          {loadingHistory && <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your conversation…</div>}
          {messages.map((message, index) => <div key={(message.id ?? "local") + "-" + index} className={"flex gap-3 " + (message.role === "user" ? "justify-end" : "justify-start")}>
            {message.role === "assistant" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div>}
            <div className={"max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 " + (message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border/70 bg-card text-foreground")}><p className="whitespace-pre-wrap">{message.body}</p></div>
            {message.role === "user" && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/50 text-foreground"><UserRound className="h-4 w-4" /></div>}
          </div>)}
          {sending && <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div><div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Aubrey is thinking…</span></div></div>}
          {error && <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4"><p className="text-sm font-medium text-destructive">Aubrey couldn’t respond.</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{error}</p></div>}
          <div ref={endRef} />
        </div>
        {!hasConversation && !loadingHistory && <div className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" className="rounded-full border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground" onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>}
        <form onSubmit={send} className="space-y-3">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask the Aydens Wellness Assistant…" maxLength={4000} rows={4} className="resize-none rounded-2xl" disabled={sending} />
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">General wellness support only · {draft.length}/4000</p><Button type="submit" className="rounded-xl" disabled={!canSend}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? "Sending…" : "Send to Aubrey"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}