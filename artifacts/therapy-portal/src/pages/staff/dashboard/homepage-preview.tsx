import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Smartphone, ExternalLink, Eye, RotateCcw, Save } from 'lucide-react';

type Draft = { practice: { title: string; detail: string; label: string }; seasonal: { enabled: boolean; season: string }; experience: { enabled: boolean; greeting: string }; brand: { primaryColor: string; secondaryColor: string; accentColor: string } };

const BRAND_PALETTES: Record<string, Draft['brand']> = {
  halloween: { primaryColor: '#C85E09', secondaryColor: '#F3A444', accentColor: '#F2C078' },
  fall: { primaryColor: '#6B2A0A', secondaryColor: '#C76A25', accentColor: '#E7B66F' },
  christmas: { primaryColor: '#176344', secondaryColor: '#B72D38', accentColor: '#D9B86C' },
  winter: { primaryColor: '#244A73', secondaryColor: '#88B9D9', accentColor: '#E6EFF6' },
  spring: { primaryColor: '#4F8060', secondaryColor: '#E9AFC2', accentColor: '#E7D17A' },
  summer: { primaryColor: '#087E8B', secondaryColor: '#FFD166', accentColor: '#FF8C69' },
  valentines: { primaryColor: '#9E2348', secondaryColor: '#E46C89', accentColor: '#F6C9D3' },
  'new-year': { primaryColor: '#182847', secondaryColor: '#9BAFC7', accentColor: '#D8B56A' },
  everyday: { primaryColor: '#8F4A34', secondaryColor: '#C98549', accentColor: '#E9C18A' },
};

const DEFAULT_DRAFT: Draft = {
  practice: { title: 'We’re here when you’re ready', detail: 'Phone consultations are currently open for new requests.', label: 'Accepting new requests' },
  seasonal: { enabled: true, season: 'fall' },
  experience: { enabled: true, greeting: 'Welcome to Aydens Wellness Services.' },
  brand: BRAND_PALETTES.halloween,
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
      if (saved) {
        const parsed = JSON.parse(saved);
        setDraft({ ...DEFAULT_DRAFT, ...parsed, practice: { ...DEFAULT_DRAFT.practice, ...(parsed.practice || {}) }, seasonal: { ...DEFAULT_DRAFT.seasonal, ...(parsed.seasonal || {}) }, experience: { ...DEFAULT_DRAFT.experience, ...(parsed.experience || {}) }, brand: { ...DEFAULT_DRAFT.brand, ...(parsed.brand || {}) } });
      }
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
        <div><p className="text-sm text-muted-foreground">See the public experience without publishing your draft.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Eye className="h-6 w-6 text-primary" /> Preview Universe</h1><p className="mt-2 max-w-2xl text-muted-foreground">Preview copy, seasonal styling and brand colors locally. Nothing is published to the live website until you apply the matching preset or save the production settings separately.</p></div>
        <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">Open live homepage <ExternalLink className="ml-1 h-4 w-4" /></a>
      </div>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Safe preview controls</CardTitle><CardDescription>Experiment with copy, seasonal presentation, and colors locally before you publish.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Status headline</Label><Input value={draft.practice.title} onChange={(e) => setDraft((d) => ({ ...d, practice: { ...d.practice, title: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Status message</Label><Input value={draft.practice.detail} onChange={(e) => setDraft((d) => ({ ...d, practice: { ...d.practice, detail: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Status pill</Label><Input value={draft.practice.label} onChange={(e) => setDraft((d) => ({ ...d, practice: { ...d.practice, label: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Season / experience</Label><Select value={draft.seasonal.season} onValueChange={(value) => setDraft((d) => ({ ...d, seasonal: { ...d.seasonal, season: value }, brand: BRAND_PALETTES[value] ? { ...BRAND_PALETTES[value] } : d.brand }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="spring">Spring</SelectItem><SelectItem value="summer">Summer</SelectItem><SelectItem value="fall">Fall Signature</SelectItem><SelectItem value="halloween">Halloween</SelectItem><SelectItem value="christmas">Christmas</SelectItem><SelectItem value="winter">Winter</SelectItem><SelectItem value="valentines">Valentine’s Day</SelectItem><SelectItem value="new-year">New Year</SelectItem><SelectItem value="everyday">Everyday AWS</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Choosing a season also loads a matching local-only color palette.</p></div>
            <div className="space-y-2"><Label>Experience greeting</Label><Input value={draft.experience.greeting} onChange={(e) => setDraft((d) => ({ ...d, experience: { ...d.experience, greeting: e.target.value } }))} /></div><div className="space-y-3 rounded-xl border p-3 sm:col-span-2"><div><p className="text-sm font-medium">Brand colors</p><p className="text-xs text-muted-foreground">Adjust these in the preview only. Publish from Seasonal Brand Presets after you're happy with the result.</p></div><div className="grid gap-3 sm:grid-cols-3">{([['primaryColor','Primary'],['secondaryColor','Secondary'],['accentColor','Accent']] as const).map(([key,label])=><div key={key} className="space-y-1.5"><Label>{label}</Label><div className="flex items-center gap-2"><Input type="color" className="h-10 w-12 p-1" value={draft.brand[key]} onChange={(e)=>setDraft((d)=>({...d,brand:{...d.brand,[key]:e.target.value}}))}/><Input value={draft.brand[key]} maxLength={7} onChange={(e)=>setDraft((d)=>({...d,brand:{...d.brand,[key]:e.target.value}}))} className="font-mono uppercase"/></div></div>)}</div><div className="flex flex-wrap gap-2">{Object.entries(BRAND_PALETTES).map(([name,colors])=><button key={name} type="button" onClick={()=>setDraft((d)=>({...d,brand:{...colors},seasonal:{...d.seasonal,season:name}}))} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs capitalize"><span className="h-3 w-3 rounded-full" style={{backgroundColor:colors.primaryColor}}/>{name.replace('-',' ')}</button>)}</div></div>
            <div className="flex flex-wrap gap-2 pt-2"><Button onClick={applyPreview}><Save className="mr-2 h-4 w-4" />Apply preview</Button><Button variant="outline" onClick={clearPreview}><RotateCcw className="mr-2 h-4 w-4" />Clear draft</Button><a href={import.meta.env.BASE_URL + "staff/website-settings"} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">Publish via Brand Studio</a></div>
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
