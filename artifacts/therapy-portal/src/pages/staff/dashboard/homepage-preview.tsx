import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Smartphone, ExternalLink, Eye, RotateCcw, Save } from 'lucide-react';

type Draft = { practice: { title: string; detail: string; label: string }; seasonal: { enabled: boolean; season: string }; experience: { enabled: boolean; greeting: string } };

const DEFAULT_DRAFT: Draft = {
  practice: { title: 'We’re here when you’re ready', detail: 'Phone consultations are currently open for new requests.', label: 'Accepting new requests' },
  seasonal: { enabled: true, season: 'fall' },
  experience: { enabled: true, greeting: 'Welcome to Aydens Wellness Services.' },
};

export default function HomepagePreview() {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [previewKey, setPreviewKey] = useState(0);
  const src = import.meta.env.BASE_URL + '?preview=1';
  const widthClass = mode === 'desktop' ? 'w-full' : 'w-[390px] max-w-full';

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aydens-preview-draft');
      if (saved) setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(saved) });
    } catch { /* keep defaults */ }
  }, []);

  const applyPreview = () => {
    localStorage.setItem('aydens-preview-draft', JSON.stringify(draft));
    setPreviewKey((value) => value + 1);
  };

  const clearPreview = () => {
    localStorage.removeItem('aydens-preview-draft');
    setDraft(DEFAULT_DRAFT);
    setPreviewKey((value) => value + 1);
  };

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">See the public experience without publishing your draft.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Eye className="h-6 w-6 text-primary" /> Homepage preview</h1><p className="mt-2 max-w-2xl text-muted-foreground">Preview changes live in this browser only. Nothing here writes to the production settings until you save it from the proper control page.</p></div>
        <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">Open live homepage <ExternalLink className="ml-1 h-4 w-4" /></a>
      </div>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>12 · Safe preview controls</CardTitle><CardDescription>Experiment here first. These values stay local to this browser.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Status headline</Label><Input value={draft.practice.title} onChange={(e) => setDraft((d) => ({ ...d, practice: { ...d.practice, title: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Status message</Label><Input value={draft.practice.detail} onChange={(e) => setDraft((d) => ({ ...d, practice: { ...d.practice, detail: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Status pill</Label><Input value={draft.practice.label} onChange={(e) => setDraft((d) => ({ ...d, practice: { ...d.practice, label: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Season</Label><Select value={draft.seasonal.season} onValueChange={(value) => setDraft((d) => ({ ...d, seasonal: { ...d.seasonal, season: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="spring">Spring</SelectItem><SelectItem value="summer">Summer</SelectItem><SelectItem value="fall">Fall</SelectItem><SelectItem value="halloween">Halloween</SelectItem><SelectItem value="winter">Winter</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Experience greeting</Label><Input value={draft.experience.greeting} onChange={(e) => setDraft((d) => ({ ...d, experience: { ...d.experience, greeting: e.target.value } }))} /></div>
            <div className="flex flex-wrap gap-2 pt-2"><Button onClick={applyPreview}><Save className="mr-2 h-4 w-4" />Apply preview</Button><Button variant="outline" onClick={clearPreview}><RotateCcw className="mr-2 h-4 w-4" />Clear draft</Button></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Public-facing view</CardTitle><CardDescription>The preview banner identifies this as a preview.</CardDescription></div><div className="flex gap-2"><Button size="sm" variant={mode === 'desktop' ? 'default' : 'outline'} onClick={() => setMode('desktop')}><Monitor className="mr-2 h-4 w-4" />Desktop</Button><Button size="sm" variant={mode === 'mobile' ? 'default' : 'outline'} onClick={() => setMode('mobile')}><Smartphone className="mr-2 h-4 w-4" />Mobile</Button></div></CardHeader>
          <CardContent><div className="overflow-x-auto rounded-3xl border bg-muted/20 p-3"><div key={previewKey} className={['mx-auto overflow-hidden rounded-2xl border bg-background shadow-xl transition-all', widthClass].join(' ')}><iframe title="Aydens Wellness Services homepage safe preview" src={src + '&previewDraft=' + previewKey} className="h-[72vh] min-h-[560px] w-full border-0" /></div></div></CardContent>
        </Card>
      </div>
    </div>
  );
}
