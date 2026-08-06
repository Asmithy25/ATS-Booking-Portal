import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMessageTemplatesQueryKey, useMessageTemplates, useUpdateMessageTemplate } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, Save } from 'lucide-react';

export default function MessageTemplates() {
  const { data = [], isLoading, error } = useMessageTemplates();
  const [drafts, setDrafts] = useState<Record<string, { label: string; subject: string; body: string }>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateMessageTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMessageTemplatesQueryKey() });
        toast({ title: 'Message template saved' });
      },
      onError: (err) => toast({ variant: 'destructive', title: 'Could not save template', description: (err as any)?.data?.error ?? 'Please try again.' }),
    },
  });
  const valueFor = (item: typeof data[number]) => drafts[item.key] ?? { label: item.label, subject: item.subject, body: item.body };
  return <div className="space-y-7">
    <div><p className="text-sm text-muted-foreground">Client communication</p><h1 className="text-3xl font-semibold">Message templates</h1><p className="mt-2 text-muted-foreground">Customize confirmations, reminders, starting-soon notices, cancellations, and business updates.</p></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : error ? <Card className="rounded-2xl"><CardContent className="p-6 text-destructive">Message templates are unavailable for your account.</CardContent></Card> : data.length ? <div className="grid gap-5 lg:grid-cols-2">{data.map((item) => { const value = valueFor(item); return <Card key={item.key} className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />{value.label}</CardTitle><CardDescription>Use <code className="rounded bg-muted px-1">{'{{clientName}}'}</code>, <code className="rounded bg-muted px-1">{'{{date}}'}</code>, and <code className="rounded bg-muted px-1">{'{{time}}'}</code> for personalized messages.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Subject</Label><Input value={value.subject} onChange={(e) => setDrafts({ ...drafts, [item.key]: { ...value, subject: e.target.value } })} /></div><div className="space-y-2"><Label>Message</Label><Textarea className="min-h-32" value={value.body} onChange={(e) => setDrafts({ ...drafts, [item.key]: { ...value, body: e.target.value } })} /></div><Button disabled={update.isPending} onClick={() => update.mutate({ key: item.key, data: { label: value.label, subject: value.subject, body: value.body } })}><Save className="h-4 w-4" /> Save template</Button></CardContent></Card>; })}</div> : <Card className="rounded-2xl"><CardContent className="p-6 text-sm text-muted-foreground">Templates will appear here after they are initialized.</CardContent></Card>}
  </div>;
}