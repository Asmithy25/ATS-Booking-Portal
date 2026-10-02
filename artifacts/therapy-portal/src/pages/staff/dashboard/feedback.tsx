import { useEffect, useMemo, useState } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareText, Star } from 'lucide-react';

type FeedbackItem = { id: number; bookingId: number; confirmationCode: string; clientName: string; rating: number; comment?: string | null; createdAt: string };

function Stars({ rating }: { rating: number }) {
  return <div className="flex gap-0.5 text-primary" aria-label={rating + ' out of 5 stars'}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} className="h-4 w-4" fill={value <= rating ? 'currentColor' : 'none'} />)}</div>;
}

export default function Feedback() {
  const { toast } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRating, setMinRating] = useState('all');

  useEffect(() => {
    customFetch<FeedbackItem[]>('/api/portal/feedback')
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => toast({ variant: 'destructive', title: 'Could not load feedback', description: err instanceof Error ? err.message : 'Please refresh.' }))
      .finally(() => setLoading(false));
  }, []);

  const average = items.length ? Math.round((items.reduce((sum, item) => sum + item.rating, 0) / items.length) * 10) / 10 : 0;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: items.filter((item) => item.rating === rating).length }));
  const visible = useMemo(() => minRating === 'all' ? items : items.filter((item) => item.rating >= Number(minRating)), [items, minRating]);

  return (
    <div className="max-w-6xl space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">A practice-level view of completed-session feedback.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><MessageSquareText className="h-6 w-6 text-primary" /> Feedback dashboard</h1></div>
        <Badge variant="secondary">{items.length} responses</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average rating</p><p className="mt-2 font-serif text-4xl">{average || '—'}</p><Stars rating={Math.round(average)} /></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">5-star responses</p><p className="mt-2 font-serif text-4xl">{distribution[0].count}</p><p className="text-xs text-muted-foreground">{items.length ? Math.round((distribution[0].count / items.length) * 100) : 0}% of responses</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latest response</p><p className="mt-2 text-lg font-semibold">{items[0]?.clientName ?? '—'}</p><p className="text-xs text-muted-foreground">{items[0] ? new Date(items[0].createdAt).toLocaleDateString() : 'No responses yet'}</p></CardContent></Card>
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Rating mix</CardTitle><CardDescription>Distribution across all submitted session ratings.</CardDescription></CardHeader>
        <CardContent className="space-y-3">{distribution.map((item) => <div key={item.rating} className="flex items-center gap-3"><span className="w-12 text-sm font-medium">{item.rating} star</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: (items.length ? (item.count / items.length) * 100 : 0) + '%' }} /></div><span className="w-8 text-right text-xs text-muted-foreground">{item.count}</span></div>)}</CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Recent feedback</CardTitle><CardDescription>Read client comments alongside their rating.</CardDescription></div><Select value={minRating} onValueChange={setMinRating}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All ratings</SelectItem><SelectItem value="5">5 stars</SelectItem><SelectItem value="4">4+ stars</SelectItem><SelectItem value="3">3+ stars</SelectItem></SelectContent></CardHeader>
        <CardContent>{loading ? <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : visible.length ? <div className="space-y-3">{visible.map((item) => <article key={item.id} className="rounded-2xl border bg-background p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{item.clientName}</p><p className="text-xs text-muted-foreground">Session {item.confirmationCode} · {new Date(item.createdAt).toLocaleString()}</p></div><Stars rating={item.rating} /></div>{item.comment ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">“{item.comment}”</p> : <p className="mt-4 text-sm italic text-muted-foreground">No written comment.</p>}</article>)}</div> : <div className="rounded-2xl bg-muted/35 p-10 text-center"><p className="font-medium">No feedback matches that filter.</p></div>}</CardContent>
      </Card>
    </div>
  );
}
