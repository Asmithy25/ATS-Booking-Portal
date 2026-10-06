import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { customFetch, useGetSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Bot, ArrowLeft, Send, Sparkles, ShieldAlert, Trash2 } from "lucide-react";
import { getThemeStyle } from "@/lib/theme";

type ChatItem = { role: "user" | "assistant"; body: string };

const STORAGE_KEY = "aws-assistant-conversation";

export default function PublicAssistant() {
  const { data: settings } = useGetSettings();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setMessages(saved.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.body === "string").slice(-30));
    } catch {
      // Ignore invalid local conversation data.
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const value = text.trim();
    if (!value || busy) return;
    const next = [...messages, { role: "user" as const, body: value }];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const result = await customFetch<{ reply: string; name: string }>("/api/advanced/public/assistant", {
        method: "POST",
        body: JSON.stringify({ message: value, history: messages.slice(-12) }),
        responseType: "json",
      });
      setMessages((current) => [...current, { role: "assistant", body: result.reply }]);
    } catch (error: any) {
      const message = error?.data?.error || error?.message || "The assistant is unavailable right now.";
      setMessages((current) => [...current, { role: "assistant", body: "I’m sorry — I’m unavailable right now. " + message }]);
    } finally {
      setBusy(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={getThemeStyle(settings)}>
      <PublicNavbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Aydens Wellness Services
        </Link>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 gap-1.5"><Bot className="h-3.5 w-3.5" /> AI wellness support</Badge>
            <h1 className="font-serif text-5xl font-normal leading-none sm:text-6xl">Aydens Wellness Assistant</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              Meet Aubrey — a supportive AI wellness companion for general wellness questions, reflection prompts, planning, and encouragement. No client portal account is required.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={clearConversation} disabled={!messages.length}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear chat
          </Button>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-primary/15 shadow-xl">
          <CardHeader className="border-b bg-primary/5">
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></span>
              Aydens Wellness Assistant
            </CardTitle>
            <CardDescription>
              Aubrey is AI, not a human therapist. This tool provides general wellness support and is not for emergencies.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="min-h-[430px] max-h-[62vh] space-y-4 overflow-y-auto p-4 sm:p-6">
              {!messages.length && (
                <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-primary/20 bg-primary/[0.03] p-6 text-center">
                  <Sparkles className="mx-auto h-7 w-7 text-primary" />
                  <h2 className="mt-3 font-serif text-2xl">Hi, I’m Aubrey.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Try asking for a journal prompt, a simple weekly wellness routine, help organizing a goal, or an explanation of a wellness topic.</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground" : "max-w-[85%] rounded-2xl rounded-bl-md border bg-muted/50 px-4 py-3 text-sm leading-6"}>
                    {message.role === "assistant" && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Aydens Wellness Assistant</p>}
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                </div>
              ))}
              {busy && <div className="flex justify-start"><div className="rounded-2xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Aubrey is thinking…</div></div>}
              <div ref={endRef} />
            </div>

            <div className="border-t bg-background p-4 sm:p-5">
              <div className="flex gap-3">
                <Textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="What would you like support with?"
                  rows={3}
                  maxLength={4000}
                  className="resize-none"
                  disabled={busy}
                />
                <Button className="self-end" onClick={() => void send()} disabled={busy || !text.trim()}>
                  <Send className="mr-2 h-4 w-4" /> Send
                </Button>
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <p>Do not use this tool for emergencies or to share information you do not want stored in your browser history.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <PublicFooter />
    </div>
  );
}
