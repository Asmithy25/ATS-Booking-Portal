import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getClientAnnouncementsQueryKey, useAnnouncements, useCreateAnnouncement } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Send } from 'lucide-react';

export default function Announcements() {
  const [form, setForm] = useState({ title: '', body: '', audience: 'staff' as 'staff' | 'client' });
  const { data = [] } = useAnnouncements('staff');
  const { data: clientAnnouncements = [] } = useAnnouncements('client');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const create = useCreateAnnouncement({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getClientAnnouncementsQueryKey() }); setForm({ title: '', body: '', audience: 'staff' }); toast({ title: 'Announcement published' }); }, onError: (error) => toast({ variant: 'destructive', title: 'Could not publish', description: (error as any)?.data?.error ?? 'Please try again.' }) } });
  return <div className="space-y-7"><div><p className="text-sm text-muted-foreground">Keep the practice connected</p><h1 className="text-3xl font-semibold">Announcements</h1><p className="mt-2 text-muted-foreground">Share updates with staff or clients. Staff announcements stay private to the team.</p></div><div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Publish an update</CardTitle><CardDescription>Managers and the founder can publish announcements.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}><div className="space-y-2"><Label>Audience</Label><div className="flex gap-2">{(['staff', 'client'] as const).map((audience) => <button type="button" key={audience} onClick={() => setForm({ ...form, audience })} className={`rounded-xl border px-4 py-2 text-sm capitalize ${form.audience === audience ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{audience}</button>)}</div></div><div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div><div className="space-y-2"><Label>Message</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></div><Button disabled={create.isPending}><Send className="h-4 w-4" /> Publish announcement</Button></form></CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle>Published updates</CardTitle></CardHeader><CardContent className="space-y-3">{[...data, ...clientAnnouncements].map((item) => <div key={`${item.audience}-${item.id}`} className="rounded-2xl border p-4"><div className="mb-2 flex items-center justify-between gap-3"><p className="font-medium">{item.title}</p><Badge variant={item.audience === 'staff' ? 'secondary' : 'outline'}>{item.audience}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{item.body}</p><p className="mt-3 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p></div>)}{!data.length && !clientAnnouncements.length && <p className="text-sm text-muted-foreground">No announcements yet.</p>}</CardContent></Card></div></div>;
}