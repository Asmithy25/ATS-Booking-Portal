import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getCollaborationQueryKey,
  useCollaboration,
  useCreateCollaboration,
  useUpdateCollaboration,
  type CollaborationItem,
} from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Inbox, NotebookPen, Send, UsersRound } from 'lucide-react';

const TABS: Array<{ value: Exclude<CollaborationItem['kind'], 'chat'>; label: string; icon: typeof Inbox }> = [
  { value: 'inbox', label: 'Staff inbox', icon: Inbox },
  { value: 'task', label: 'Tasks', icon: ClipboardCheck },
  { value: 'shift_note', label: 'Shift notes', icon: NotebookPen },
];

export default function TeamWorkspace() {
  const [activeKind, setActiveKind] = useState<Exclude<CollaborationItem['kind'], 'chat'>>('inbox');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const { data = [], isLoading } = useCollaboration(activeKind);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const create = useCreateCollaboration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getCollaborationQueryKey(activeKind) });
        setBody('');
        setTitle('');
        setAssignedTo('');
        setDueDate('');
        toast({ title: activeKind === 'task' ? 'Task assigned' : 'Posted to the team workspace' });
      },
      onError: (error) => toast({
        variant: 'destructive',
        title: 'Could not save',
        description: (error as { data?: { error?: string } })?.data?.error ?? 'Please try again.',
      }),
    },
  });
  const update = useUpdateCollaboration({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getCollaborationQueryKey(activeKind) }),
      onError: () => toast({ variant: 'destructive', title: 'Could not update item' }),
    },
  });

  const activeTab = useMemo(() => TABS.find((tab) => tab.value === activeKind) ?? TABS[0], [activeKind]);
  const ActiveIcon = activeTab.icon;
   const submitLabel = activeKind === 'task' ? 'Assign task' : 'Save workspace item';

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-muted-foreground">A shared space for the people behind the care</p>
        <h1 className="text-3xl font-semibold">Team workspace</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Keep handoffs, quick questions, internal tasks, and team updates together. Only signed-in staff can access this workspace.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" /> Add to the workspace</CardTitle>
            <CardDescription>Choose a channel, then leave a clear note for the team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.value}
                    type="button"
                    variant={activeKind === tab.value ? 'default' : 'outline'}
                    className="h-auto justify-start gap-2 rounded-xl px-3 py-3 text-left"
                    onClick={() => setActiveKind(tab.value)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-xs">{tab.label}</span>
                  </Button>
                );
              })}
            </div>
            {activeKind === 'task' && (
              <>
                <div className="space-y-2"><Label>Task title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Follow up with a client" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Assign to</Label><Input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Team member name" /></div>
                  <div className="space-y-2"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
                </div>
              </>
            )}
             <div className="space-y-2"><Label>{activeKind === 'inbox' ? 'Inbox item' : 'Details'}</Label><Textarea className="min-h-32" value={body} onChange={(event) => setBody(event.target.value)} placeholder={activeKind === 'shift_note' ? 'What should the next shift know?' : 'Write a clear, useful update…'} /></div>
            <Button className="rounded-xl" disabled={!body.trim() || create.isPending} onClick={() => create.mutate({ kind: activeKind, title: title || undefined, body, assignedTo: assignedTo || undefined, dueDate: dueDate || undefined })}>
              <Send className="h-4 w-4" /> {submitLabel}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle className="flex items-center gap-2"><ActiveIcon className="h-5 w-5 text-primary" /> {activeTab.label}</CardTitle><CardDescription>Newest updates appear first.</CardDescription></div>
            <Badge variant="secondary">{data.length}</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading workspace…</p> : data.length ? (
              <div className="space-y-3">
                {data.map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {item.title && <p className="font-medium">{item.title}</p>}
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{item.body}</p>
                      </div>
                      <Select value={item.status} onValueChange={(status) => update.mutate({ id: item.id, data: { status: status as CollaborationItem['status'] } })}>
                        <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.authorName}</span>
                      <span>·</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.assignedTo && <Badge variant="outline">Assigned to {item.assignedTo}</Badge>}
                      {item.dueDate && <Badge variant="outline">Due {item.dueDate}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="rounded-2xl bg-muted/40 p-8 text-center"><p className="font-medium">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">Start the conversation with a thoughtful update.</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}