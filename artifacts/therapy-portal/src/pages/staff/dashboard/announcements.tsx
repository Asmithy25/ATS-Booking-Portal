import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch as SwitchComponent } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Copy, Eye, Loader2, Megaphone, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';

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
    category?: string;
  };
};

const CATEGORIES = ['General', 'Practice Update', 'Scheduling', 'Wellness', 'Community', 'Important'];

const emptyForm = {
  id: null as number | null,
  title: '',
  subheading: '',
  body: '',
  audience: 'client' as 'staff' | 'client',
  category: 'General',
  imageUrl: '',
  buttonText: '',
  buttonUrl: '',
  status: 'published' as 'draft' | 'published' | 'archived',
  startsAt: '',
  endsAt: '',
  showSignature: true,
  signatureName: 'Ayden Smith',
  signatureTitle: 'Founder & CEO of Aydens Wellness Services',
  signatureImageUrl: '',
};

function localDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm");
}

function isoDateTime(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function statusFor(item: Announcement) {
  if (!item.active || item.metadata?.status === 'archived') return 'archived';
  if (item.metadata?.status === 'draft') return 'draft';
  return 'published';
}

function scheduleDate(item: Announcement) {
  return item.metadata?.startsAt ? parseISO(item.metadata.startsAt) : new Date(item.createdAt);
}

export default function Announcements() {
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const load = async () => {
    setLoadingItems(true);
    try {
      const data = await customFetch<Announcement[]>('/api/portal/announcements?audience=all');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load announcement library', description: err instanceof Error ? err.message : 'Please refresh and try again.' });
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setField = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => setForm(emptyForm);

  const upload = (key: 'imageUrl' | 'signatureImageUrl') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Image is too large', description: 'Maximum upload size is 5 MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setField(key, String(reader.result ?? ''));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const edit = (item: Announcement) => setForm({
    id: item.id,
    title: item.title,
    subheading: item.metadata?.subheading ?? '',
    body: item.body,
    audience: item.audience,
    category: item.metadata?.category ?? 'General',
    imageUrl: item.metadata?.imageUrl ?? '',
    buttonText: item.metadata?.buttonText ?? '',
    buttonUrl: item.metadata?.buttonUrl ?? '',
    status: statusFor(item) as 'draft' | 'published' | 'archived',
    startsAt: localDateTime(item.metadata?.startsAt),
    endsAt: localDateTime(item.metadata?.endsAt),
    showSignature: item.metadata?.showSignature !== false,
    signatureName: item.metadata?.signatureName ?? 'Ayden Smith',
    signatureTitle: item.metadata?.signatureTitle ?? 'Founder & CEO of Aydens Wellness Services',
    signatureImageUrl: item.metadata?.signatureImageUrl ?? '',
  });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast({ variant: 'destructive', title: 'Add a heading and message first' });
      return;
    }
    if (form.endsAt && form.startsAt && new Date(form.endsAt).getTime() < new Date(form.startsAt).getTime()) {
      toast({ variant: 'destructive', title: 'Check the schedule', description: 'The end time must be after the start time.' });
      return;
    }
    setSaving(true);
    const metadata = {
      subheading: form.subheading.trim(),
      category: form.category,
      imageUrl: form.imageUrl,
      buttonText: form.buttonText.trim(),
      buttonUrl: form.buttonUrl.trim(),
      status: form.status,
      startsAt: isoDateTime(form.startsAt),
      endsAt: isoDateTime(form.endsAt),
      showSignature: form.showSignature,
      signatureName: form.signatureName.trim(),
      signatureTitle: form.signatureTitle.trim(),
      signatureImageUrl: form.signatureImageUrl,
    };
    try {
      const saved = form.id
        ? await customFetch<Announcement>('/api/portal/announcements/' + form.id, { method: 'PATCH', body: JSON.stringify({ title: form.title, body: form.body, audience: form.audience, metadata, active: form.status !== 'archived' }) })
        : await customFetch<Announcement>('/api/portal/announcements', { method: 'POST', body: JSON.stringify({ title: form.title, body: form.body, audience: form.audience, metadata }) });
      setItems((current) => form.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      toast({ title: form.id ? 'Announcement updated' : 'Announcement saved', description: form.status === 'draft' ? 'Saved as a draft.' : form.status === 'archived' ? 'Saved to the archive.' : 'The announcement is ready.' });
      reset();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save announcement', description: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (item: Announcement) => {
    try {
      const saved = await customFetch<Announcement>('/api/portal/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: item.title + ' (Copy)', body: item.body, audience: item.audience, metadata: { ...(item.metadata ?? {}), status: 'draft' } }),
      });
      setItems((current) => [saved, ...current]);
      toast({ title: 'Draft duplicated' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not duplicate announcement', description: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  const toggleArchive = async (item: Announcement, restore = false) => {
    try {
      const metadata = { ...(item.metadata ?? {}), status: restore ? 'published' : 'archived' };
      const saved = await customFetch<Announcement>('/api/portal/announcements/' + item.id, { method: 'PATCH', body: JSON.stringify({ metadata, active: restore }) });
      setItems((current) => current.map((entry) => entry.id === item.id ? saved : entry));
      toast({ title: restore ? 'Announcement restored' : 'Announcement archived' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not update announcement', description: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  const remove = async (item: Announcement) => {
    if (!window.confirm('Delete “' + item.title + '” permanently? This cannot be undone.')) return;
    try {
      await customFetch('/api/portal/announcements/' + item.id, { method: 'DELETE' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (form.id === item.id) reset();
      toast({ title: 'Announcement deleted' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not delete announcement', description: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  const filtered = useMemo(() => items.filter((item) => {
    const categoryOk = categoryFilter === 'all' || (item.metadata?.category ?? 'General') === categoryFilter;
    const statusOk = statusFilter === 'all' || statusFor(item) === statusFilter;
    return categoryOk && statusOk;
  }), [items, categoryFilter, statusFilter]);

  const monthDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
  }), [calendarMonth]);

  const goMonth = (amount: number) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  return (
    <div className="space-y-7 max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Publish, schedule, organize, and review practice updates.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Megaphone className="h-6 w-6 text-primary" /> Announcements</h1></div>
        <Badge variant="secondary">{items.length} total</Badge>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>{form.id ? 'Modify announcement' : 'Create announcement'}</CardTitle><CardDescription>Client updates can be categorized and scheduled without changing the rest of the site.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Heading</Label><Input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="A small practice update" /></div>
                <div className="space-y-2"><Label>Category</Label><Select value={form.category} onValueChange={(value) => setField('category', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Audience</Label><Select value={form.audience} onValueChange={(value) => setField('audience', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="client">Homepage / Clients</SelectItem><SelectItem value="staff">Staff only</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Publication status</Label><Select value={form.status} onValueChange={(value) => setField('status', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
                <div className="flex items-center gap-3 pt-7"><SwitchComponent checked={form.showSignature} onCheckedChange={(checked) => setField('showSignature', checked)} id="announcement-signature" /><Label htmlFor="announcement-signature">Founder signature</Label></div>
              </div>
              <div className="space-y-2"><Label>Subheading</Label><Input value={form.subheading} onChange={(e) => setField('subheading', e.target.value)} placeholder="Practice Update" /></div>
              <div className="space-y-2"><Label>Message</Label><Textarea value={form.body} onChange={(e) => setField('body', e.target.value)} className="min-h-32" placeholder="Write the update here…" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Starts</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setField('startsAt', e.target.value)} /></div>
                <div className="space-y-2"><Label>Ends</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setField('endsAt', e.target.value)} /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Button text</Label><Input value={form.buttonText} onChange={(e) => setField('buttonText', e.target.value)} placeholder="Learn more" /></div>
                <div className="space-y-2"><Label>Button URL</Label><Input value={form.buttonUrl} onChange={(e) => setField('buttonUrl', e.target.value)} placeholder="/booking" /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Announcement image</Label><div className="flex gap-2"><Input value={form.imageUrl} onChange={(e) => setField('imageUrl', e.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={() => upload('imageUrl')}><Upload className="mr-2 h-4 w-4" />Upload</Button></div></div>
                <div className="space-y-2"><Label>Signature image</Label><div className="flex gap-2"><Input value={form.signatureImageUrl} onChange={(e) => setField('signatureImageUrl', e.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={() => upload('signatureImageUrl')}><Upload className="mr-2 h-4 w-4" />Upload</Button></div></div>
              </div>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="h-28 w-full rounded-2xl object-cover" />}
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : form.id ? 'Save changes' : 'Create announcement'}</Button>{form.id && <Button type="button" variant="outline" onClick={reset}>Cancel edit</Button>}</div>
            </form>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Live preview</CardTitle><CardDescription>See the announcement the way clients will read it.</CardDescription></CardHeader>
          <CardContent>
            <article className="rounded-2xl border bg-background p-5">
              <Badge variant="outline">{form.category}</Badge>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[.2em] text-primary">{form.subheading || 'Practice Update'}</p>
              <h2 className="mt-1 font-serif text-2xl font-bold">{form.title || 'Announcement heading'}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{form.body || 'Announcement message'}</p>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-4 h-40 w-full rounded-2xl object-cover" />}
              {form.showSignature && <div className="mt-5 border-t pt-4"><p className="font-serif italic">{form.signatureName || 'Ayden Smith'}</p><p className="text-xs text-muted-foreground">{form.signatureTitle || 'Founder & CEO of Aydens Wellness Services'}</p></div>}
              {form.buttonText && form.buttonUrl && <span className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{form.buttonText}</span>}
            </article>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Announcement calendar</CardTitle><CardDescription>Scheduled announcements appear on the date they begin.</CardDescription></div>
          <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button><div className="min-w-32 text-center font-serif text-lg">{format(calendarMonth, 'MMMM yyyy')}</div><Button variant="outline" size="icon" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 border-l border-t">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="border-b border-r bg-muted/40 p-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{day}</div>)}
            {monthDays.map((day) => {
              const dayItems = filtered.filter((item) => isSameDay(scheduleDate(item), day));
              return <div key={day.toISOString()} className={['min-h-24 border-b border-r p-2 align-top', !isSameMonth(day, calendarMonth) ? 'bg-muted/20 opacity-60' : ''].join(' ')}>
                <p className={['text-xs font-semibold', isSameDay(day, new Date()) ? 'text-primary' : ''].join(' ')}>{format(day, 'd')}</p>
                <div className="mt-2 space-y-1">{dayItems.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => edit(item)} className="block w-full truncate rounded-md bg-primary/10 px-2 py-1 text-left text-[10px] font-medium text-primary">{item.title}</button>)}{dayItems.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</p>}</div>
              </div>;
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Announcement library</CardTitle><CardDescription>Filter by category or publication state. Modify, duplicate, archive, restore, or delete right here.</CardDescription></div><div className="flex flex-wrap gap-2"><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div></div></CardHeader>
        <CardContent className="space-y-3">
          {loadingItems ? <div className="flex items-center justify-center py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading announcements…</div> : filtered.length ? filtered.map((item) => <div key={item.id} className="rounded-2xl border bg-background p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.metadata?.category ?? 'General'}</Badge><Badge variant={statusFor(item) === 'published' ? 'default' : 'secondary'}>{statusFor(item)}</Badge><Badge variant="outline">{item.audience === 'client' ? 'Clients' : 'Staff'}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p>{item.metadata?.startsAt && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Starts {new Date(item.metadata.startsAt).toLocaleString()}</p>}</div>{item.metadata?.imageUrl && <img src={item.metadata.imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />}</div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => edit(item)}>Modify</Button><Button size="sm" variant="outline" onClick={() => duplicate(item)}><Copy className="mr-1 h-4 w-4" />Duplicate</Button>{item.active ? <Button size="sm" variant="outline" onClick={() => toggleArchive(item)}><Archive className="mr-1 h-4 w-4" />Archive</Button> : <Button size="sm" variant="outline" onClick={() => toggleArchive(item, true)}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>}<Button size="sm" variant="destructive" onClick={() => remove(item)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></div></div>) : <p className="rounded-2xl bg-muted/30 p-8 text-center text-sm text-muted-foreground">No announcements match those filters.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
