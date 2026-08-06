import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getClientTemplatesQueryKey, useClientTemplates, useUpdateClientTemplate } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, Save } from 'lucide-react';

export default function ClientTemplates() {
  const { data = [], isLoading, error } = useClientTemplates();
  const [drafts, setDrafts] = useState<Record<string, { label: string; body: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateClientTemplate({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getClientTemplatesQueryKey() }); toast({ title: 'Client template saved' }); } } });
  const copy = async (key: string, body: string) => {
    await navigator.clipboard.writeText(body);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
  };
  return <div className="space-y-7"><div><p className="text-sm text-muted-foreground">Standalone copy library</p><h1 className="text-3xl font-semibold">Client Templates</h1><p className="mt-2 text-muted-foreground">Maintain copy-and-paste resources for client care. These templates are separate from Support and are never sent automatically.</p></div>{isLoading ? <p className="text-sm text-muted-foreground">Loading client templates…</p> : error ? <Card><CardContent className="p-6 text-destructive">Client Templates are unavailable for your account.</CardContent></Card> : <div className="grid gap-5 lg:grid-cols-2">{data.map((item) => { const value = drafts[item.key] ?? { label: item.label, body: item.body }; return <Card key={item.key} className="rounded-2xl"><CardHeader><CardTitle>{value.label}</CardTitle><CardDescription>Copy this text into a note, document, or external message.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Label</Label><Input value={value.label} onChange={(e) => setDrafts({ ...drafts, [item.key]: { ...value, label: e.target.value } })} /></div><div className="space-y-2"><Label>Copyable text</Label><Textarea className="min-h-36" value={value.body} onChange={(e) => setDrafts({ ...drafts, [item.key]: { ...value, body: e.target.value } })} /></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => copy(item.key, value.body)}><Copy className="h-4 w-4" /> {copied === item.key ? 'Copied' : 'Copy text'}</Button><Button type="button" disabled={update.isPending} onClick={() => update.mutate({ key: item.key, data: { label: value.label, body: value.body } })}><Save className="h-4 w-4" /> Save template</Button></div></CardContent></Card>; })}</div>}</div>;
}