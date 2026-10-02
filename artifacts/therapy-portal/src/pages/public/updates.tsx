import { useEffect, useMemo, useState } from 'react';
import { customFetch, useGetSettings } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { CalendarDays, Loader2, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { getThemeStyle } from '@/lib/theme';

type Announcement = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  metadata?: { subheading?: string; imageUrl?: string; buttonText?: string; buttonUrl?: string; status?: string; category?: string; startsAt?: string; endsAt?: string; showSignature?: boolean; signatureName?: string; signatureTitle?: string; signatureImageUrl?: string };
};

export default function Updates() {
  const { data: settings } = useGetSettings();
  const [items, setItems] = useState<Announcement[]>([]);
  const [category, setCategory] = useState('All');
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((item) => item.metadata?.category ?? 'General')))], [items]);

  useEffect(() => {
    customFetch<Announcement[]>('/api/portal/announcements?audience=client')
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  const visible = category === 'All' ? items : items.filter((item) => (item.metadata?.category ?? 'General') === category);

  return (
    <div className="min-h-screen bg-background text-foreground" style={getThemeStyle(settings)}>
      <PublicNavbar />
      <main className="container mx-auto max-w-5xl px-4 py-16">
        <div className="mb-10 text-center"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Aydens Wellness Services</p><h1 className="mt-3 flex items-center justify-center gap-2 font-serif text-4xl font-bold sm:text-5xl"><Megaphone className="h-8 w-8 text-primary" /> Practice updates</h1><p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Announcements, scheduling notes, and little things worth knowing from the practice.</p></div>
        <div className="mb-8 flex flex-wrap justify-center gap-2">{categories.map((item) => <Button key={item} size="sm" variant={category === item ? 'default' : 'outline'} onClick={() => setCategory(item)}>{item}</Button>)}</div>
        {items.length === 0 ? <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div> : visible.length ? <div className="space-y-5">{visible.map((item) => <article key={item.id} className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-sm"><div className="grid gap-0 lg:grid-cols-[220px_1fr]">{item.metadata?.imageUrl ? <img src={item.metadata.imageUrl} alt="" className="h-56 w-full object-cover lg:h-full" /> : <div className="flex min-h-40 items-center justify-center bg-primary/[0.05] text-primary"><Megaphone className="h-10 w-10" /></div>}<div className="p-6 sm:p-8"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.metadata?.category ?? 'General'}</Badge>{item.metadata?.startsAt && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(item.metadata.startsAt), 'MMM d, yyyy')}</span>}</div><p className="mt-4 text-xs font-semibold uppercase tracking-[.2em] text-primary">{item.metadata?.subheading ?? 'Practice update'}</p><h2 className="mt-1 font-serif text-2xl font-bold">{item.title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.body}</p>{item.metadata?.showSignature !== false && <div className="mt-6 flex items-center gap-3 border-t pt-4">{item.metadata?.signatureImageUrl && <img src={item.metadata.signatureImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}<div><p className="font-serif italic">{item.metadata?.signatureName ?? 'Ayden Smith'}</p><p className="text-xs text-muted-foreground">{item.metadata?.signatureTitle ?? 'Founder & CEO of Aydens Wellness Services'}</p></div></div>}{item.metadata?.buttonText && item.metadata?.buttonUrl && <a href={item.metadata.buttonUrl} className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{item.metadata.buttonText}</a>}</div></div></article>)}</div> : <div className="rounded-[2rem] bg-muted/30 p-12 text-center"><p className="font-serif text-2xl">Nothing new in that category.</p><p className="mt-2 text-sm text-muted-foreground">Try another update filter.</p></div>}
      </main>
      <div className="container mx-auto px-4 pb-12 text-center"><a href={import.meta.env.BASE_URL} className="text-sm font-semibold text-primary hover:underline">Back to the homepage</a></div>
      <PublicFooter />
    </div>
  );
}
