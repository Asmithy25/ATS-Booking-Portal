import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, ClipboardCheck, Heart, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  useCreateWellnessAssignment,
  useDeleteWellnessAssignment,
  useGetWellnessAssignments,
  useSearchClients,
  useUpdateWellnessAssignment,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type AssignmentType = 'wellness_journey' | 'notebook' | 'homework';

const typeLabels: Record<AssignmentType, string> = {
  wellness_journey: 'Wellness Journey',
  notebook: 'Notebook',
  homework: 'Homework',
};

const typeIcons = {
  wellness_journey: Heart,
  notebook: NotebookPen,
  homework: ClipboardCheck,
};

export default function Wellness() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assignments = [], isLoading } = useGetWellnessAssignments();
  const [clientSearch, setClientSearch] = useState('');
  const { data: searchResults } = useSearchClients(clientSearch, {
    query: { retry: false },
  });
  const clients = searchResults?.clients ?? [];

  const createAssignment = useCreateWellnessAssignment();
  const updateAssignment = useUpdateWellnessAssignment();
  const deleteAssignment = useDeleteWellnessAssignment();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [clientId, setClientId] = useState('');
  const [type, setType] = useState<AssignmentType>('homework');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setClientId('');
    setType('homework');
    setTitle('');
    setContent('');
    setDueDate('');
    setClientSearch('');
  };

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['/api/portal/wellness-assignments'],
    });
  };

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.clientAccountId) === clientId),
    [clients, clientId],
  );

  const startEdit = (assignment: any) => {
    setEditingId(assignment.id);
    setClientId(String(assignment.clientAccountId));
    setType(assignment.type);
    setTitle(assignment.title);
    setContent(assignment.content);
    setDueDate(assignment.dueDate ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!clientId || !title.trim() || !content.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Choose a client and enter a title and assignment.',
      });
      return;
    }

    const payload = {
      clientAccountId: Number(clientId),
      type,
      title: title.trim(),
      content: content.trim(),
      dueDate: dueDate || null,
    };

    if (editingId !== null) {
      updateAssignment.mutate(
        {
          id: editingId,
          type: payload.type,
          title: payload.title,
          content: payload.content,
          dueDate: payload.dueDate,
        },
        {
          onSuccess: () => {
            refresh();
            resetForm();
            toast({ title: 'Assignment updated' });
          },
          onError: () =>
            toast({
              variant: 'destructive',
              title: 'Update failed',
              description: 'Please try again.',
            }),
        },
      );
    } else {
      createAssignment.mutate(payload, {
        onSuccess: () => {
          refresh();
          resetForm();
          toast({ title: 'Assignment created' });
        },
        onError: () =>
          toast({
            variant: 'destructive',
            title: 'Creation failed',
            description: 'Please try again.',
          }),
      });
    }
  };

  const remove = (id: number) => {
    if (!window.confirm('Delete this wellness assignment?')) return;

    deleteAssignment.mutate(id, {
      onSuccess: () => {
        refresh();
        if (editingId === id) resetForm();
        toast({ title: 'Assignment deleted' });
      },
      onError: () =>
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: 'Please try again.',
        }),
    });
  };

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-muted-foreground">Client care tools</p>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Wellness Journey
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Assign personalized wellness journeys, notebook prompts, and homework
          for clients to complete between sessions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId !== null ? (
                <Pencil className="h-5 w-5 text-primary" />
              ) : (
                <Plus className="h-5 w-5 text-primary" />
              )}
              {editingId !== null ? 'Edit assignment' : 'Create assignment'}
            </CardTitle>
            <CardDescription>
              Assignments are created by staff and are visible to the selected client.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label>Client</Label>

                <Input
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Search by client name, confirmation code, or phone..."
                  className="mb-2"
                  aria-label="Search clients by name, confirmation code, or phone number"
                />

                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => {
                      const latestBooking = client.bookings?.[client.bookings.length - 1];
                      return (
                        <SelectItem
                          key={client.clientAccountId}
                          value={String(client.clientAccountId)}
                        >
                          {client.clientName} — {client.phone}
                          {latestBooking?.confirmationCode ? ` — ${latestBooking.confirmationCode}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {selectedClient && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedClient.clientName} · {selectedClient.phone}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Assignment type</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as AssignmentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wellness_journey">Wellness Journey</SelectItem>
                    <SelectItem value="notebook">Notebook</SelectItem>
                    <SelectItem value="homework">Homework</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Evening reflection"
                />
              </div>

              <div className="space-y-2">
                <Label>Instructions / content</Label>
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write the activity, reflection prompt, or homework instructions…"
                  className="min-h-40"
                />
              </div>

              <div className="space-y-2">
                <Label>Due date <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={createAssignment.isPending || updateAssignment.isPending}
                >
                  {editingId !== null ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingId !== null ? 'Save changes' : 'Assign to client'}
                </Button>

                {editingId !== null && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel editing
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Assigned activities</CardTitle>
            <CardDescription>
              {assignments.length} assignment{assignments.length === 1 ? '' : 's'} across your clients.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading assignments…</p>
            ) : assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No assignments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the first wellness activity using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment: any) => {
                  const Icon = typeIcons[assignment.type as AssignmentType] ?? BookOpen;
                  const client = clients.find(
                    (item) => item.clientAccountId === assignment.clientAccountId,
                  );

                  return (
                    <div
                      key={assignment.id}
                      className="rounded-2xl border p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{assignment.title}</h3>
                              <Badge variant="secondary">
                                {typeLabels[assignment.type as AssignmentType] ?? assignment.type}
                              </Badge>
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                              {client?.clientName ?? `Client #${assignment.clientAccountId}`}
                            </p>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                              {assignment.content}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2.5 py-1 capitalize">
                                {assignment.status.replace('_', ' ')}
                              </span>
                              {assignment.dueDate && (
                                <span className="rounded-full bg-muted px-2.5 py-1">
                                  Due {assignment.dueDate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(assignment)}
                            aria-label="Edit assignment"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => remove(assignment.id)}
                            aria-label="Delete assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
