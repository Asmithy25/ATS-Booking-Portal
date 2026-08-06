import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStaffSupportQueryKey, useMessageTemplates, useReplyToSupport, useStaffSupport, useUpdateStaffSupportStatus } from '@workspace/api-client-react';
import type { MessageTemplate, SupportThread } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, MessageCircle, Send, RotateCcw, WandSparkles } from 'lucide-react';

function applyTemplate(template: MessageTemplate, thread: SupportThread) {
  const values = {
    clientName: thread.clientName ?? "there",
    date: thread.preferredDate ?? "your requested date",
    time: thread.preferredTime ?? "your requested time",
  };
  const replace = (value: string) => value.replace(/\{\{\s*(clientName|date|time)\s*\}\}/g, (_, key: keyof typeof values) => values[key]);
  return `${replace(template.subject)}\n\n${replace(template.body)}`;
}

export default function Support() {
  const { data = [], isLoading, error } = useStaffSupport();
  const { data: templates = [] } = useMessageTemplates();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();
  const reply = useReplyToSupport({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getStaffSupportQueryKey() }); } } });
  const updateStatus = useUpdateStaffSupportStatus({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getStaffSupportQueryKey() }),
    },
  });
  const templateOptions = useMemo(() => templates.filter((template) => template.body.trim()), [templates]);
  const chooseTemplate = (thread: SupportThread, key: string) => {
    setSelectedTemplates((current) => ({ ...current, [thread.id]: key }));
    const template = templateOptions.find((item) => item.key === key);
    if (template) setDrafts((current) => ({ ...current, [thread.id]: applyTemplate(template, thread) }));
  };
  return <div className="space-y-7"><div><p className="text-sm text-muted-foreground">Client care</p><h1 className="text-3xl font-semibold">Support inbox</h1><p className="mt-2 text-muted-foreground">Reply to client questions, close resolved threads, and use your saved templates when a consistent response helps.</p></div><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Client threads</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading support threads…</p> : error ? <p className="text-sm text-destructive">Support inbox is unavailable for your account.</p> : data.length ? <div className="space-y-5">{data.map((thread) => <div key={thread.id} className={`rounded-2xl border p-4 ${thread.status === 'closed' ? 'border-border/60 bg-muted/25' : 'border-primary/20 bg-card'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{thread.subject}</p><p className="text-xs text-muted-foreground">{thread.clientName ?? 'Client'} · {new Date(thread.updatedAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><Badge className={thread.status === 'closed' ? 'border-0 bg-muted text-muted-foreground' : 'border-0 bg-[#E6C27A]/35 text-[#664A22] dark:bg-[#9A7535]/35 dark:text-[#F3D99A]'}>{thread.status}</Badge><Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: thread.id, status: thread.status === 'closed' ? 'open' : 'closed' })}>{thread.status === 'closed' ? <><RotateCcw className="h-3.5 w-3.5" /> Reopen</> : <><Check className="h-3.5 w-3.5" /> Close</>}</Button></div></div><div className="my-4 space-y-2">{thread.messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.senderType === 'staff' ? 'ml-4 bg-primary/10' : 'mr-4 bg-muted'}`}><p className="mb-1 text-xs font-medium text-muted-foreground">{message.senderName}</p>{message.body}</div>)}</div><div className="space-y-2"><div className="flex flex-col gap-2 sm:flex-row"><Select value={selectedTemplates[thread.id] ?? ''} onValueChange={(key) => chooseTemplate(thread, key)} disabled={thread.status === 'closed' || !templateOptions.length}><SelectTrigger className="sm:max-w-xs"><WandSparkles className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder={templateOptions.length ? 'Use a message template…' : 'No templates available'} /></SelectTrigger><SelectContent>{templateOptions.map((template) => <SelectItem key={template.key} value={template.key}>{template.label}</SelectItem>)}</SelectContent></Select><p className="self-center text-xs text-muted-foreground">You can edit the inserted message before sending.</p></div><div className="flex gap-2"><Textarea value={drafts[thread.id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [thread.id]: e.target.value })} placeholder={thread.status === 'closed' ? 'Reopen the thread to reply…' : 'Write a thoughtful reply…'} disabled={thread.status === 'closed'} /><Button className="self-end" disabled={thread.status === 'closed' || !drafts[thread.id]?.trim() || reply.isPending} onClick={() => { reply.mutate({ id: thread.id, body: drafts[thread.id] }); setDrafts({ ...drafts, [thread.id]: '' }); setSelectedTemplates({ ...selectedTemplates, [thread.id]: '' }); }}><Send className="h-4 w-4" /></Button></div></div></div>)}</div> : <p className="py-6 text-sm text-muted-foreground">No client support threads yet.</p>}</CardContent></Card></div>;
}