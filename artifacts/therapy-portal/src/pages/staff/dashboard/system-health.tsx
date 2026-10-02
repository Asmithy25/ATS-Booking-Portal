import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { customFetch } from '@workspace/api-client-react';
import { Activity, Database, RefreshCw, Server, ShieldCheck } from 'lucide-react';

type Health = { service: string; environment: string; uptimeSeconds: number; checkedAt: string; database: { status: string; latencyMs: number }; tables: Array<{ name: string; status: string; count: number | null }>; scheduler: { status: string; cadenceSeconds: number }; frontend: { status: string; originHint: string } };

function State({ status }: { status: string }) { return <Badge variant={status === 'healthy' || status === 'connected' ? 'default' : 'destructive'}>{status}</Badge>; }

export default function SystemHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); customFetch<Health>('/api/workspace/health').then(setHealth).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">A plain-English health check for the parts that keep the platform alive.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Activity className="h-6 w-6 text-primary" /> System health</h1></div><Button variant="outline" onClick={load}><RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />Refresh</Button></div>
      {health && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['API service', health.service, health.frontend.status, Server],
        ['Database', health.database.latencyMs + ' ms', health.database.status, Database],
        ['Scheduler', health.scheduler.cadenceSeconds + ' sec cadence', health.scheduler.status, Activity],
        ['Frontend', health.frontend.originHint, health.frontend.status, ShieldCheck],
      ].map(([label, value, state, Icon]) => <Card key={String(label)} className="rounded-2xl"><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{String(label)}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-2 font-semibold">{String(value)}</p><div className="mt-2"><State status={String(state)} /></div></CardContent></Card>)}</div>
      <Card className="rounded-2xl"><CardHeader><CardTitle>Data stores</CardTitle></CardHeader><CardContent><div className="space-y-2">{health.tables.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.count === null ? 'Count unavailable' : item.count + ' rows'}</p></div><State status={item.status} /></div>)}</div></CardContent></Card>
      <p className="text-xs text-muted-foreground">Checked {new Date(health.checkedAt).toLocaleString()} · API uptime {Math.floor(health.uptimeSeconds / 60)} minutes</p></>}
    </div>
  );
}
