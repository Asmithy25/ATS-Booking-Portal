import { useEffect, useState, type FormEvent } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Leaf, Save, Sparkles, Trash2 } from 'lucide-react';
import { Switch as SwitchComponent } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ControlState = {
  practiceStatus: { mode: string; title: string; detail: string; label: string; tone: string };
  seasonal: { mode: string; season: string; intensity: string; enabled: boolean };
  experience: { enabled: boolean; voice: string; greeting: string; quietMessage: string; savedMessage: string; errorMessage: string };
};
type Schedule = { id: number; name: string; mode: string; title: string; detail: string; label: string; startsAt: string; endsAt: string; createdBy: string };

const initial: ControlState = {
  practiceStatus: { mode: 'auto', title: 'We’re here when you’re ready', detail: 'Phone consultations are currently open for new requests.', label: 'Accepting new requests', tone: 'soft' },
  seasonal: { mode: 'auto', season: 'fall', intensity: 'subtle', enabled: true },
  experience: { enabled: true, voice: 'warm', greeting: 'Welcome back. Let’s take today one step at a time.', quietMessage: 'You’re all caught up.', savedMessage: 'Saved — your Aydens workspace is in sync.', errorMessage: 'Something wandered off. Your information is still safe.' },
};

export default function PracticeControl() {
  const { toast } = useToast();
  const [control, setControl] = useState<ControlState>(initial);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schedule, setSchedule] = useState({ name: '', mode: 'limited', title: 'We’re here when you’re ready', detail: '', label: 'Limited availability', startsAt: '', endsAt: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [settings, list] = await Promise.all([
        customFetch<ControlState>('/api/workspace/practice-settings'),
        customFetch<Schedule[]>('/api/workspace/practice-schedules'),
      ]);
      setControl(settings);
      setSchedules(Array.isArray(list) ? list : []);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load practice controls', description: err instanceof Error ? err.message : 'Please refresh.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await customFetch('/api/workspace/practice-settings', { method: 'PUT', body: JSON.stringify(control) });
      toast({ title: 'Practice controls saved', description: control.experience.savedMessage });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save practice controls', description: err instanceof Error ? err.message : 'Please try again.' });
    } finally { setSaving(false); }
  };

  const addSchedule = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await customFetch<Schedule>('/api/workspace/practice-schedules', { method: 'POST', body: JSON.stringify(schedule) });
      setSchedules((items) => [...items, created]);
      setSchedule({ name: '', mode: 'limited', title: 'We’re here when you’re ready', detail: '', label: 'Limited availability', startsAt: '', endsAt: '' });
      toast({ title: 'Practice mode scheduled' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not schedule mode', description: err instanceof Error ? err.message : 'Check the start and end times.' });
    }
  };

  const deleteSchedule = async (id: number) => {
    try {
      await customFetch('/api/workspace/practice-schedules/' + id, { method: 'DELETE' });
      setSchedules((items) => items.filter((item) => item.id !== id));
    } catch { toast({ variant: 'destructive', title: 'Could not remove schedule' }); }
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading practice controls…</div>;

  return (
    <div className="space-y-7">
      <div><p className="text-sm text-muted-foreground">The obvious home for anything that changes how Aydens presents itself today.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Leaf className="h-6 w-6 text-primary" /> Practice control</h1><p className="mt-2 max-w-2xl text-muted-foreground">Customize the public status, seasonal feel, and little Aydens touches — then schedule temporary modes when you need them.</p></div>

      <Card className="rounded-2xl border-primary/15">
        <CardHeader><CardTitle>Public practice status</CardTitle><CardDescription>This is the “cute little status situation” visitors see on the homepage.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Status mode</Label><Select value={control.practiceStatus.mode} onValueChange={(value) => setControl((c) => ({ ...c, practiceStatus: { ...c.practiceStatus, mode: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Automatic from practice settings</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="limited">Limited availability</SelectItem><SelectItem value="high_demand">High demand</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Tone</Label><Select value={control.practiceStatus.tone} onValueChange={(value) => setControl((c) => ({ ...c, practiceStatus: { ...c.practiceStatus, tone: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Soft</SelectItem><SelectItem value="warm">Warm</SelectItem><SelectItem value="quiet">Quiet</SelectItem><SelectItem value="bright">Bright</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Headline</Label><Input value={control.practiceStatus.title} onChange={(e) => setControl((c) => ({ ...c, practiceStatus: { ...c.practiceStatus, title: e.target.value } }))} /></div><div className="space-y-2"><Label>Status pill</Label><Input value={control.practiceStatus.label} onChange={(e) => setControl((c) => ({ ...c, practiceStatus: { ...c.practiceStatus, label: e.target.value } }))} /></div></div>
          <div className="space-y-2"><Label>Supporting message</Label><Input value={control.practiceStatus.detail} onChange={(e) => setControl((c) => ({ ...c, practiceStatus: { ...c.practiceStatus, detail: e.target.value } }))} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Seasonal experience</CardTitle><CardDescription>Keep seasonal touches subtle, warm, or festive — without changing the core identity.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-medium">Seasonal touches</p><p className="text-xs text-muted-foreground">Allow the public experience to carry seasonal details.</p></div><SwitchComponent checked={control.seasonal.enabled} onCheckedChange={(checked) => setControl((c) => ({ ...c, seasonal: { ...c.seasonal, enabled: checked } }))} /></div>
            <div className="space-y-2"><Label>Season mode</Label><Select value={control.seasonal.mode} onValueChange={(value) => setControl((c) => ({ ...c, seasonal: { ...c.seasonal, mode: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Automatic</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Season</Label><Select disabled={control.seasonal.mode !== 'manual'} value={control.seasonal.season} onValueChange={(value) => setControl((c) => ({ ...c, seasonal: { ...c.seasonal, season: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="spring">Spring</SelectItem><SelectItem value="summer">Summer</SelectItem><SelectItem value="fall">Fall</SelectItem><SelectItem value="halloween">Halloween</SelectItem><SelectItem value="winter">Winter</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Intensity</Label><Select value={control.seasonal.intensity} onValueChange={(value) => setControl((c) => ({ ...c, seasonal: { ...c.seasonal, intensity: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subtle">Subtle</SelectItem><SelectItem value="warm">Warm</SelectItem><SelectItem value="festive">Festive</SelectItem></SelectContent></Select></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle>16 · Aydens Experience</CardTitle><CardDescription>Your microcopy layer for little moments across the platform.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-medium">Experience layer</p><p className="text-xs text-muted-foreground">Use Aydens-specific helper messages and empty states.</p></div><SwitchComponent checked={control.experience.enabled} onCheckedChange={(checked) => setControl((c) => ({ ...c, experience: { ...c.experience, enabled: checked } }))} /></div>
            <div className="space-y-2"><Label>Voice</Label><Select value={control.experience.voice} onValueChange={(value) => setControl((c) => ({ ...c, experience: { ...c.experience, voice: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warm">Warm</SelectItem><SelectItem value="grounded">Grounded</SelectItem><SelectItem value="bright">Bright</SelectItem><SelectItem value="minimal">Minimal</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Welcome message</Label><Input value={control.experience.greeting} onChange={(e) => setControl((c) => ({ ...c, experience: { ...c.experience, greeting: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Quiet / empty state</Label><Input value={control.experience.quietMessage} onChange={(e) => setControl((c) => ({ ...c, experience: { ...c.experience, quietMessage: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Saved confirmation</Label><Input value={control.experience.savedMessage} onChange={(e) => setControl((c) => ({ ...c, experience: { ...c.experience, savedMessage: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Error helper</Label><Input value={control.experience.errorMessage} onChange={(e) => setControl((c) => ({ ...c, experience: { ...c.experience, errorMessage: e.target.value } }))} /></div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>11 · Scheduled practice modes</CardTitle><CardDescription>Temporarily switch the public status without changing your normal settings.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={addSchedule} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2"><Label>Name</Label><Input placeholder="Weekend limited response" value={schedule.name} onChange={(e) => setSchedule((s) => ({ ...s, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Mode</Label><Select value={schedule.mode} onValueChange={(value) => setSchedule((s) => ({ ...s, mode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="limited">Limited availability</SelectItem><SelectItem value="high_demand">High demand</SelectItem><SelectItem value="paused">Paused</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Public headline</Label><Input value={schedule.title} onChange={(e) => setSchedule((s) => ({ ...s, title: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Status pill</Label><Input value={schedule.label} onChange={(e) => setSchedule((s) => ({ ...s, label: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={schedule.startsAt} onChange={(e) => setSchedule((s) => ({ ...s, startsAt: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={schedule.endsAt} onChange={(e) => setSchedule((s) => ({ ...s, endsAt: e.target.value }))} required /></div>
            <div className="space-y-2 lg:col-span-2"><Label>Supporting message</Label><Input value={schedule.detail} onChange={(e) => setSchedule((s) => ({ ...s, detail: e.target.value }))} placeholder="Responses may take a little longer than usual." /></div>
            <div className="lg:col-span-2"><Button type="submit"><CalendarClock className="mr-2 h-4 w-4" />Schedule mode</Button></div>
          </form>
          <div className="space-y-3">{schedules.length ? schedules.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.name}</p><Badge variant="outline">{item.mode}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.startsAt ? new Date(item.startsAt).toLocaleString() : '—'} → {item.endsAt ? new Date(item.endsAt).toLocaleString() : '—'}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div><Button variant="ghost" size="icon" onClick={() => deleteSchedule(item.id)} aria-label="Delete schedule"><Trash2 className="h-4 w-4" /></Button></div>) : <div className="rounded-2xl bg-muted/35 p-7 text-center text-sm text-muted-foreground">No temporary practice modes are scheduled.</div>}</div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save practice controls'}</Button>
        <a href={import.meta.env.BASE_URL + '?preview=1'} target="_blank" rel="noreferrer"><Button variant="outline">Preview public experience</Button></a>
      </div>
    </div>
  );
}
