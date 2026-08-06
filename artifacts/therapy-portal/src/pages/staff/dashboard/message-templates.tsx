import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMessageTemplatesQueryKey,
  useCreateMessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpdateMessageTemplate,
} from '@workspace/api-client-react';
import type { MessageTemplate } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarX,
  Clock3,
  FileText,
  Heart,
  HeartHandshake,
  Mail,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_OPTIONS: Array<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: 'mail', label: 'Mail', Icon: Mail },
  { key: 'bell', label: 'Reminder', Icon: Bell },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'calendar-check', label: 'Confirmed', Icon: CalendarCheck },
  { key: 'calendar-x', label: 'Cancelled', Icon: CalendarX },
  { key: 'clock-3', label: 'Clock', Icon: Clock3 },
  { key: 'heart-handshake', label: 'Care', Icon: HeartHandshake },
  { key: 'heart', label: 'Heart', Icon: Heart },
  { key: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { key: 'megaphone', label: 'Update', Icon: Megaphone },
  { key: 'message-circle', label: 'Message', Icon: MessageCircle },
  { key: 'phone', label: 'Phone', Icon: Phone },
  { key: 'shield-check', label: 'Secure', Icon: ShieldCheck },
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'party-popper', label: 'Celebration', Icon: PartyPopper },
  { key: 'file-text', label: 'Document', Icon: FileText },
];

const ICONS_BY_KEY = Object.fromEntries(ICON_OPTIONS.map((option) => [option.key, option.Icon]));

function TemplateIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS_BY_KEY[icon] ?? Mail;
  return <Icon className={className} />;
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Choose an icon</Label>
      <div className="grid grid-cols-4 gap-2 rounded-2xl border bg-background p-3 sm:grid-cols-8">
        {ICON_OPTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={`Choose ${label} icon`}
            onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] transition-colors ${
              value === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

type TemplateDraft = {
  label: string;
  icon: string;
  subject: string;
  body: string;
};

export default function MessageTemplates() {
  const { data = [], isLoading, error } = useMessageTemplates();
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState<TemplateDraft>({
    label: '',
    icon: 'mail',
    subject: '',
    body: '',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const update = useUpdateMessageTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMessageTemplatesQueryKey() });
        toast({ title: 'Message template saved' });
      },
      onError: (err) => toast({
        variant: 'destructive',
        title: 'Could not save template',
        description: (err as any)?.data?.error ?? 'Please try again.',
      }),
    },
  });

  const create = useCreateMessageTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMessageTemplatesQueryKey() });
        setNewTemplate({ label: '', icon: 'mail', subject: '', body: '' });
        setShowCreate(false);
        toast({ title: 'Custom template created' });
      },
      onError: (err) => toast({
        variant: 'destructive',
        title: 'Could not create template',
        description: (err as any)?.data?.error ?? 'Please try again.',
      }),
    },
  });

  const remove = useDeleteMessageTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMessageTemplatesQueryKey() });
        toast({ title: 'Custom template deleted' });
      },
      onError: (err) => toast({
        variant: 'destructive',
        title: 'Could not delete template',
        description: (err as any)?.data?.error ?? 'Please try again.',
      }),
    },
  });

  const valueFor = (item: MessageTemplate): TemplateDraft => drafts[item.key] ?? {
    label: item.label,
    icon: item.icon || 'mail',
    subject: item.subject,
    body: item.body,
  };

  const updateDraft = (key: string, value: TemplateDraft) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Client communication</p>
          <h1 className="text-3xl font-semibold">Message templates</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Customize reusable replies and create your own templates. Choose an icon to make each message easy to recognize in Support.
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreate((value) => !value)}>
          <Sparkles className="h-4 w-4" />
          {showCreate ? 'Close creator' : 'Create custom template'}
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Create a custom template</CardTitle>
            <CardDescription>
              Custom templates are available in the Support inbox just like built-in templates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate(newTemplate);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-template-label">Template name</Label>
                  <Input
                    id="new-template-label"
                    value={newTemplate.label}
                    onChange={(event) => setNewTemplate({ ...newTemplate, label: event.target.value })}
                    placeholder="For example, Follow-up check-in"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-template-subject">Subject</Label>
                  <Input
                    id="new-template-subject"
                    value={newTemplate.subject}
                    onChange={(event) => setNewTemplate({ ...newTemplate, subject: event.target.value })}
                    placeholder="A thoughtful subject line"
                    required
                  />
                </div>
              </div>
              <IconPicker value={newTemplate.icon} onChange={(icon) => setNewTemplate({ ...newTemplate, icon })} />
              <div className="space-y-2">
                <Label htmlFor="new-template-body">Message</Label>
                <Textarea
                  id="new-template-body"
                  className="min-h-32 bg-background"
                  value={newTemplate.body}
                  onChange={(event) => setNewTemplate({ ...newTemplate, body: event.target.value })}
                  placeholder="Write your reusable message here…"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{{clientName}}'}, {'{{date}}'}, and {'{{time}}'} for personalized Support replies.
                </p>
              </div>
              <Button disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create template'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : error ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-destructive">Message templates are unavailable for your account.</CardContent>
        </Card>
      ) : data.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.map((item) => {
            const value = valueFor(item);
            const isCustom = item.key.startsWith('custom_');
            return (
              <Card key={item.key} className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TemplateIcon icon={value.icon} className="h-5 w-5" />
                    </span>
                    {value.label}
                  </CardTitle>
                  <CardDescription>
                    {isCustom ? 'Custom template' : 'Built-in template'} · Use {'{{clientName}}'}, {'{{date}}'}, and {'{{time}}'} for personalized messages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template name</Label>
                    <Input value={value.label} onChange={(event) => updateDraft(item.key, { ...value, label: event.target.value })} />
                  </div>
                  <IconPicker value={value.icon} onChange={(icon) => updateDraft(item.key, { ...value, icon })} />
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input value={value.subject} onChange={(event) => updateDraft(item.key, { ...value, subject: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea className="min-h-32" value={value.body} onChange={(event) => updateDraft(item.key, { ...value, body: event.target.value })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={update.isPending}
                      onClick={() => update.mutate({ key: item.key, data: value })}
                    >
                      <Save className="h-4 w-4" />
                      Save template
                    </Button>
                    {isCustom && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete “${value.label}”?`)) remove.mutate(item.key);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">Templates will appear here after they are initialized.</CardContent>
        </Card>
      )}
    </div>
  );
}