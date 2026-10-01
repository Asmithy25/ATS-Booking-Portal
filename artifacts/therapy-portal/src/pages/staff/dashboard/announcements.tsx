import { useEffect, useState } from 'react';
import { useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch as SwitchComponent } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Save, Upload, Trash2, Archive, RotateCcw, Copy } from 'lucide-react';

type Announcement = {
  id: number;
  title: string;
  body: string;
  audience: 'staff' | 'client';
  active: boolean;
  createdAt: string;
  metadata?: {
    subheading?: string;
    imageUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
    status?: 'draft' | 'published' | 'archived';
    startsAt?: string;
    endsAt?: string;
    showSignature?: boolean;
    signatureName?: string;
    signatureTitle?: string;
    signatureImageUrl?: string;
  };
};

const emptyForm = {
  id: null as number | null, title: '', subheading: '', body: '', audience: 'client' as 'staff' | 'client',
  imageUrl: '', buttonText: '', buttonUrl: '', status: 'published' as 'draft' | 'published' | 'archived',
  startsAt: '', endsAt: '', showSignature: true, signatureName: 'Ayden Smith',
  signatureTitle: 'Founder & CEO of Aydens Wellness Services', signatureImageUrl: '',
};

export default function Announcements() {
  const { data: settings } = useGetSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/portal/announcements?audience=staff', { credentials: 'include' })
    .then((r) => r.ok ? r.json() : [])
    .then((data) => setItems(Array.isArray(data) ? data : []))
    .catch(() => setItems([]));

  useEffect(() => { load(); }, []);

  const setField = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const upload = (key: 'imageUrl' | 'signatureImageUrl') => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast({ variant: 'destructive', title: 'Image is too large', description: 'Maximum upload size is 5 MB.' }); return; }
      const reader = new FileReader();
      reader.onload = () => setField(key, String(reader.result ?? ''));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = {
        title: form.title, body: form.body, audience: form.audience,
        metadata: {
          subheading: form.subheading, imageUrl: form.imageUrl, buttonText: form.buttonText,
          buttonUrl: form.buttonUrl, status: form.status, startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined, showSignature: form.showSignature,
          signatureName: form.signatureName, signatureTitle: form.signatureTitle,
          signatureImageUrl: form.signatureImageUrl,
        },
      };
      const response = await fetch(form.id ? `/api/portal/announcements/${form.id}` : '/api/portal/announcements', {
        method: form.id ? 'PATCH' : 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Could not save announcement.');
      toast({ title: form.id ? 'Announcement updated' : 'Announcement created' });
      setForm(emptyForm); await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save announcement', description: err instanceof Error ? err.message : 'Try again.' });
    } finally { setSaving(false); }
  };

  const edit = (item: Announcement) => setForm({
    ...emptyForm, id: item.id, title: item.title, body: item.body, audience: item.audience,
    subheading: item.metadata?.subheading ?? '', imageUrl: item.metadata?.imageUrl ?? '',
    buttonText: item.metadata?.buttonText ?? '', buttonUrl: item.metadata?.buttonUrl ?? '',
    status: item.metadata?.status ?? (item.active ? 'published' : 'archived'),
    startsAt: item.metadata?.startsAt ?? '', endsAt: item.metadata?.endsAt ?? '',
    showSignature: item.metadata?.showSignature !== false,
    signatureName: item.metadata?.signatureName ?? 'Ayden Smith',
    signatureTitle: item.metadata?.signatureTitle ?? 'Founder & CEO of Aydens Wellness Services',
    signatureImageUrl: item.metadata?.signatureImageUrl ?? '',
  });

  const archive = async (item: Announcement, restore = false) => {
    await fetch(`/api/portal/announcements/${item.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: restore, metadata: { ...(item.metadata ?? {}), status: restore ? 'published' : 'archived' } }),
    });
    await load();
  };

  const duplicate = async (item: Announcement) => {\n    try {\n      const response = await fetch('/api/portal/announcements', {\n        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ title: item.title + ' — Copy', body: item.body, audience: item.audience, metadata: { ...(item.metadata ?? {}), status: 'draft', startsAt: undefined, endsAt: undefined } }),\n      });\n      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Could not duplicate announcement.');\n      toast({ title: 'Announcement duplicated', description: 'The copy was saved as a draft.' });\n      await load();\n    } catch (err) {\n      toast({ variant: 'destructive', title: 'Could not duplicate announcement', description: err instanceof Error ? err.message : 'Try again.' });\n    }\n  };\n\n  const remove = async (item: Announcement) => {
    if (!window.confirm('Delete this announcement permanently?')) return;
    await fetch(`/api/portal/announcements/${item.id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  };

  return <div className="space-y-7 max-w-6xl">
    <div><p className="text-sm text-muted-foreground">Public homepage communications</p><h1 className="text-3xl font-semibold">Announcements</h1><p className="mt-2 text-muted-foreground">Create, schedule, publish, archive, edit, and remove homepage announcements. Published announcements automatically use the current site logo in the public presentation.</p></div>
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> {form.id ? 'Edit announcement' : 'Create announcement'}</CardTitle><CardDescription>Everything below is optional except the heading and message.</CardDescription></CardHeader>
        <CardContent><form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>Audience</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.audience} onChange={(e) => setField('audience', e.target.value)}><option value="client">Homepage / Clients</option><option value="staff">Staff only</option></select></div><div><Label>Status</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div></div>
          <div><Label>Heading</Label><Input className="mt-2" value={form.title} onChange={(e) => setField('title', e.target.value)} required /></div>
          <div><Label>Subheading</Label><Input className="mt-2" value={form.subheading} onChange={(e) => setField('subheading', e.target.value)} /></div>
          <div><Label>Description / body</Label><Textarea className="mt-2 min-h-28" value={form.body} onChange={(e) => setField('body', e.target.value)} required /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Image URL</Label><Input className="mt-2" value={form.imageUrl} onChange={(e) => setField('imageUrl', e.target.value)} /><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => upload('imageUrl')}><Upload className="mr-2 h-4 w-4" /> Upload image</Button></div><div><Label>Button text</Label><Input className="mt-2" value={form.buttonText} onChange={(e) => setField('buttonText', e.target.value)} /><Label className="mt-3 block">Button destination</Label><Input className="mt-2" value={form.buttonUrl} onChange={(e) => setField('buttonUrl', e.target.value)} placeholder="/booking" /></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><Label>Start date/time</Label><Input className="mt-2" type="datetime-local" value={form.startsAt} onChange={(e) => setField('startsAt', e.target.value)} /></div><div><Label>End date/time</Label><Input className="mt-2" type="datetime-local" value={form.endsAt} onChange={(e) => setField('endsAt', e.target.value)} /></div></div>
          <div className="rounded-xl border bg-background p-4 space-y-4"><div className="flex items-center justify-between"><div><Label>Founder signature</Label><p className="text-xs text-muted-foreground">Show your name, title, and optional actual signature image.</p></div><SwitchComponent checked={form.showSignature} onCheckedChange={(v) => setField('showSignature', v)} /></div>{form.showSignature && <><Input value={form.signatureName} onChange={(e) => setField('signatureName', e.target.value)} placeholder="Ayden Smith" /><Input value={form.signatureTitle} onChange={(e) => setField('signatureTitle', e.target.value)} placeholder="Founder & CEO of Aydens Wellness Services" /><Input value={form.signatureImageUrl} onChange={(e) => setField('signatureImageUrl', e.target.value)} placeholder="Signature image URL" /><Button type="button" variant="outline" size="sm" onClick={() => upload('signatureImageUrl')}><Upload className="mr-2 h-4 w-4" /> Upload signature</Button></>}</div>
          <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Current site logo: <span className="font-medium text-foreground">{settings?.siteName ?? 'Aydens Wellness Services'}</span>. The public announcement footer uses the current logo automatically.</div>
          <div className="flex gap-2"><Button disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create announcement'}</Button>{form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>Cancel edit</Button>}</div>
        </form></CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Live preview</CardTitle><CardDescription>Preview the announcement before publishing it.</CardDescription></CardHeader><CardContent>{form.title || form.body || form.imageUrl ? <article className="rounded-2xl border bg-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="flex-1">{form.subheading && <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{form.subheading}</p>}<h2 className="mt-1 font-serif text-2xl font-bold">{form.title || "Announcement heading"}</h2><p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{form.body || "Announcement body"}</p>{form.showSignature && <div className="mt-4 border-t pt-3"><p className="font-serif italic">{form.signatureName || "Ayden Smith"}</p><p className="text-xs text-muted-foreground">{form.signatureTitle || "Founder & CEO of Aydens Wellness Services"}</p></div>}</div>{form.imageUrl && <img src={form.imageUrl} alt="" className="h-24 w-24 rounded-2xl object-cover" />}</div>{form.buttonText && form.buttonUrl && <a href={form.buttonUrl} className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">{form.buttonText}</a>}</article> : <p className="text-sm text-muted-foreground">Start typing to preview the announcement.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Announcement library</CardTitle></CardHeader><CardContent className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.audience}</Badge><Badge variant={item.metadata?.status === 'published' ? 'default' : 'secondary'}>{item.metadata?.status ?? (item.active ? 'published' : 'archived')}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{item.body}</p></div>{item.metadata?.imageUrl && <img src={item.metadata.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}</div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button><Button size="sm" variant="outline" onClick={() => duplicate(item)}><Copy className="mr-1 h-4 w-4" /> Duplicate</Button>{item.active ? <Button size="sm" variant="outline" onClick={() => archive(item)}><Archive className="mr-1 h-4 w-4" /> Archive</Button> : <Button size="sm" variant="outline" onClick={() => archive(item, true)}><RotateCcw className="mr-1 h-4 w-4" /> Restore</Button>}<Button size="sm" variant="destructive" onClick={() => remove(item)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button></div></div>)}{!items.length && <p className="text-sm text-muted-foreground">No announcements yet.</p>}</CardContent></Card>
    </div>
  </div>;
}
