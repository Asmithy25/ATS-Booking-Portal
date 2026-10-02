import { useEffect, useMemo, useState } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

type StaffNotification = { id: number; title: string; body: string; read: boolean; createdAt?: string };

export default function Notifications() {
  const { toast } = useToast();
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await customFetch<StaffNotification[]>('/api/settings/staff-preferences/notifications');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load notifications', description: err instanceof Error ? err.message : 'Please refresh.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === 'unread' ? items.filter((item) => !item.read) : items, [filter, items]);
  const unread = items.filter((item) => !item.read).length;

  const markRead = async (id: number) => {
    try {
      await customFetch('/api/settings/staff-preferences/notifications/' + id + '/read', { method: 'PATCH' });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch {
      toast({ variant: 'destructive', title: 'Could not update notification' });
    }
  };

  const markAllRead = async () => {
    try {
      await customFetch('/api/settings/staff-preferences/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      toast({ title: 'All caught up' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not mark notifications read', description: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  return (
    <div className="max-w-4xl space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">A single place for appointment, team, and practice alerts.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><Bell className="h-6 w-6 text-primary" /> Notification center</h1></div>
        <Badge variant={unread ? 'default' : 'secondary'}>{unread} unread</Badge>
      </div>
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Your notifications</CardTitle><CardDescription>Notifications are private to your staff account.</CardDescription></div>
          <div className="flex flex-wrap gap-2">
            <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
            <Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>Unread</Button>
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={!unread}><CheckCheck className="mr-1 h-4 w-4" />Mark all read</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : visible.length ? (
            <div className="space-y-3">
              {visible.map((item) => (
                <button key={item.id} type="button" onClick={() => !item.read && markRead(item.id)} className={['w-full rounded-2xl border p-4 text-left transition', item.read ? 'bg-background opacity-65' : 'bg-primary/[0.045] hover:bg-primary/[0.08]'].join(' ')}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p></div>
                    {!item.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />}
                  </div>
                  {item.createdAt && <p className="mt-3 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>}
                </button>
              ))}
            </div>
          ) : <div className="rounded-2xl bg-muted/35 p-10 text-center"><p className="font-medium">{filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}</p><p className="mt-1 text-sm text-muted-foreground">New staff alerts will show up here.</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}
