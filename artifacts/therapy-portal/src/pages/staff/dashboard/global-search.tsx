import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { customFetch } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowUpRight, CalendarDays, Megaphone, MessageCircle, UserRound, UsersRound } from 'lucide-react';

type Result = { type: string; id: string; title: string; subtitle: string; href: string };

const icons: Record<string, any> = { booking: CalendarDays, client: UserRound, announcement: Megaphone, workspace: MessageCircle, staff: UsersRound };

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setItems([]); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try { const data = await customFetch<Result[]>('/api/workspace/search?q=' + encodeURIComponent(value)); setItems(Array.isArray(data) ? data : []); }
      catch { setItems([]); }
      finally { setLoading(false); }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-5xl space-y-7">
      <div><p className="text-sm text-muted-foreground">One search box for the things you actually need to find.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Search className="h-6 w-6 text-primary" /> Global search</h1><p className="mt-2 max-w-2xl text-muted-foreground">Search clients, bookings, announcements, team workspace items, and staff.</p></div>
      <Card className="rounded-2xl"><CardContent className="p-5"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-12 pl-10 text-base" placeholder="Try a name, confirmation code, email, phone, or phrase…" /></div></CardContent></Card>
      {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
      {!loading && query.trim().length >= 2 && !items.length && <div className="rounded-2xl bg-muted/35 p-10 text-center"><p className="font-medium">Nothing matched that search.</p><p className="mt-1 text-sm text-muted-foreground">Try a client name, booking code, or keyword.</p></div>}
      <div className="space-y-3">{items.map((item) => { const Icon = icons[item.type] ?? Search; return <Link key={item.type + item.id} href={item.href}><Card className="rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-center gap-4 p-4"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge variant="outline">{item.type}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" /></CardContent></Card></Link>; })}</div>
    </div>
  );
}
