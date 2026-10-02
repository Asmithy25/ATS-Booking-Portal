import { useEffect, useMemo, useState } from 'react';
import { customFetch, useGetSettings, useGetAuthMe } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch as SwitchComponent } from '@/components/ui/switch';
import { Eye, LayoutPanelTop, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SECTIONS = [
  ['hero', 'Hero', 'The opening welcome area.'],
  ['about', 'Our approach', 'The practice introduction and philosophy.'],
  ['wellness', 'Wellness Journey', 'The public wellness assignment lookup.'],
  ['booking', 'How to begin', 'The consultation booking section.'],
  ['announcements', 'Practice updates', 'The latest public announcements.'],
  ['footer', 'Footer', 'Contact, practice details, and footer information.'],
] as const;

export default function HomepageControls() {
  const { data: settings } = useGetSettings();
  const { data: session } = useGetAuthMe();
  const { toast } = useToast();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = (settings?.homepageContent as any)?.sectionVisibility;
    setVisibility(Object.fromEntries(SECTIONS.map(([key]) => [key, saved?.[key] !== false])));
  }, [settings]);

  const enabledCount = useMemo(() => Object.values(visibility).filter(Boolean).length, [visibility]);

  const save = async () => {
    setSaving(true);
    try {
      const homepageContent = { ...(settings?.homepageContent ?? {}), sectionVisibility: visibility };
      await customFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ homepageContent }) });
      toast({ title: 'Homepage layout saved', description: `${enabledCount} of ${SECTIONS.length} sections are enabled.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save homepage layout', description: err instanceof Error ? err.message : 'Founder permission is required.' });
    } finally { setSaving(false); }
  };

  if (!session?.isAdmin) return <div className="rounded-2xl border bg-muted/30 p-8 text-sm text-muted-foreground">Homepage section controls are founder-only.</div>;

  return (
    <div className="max-w-4xl space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Choose which major sections appear on the public homepage.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><LayoutPanelTop className="h-6 w-6 text-primary" /> Homepage controls</h1><p className="mt-2 max-w-2xl text-muted-foreground">This does not change the content itself — it simply controls which sections are visible.</p></div>
        <Badge variant="secondary">{enabledCount}/{SECTIONS.length} visible</Badge>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Homepage sections</CardTitle><CardDescription>Turn a section on or off, then preview the public site before making other changes.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {SECTIONS.map(([key, label, description]) => <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border p-4"><div><p className="font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><SwitchComponent checked={visibility[key] !== false} onCheckedChange={(checked) => setVisibility((current) => ({ ...current, [key]: checked }))} /></div>)}
          <div className="flex flex-wrap gap-2 pt-4"><Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save homepage layout'}</Button><a href={import.meta.env.BASE_URL + '?preview=1'} target="_blank" rel="noreferrer"><Button variant="outline"><Eye className="mr-2 h-4 w-4" />Preview homepage</Button></a></div>
        </CardContent>
      </Card>
    </div>
  );
}
