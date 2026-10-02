import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Smartphone, ExternalLink, Eye } from 'lucide-react';

export default function HomepagePreview() {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const src = import.meta.env.BASE_URL + '?preview=1';
  const widthClass = mode === 'desktop' ? 'w-full' : 'w-[390px] max-w-full';

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Review the public-facing homepage without leaving the staff workspace.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Eye className="h-6 w-6 text-primary" /> Homepage preview</h1></div>
        <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">Open live homepage <ExternalLink className="ml-1 h-4 w-4" /></a>
      </div>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Preview frame</CardTitle><CardDescription>This shows the current public homepage with a preview banner.</CardDescription></div>
          <div className="flex gap-2"><Button size="sm" variant={mode === 'desktop' ? 'default' : 'outline'} onClick={() => setMode('desktop')}><Monitor className="mr-2 h-4 w-4" />Desktop</Button><Button size="sm" variant={mode === 'mobile' ? 'default' : 'outline'} onClick={() => setMode('mobile')}><Smartphone className="mr-2 h-4 w-4" />Mobile</Button></div>
        </CardHeader>
        <CardContent><div className="overflow-x-auto rounded-3xl border bg-muted/20 p-3"><div className={['mx-auto overflow-hidden rounded-2xl border bg-background shadow-xl transition-all', widthClass].join(' ')}><iframe title="Aydens Wellness Services homepage preview" src={src} className="h-[72vh] min-h-[560px] w-full border-0" /></div></div></CardContent>
      </Card>
    </div>
  );
}
