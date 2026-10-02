import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCollaborationQueryKey, useCollaboration, useCreateCollaboration, useGetAuthMe, useUpdateCollaboration, type CollaborationItem } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Inbox, NotebookPen, Search, Send, UsersRound } from 'lucide-react';

const TABS: Array<{ value: Exclude<CollaborationItem['kind'], 'chat'>; label: string; icon: typeof Inbox }> = [
  { value: 'inbox', label: 'Staff inbox', icon: Inbox },
  { value: 'task', label: 'Tasks', icon: ClipboardCheck },
  { value: 'shift_note', label: 'Shift notes', icon: NotebookPen },
];

type Filter = 'all' | 'open' | 'mine' | 'overdue';
const isOverdue = (item: CollaborationItem) => Boolean(item.dueDate && item.status !== 'done' && new Date(item.dueDate + 'T23:59:59').getTime() < Date.now());

export default function TeamWorkspace() {
  const [activeKind, setActiveKind] = useState<Exclude<CollaborationItem['kind'], 'chat'>>('inbox');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const { data = [], isLoading } = useCollaboration(activeKind);
  const { data: session } = useGetAuthMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const create = useCreateCollaboration({ mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getCollaborationQueryKey(activeKind) });
      setBody(''); setTitle(''); setAssignedTo(''); setDueDate('');
      toast({ title: activeKind === 'task' ? 'Task assigned' : 'Posted to the team workspace' });
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save', description: (error as { data?: { error?: string } })?.data?.error ?? 'Please try again.' }),
  }});
  const update = useUpdateCollaboration({ mutation: {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getCollaborationQueryKey(activeKind) }),
    onError: () => toast({ variant: 'destructive', title: 'Could not update item' }),
  }});

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.filter((item) => {
      const mine = Boolean(session?.staffName && item.assignedTo?.toLowerCase() === session.staffName.toLowerCase());
      const matchesFilter = filter === 'all' || (filter === 'open' && item.status !== 'done') || (filter === 'mine' && mine) || (filter === 'overdue' && isOverdue(item));
      const matchesSearch = !needle || [item.title, item.body, item.authorName, item.assignedTo ?? ''].join(' ').toLowerCase().includes(needle);
      return matchesFilter && matchesSearch;
    });
  }, [data, filter, search, session?.staffName]);

  const counts = useMemo(() => ({
    total: data.length,
    open: data.filter((item) => item.status !== 'done').length,
    mine: data.filter((item) => Boolean(session?.staffName && item.assignedTo?.toLowerCase() === session.staffName.toLowerCase())).length,
    overdue: data.filter(isOverdue).length,
  }), [data, session?.staffName]);

  const activeTab = TABS.find((tab) => tab.value === activeKind) ?? TABS[0];
  const Icon = activeTab.icon;

  return (
    <div className="space-y-7 max-w-7xl">
      <div><p className="text-sm text-muted-foreground">A calmer shared workspace for handoffs, tasks, and shift notes.</p><h1 className="mt-1 text-3xl font-semibold">Team workspace</h1><p className="mt-2 max-w-2xl text-muted-foreground">Keep team work visible without turning the dashboard into a wall of noise.</p></div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['All items', counts.total, 'all'],
          ['Open', counts.open, 'open'],
          ['Assigned to me', counts.mine, 'mine'],
          ['Overdue', counts.overdue, 'overdue'],
        ].map(([label, count, value]) => (
          <button key={String(value)} type="button" onClick={() => setFilter(value as Filter)} className={['rounded-2xl border p-4 text-left transition', filter === value ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/30'].join(' ')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{String(label)}</p><p className="mt-2 font-serif text-3xl">{String(count)}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" /> Quick add</CardTitle><CardDescription>Post a handoff, task, or note in a few seconds.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">{TABS.map((tab) => { const TabIcon = tab.icon; return <Button key={tab.value} type="button" size="sm" variant={activeKind === tab.value ? 'default' : 'outline'} className="h-auto justify-center rounded-xl px-2 py-3" onClick={() => setActiveKind(tab.value)}><TabIcon className="mr-1 h-4 w-4" /><span className="hidden sm:inline">{tab.label}</span></Button>; })}</div>
            {activeKind === 'task' && <>
              <div className="space-y-2"><Label>Task title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up with a client" /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Assign to</Label><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Team member name" /></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div></div>
            </>}
            <div className="space-y-2"><Label>{activeKind === 'inbox' ? 'Inbox item' : 'Details'}</Label><Textarea className="min-h-32" value={body} onChange={(e) => setBody(e.target.value)} placeholder={activeKind === 'shift_note' ? 'What should the next shift know?' : 'Write a clear, useful update…'} /></div>
            <Button className="rounded-xl" disabled={!body.trim() || create.isPending} onClick={() => create.mutate({ kind: activeKind, title: title || undefined, body, assignedTo: assignedTo || undefined, dueDate: dueDate || undefined })}><Send className="mr-2 h-4 w-4" />{activeKind === 'task' ? 'Assign task' : 'Post to workspace'}</Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /> {activeTab.label}</CardTitle><CardDescription>Search and focus on what needs attention.</CardDescription></div>
              <div className="flex flex-wrap gap-2"><div className="relative min-w-44 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspace" /></div><Select value={filter} onValueChange={(value) => setFilter(value as Filter)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="mine">Mine</SelectItem><SelectItem value="overdue">Overdue</SelectItem></SelectContent></Select></div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading workspace…</p> : visible.length ? <div className="space-y-3">{visible.map((item) => <div key={item.id} className="rounded-2xl border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">{item.title && <p className="font-medium">{item.title}</p>}<p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{item.body}</p></div><Select value={item.status} onValueChange={(status) => update.mutate({ id: item.id, data: { status: status as CollaborationItem['status'] } })}><SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{item.authorName}</span><span>·</span><span>{new Date(item.createdAt).toLocaleString()}</span>{item.assignedTo && <Badge variant="outline">Assigned to {item.assignedTo}</Badge>}{item.dueDate && <Badge variant={isOverdue(item) ? 'destructive' : 'outline'}>{isOverdue(item) ? 'Overdue' : 'Due'} {item.dueDate}</Badge>}</div></div>)}</div> : <div className="rounded-2xl bg-muted/40 p-8 text-center"><p className="font-medium">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">Try another filter or post the first update.</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
