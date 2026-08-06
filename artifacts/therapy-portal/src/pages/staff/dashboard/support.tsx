import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStaffSupportQueryKey, useReplyToSupport, useStaffSupport } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send } from 'lucide-react';

export default function Support() {
  const { data = [], isLoading, error } = useStaffSupport();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();
  const reply = useReplyToSupport({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getStaffSupportQueryKey() }); } } });
  return <div className="space-y-7"><div><p className="text-sm text-muted-foreground">Client care</p><h1 className="text-3xl font-semibold">Support inbox</h1><p className="mt-2 text-muted-foreground">Reply to client questions and keep the care conversation moving.</p></div><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Client threads</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Loading support threads…</p> : error ? <p className="text-sm text-destructive">Support inbox is unavailable for your account.</p> : data.length ? <div className="space-y-5">{data.map((thread) => <div key={thread.id} className="rounded-2xl border p-4"><div className="flex items-center justify-between"><div><p className="font-medium">{thread.subject}</p><p className="text-xs text-muted-foreground">{new Date(thread.updatedAt).toLocaleString()}</p></div><Badge variant="outline">{thread.status}</Badge></div><div className="my-4 space-y-2">{thread.messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.senderType === 'staff' ? 'ml-4 bg-primary/10' : 'mr-4 bg-muted'}`}><p className="mb-1 text-xs font-medium text-muted-foreground">{message.senderName}</p>{message.body}</div>)}</div><div className="flex gap-2"><Textarea value={drafts[thread.id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [thread.id]: e.target.value })} placeholder="Write a thoughtful reply…" /><Button className="self-end" disabled={!drafts[thread.id]?.trim() || reply.isPending} onClick={() => { reply.mutate({ id: thread.id, body: drafts[thread.id] }); setDrafts({ ...drafts, [thread.id]: '' }); }}><Send className="h-4 w-4" /></Button></div></div>)}</div> : <p className="py-6 text-sm text-muted-foreground">No client support threads yet.</p>}</CardContent></Card></div>;
}