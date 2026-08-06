import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getClientTemplatesQueryKey,
  useClientTemplates,
  useCreateClientTemplate,
  useDeleteClientTemplate,
  useUpdateClientTemplate,
} from '@workspace/api-client-react';
import type { ClientTemplate } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarX,
  Clock3,
  Copy,
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
  { key: 'file-text', label: 'Document', Icon: FileText },
  { key: 'heart', label: 'Heart', Icon: Heart },
  { key: 'heart-handshake', label: 'Care', Icon: HeartHandshake },
  { key: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'calendar-check', label: 'Confirmed', Icon: CalendarCheck },
  { key: 'calendar-x', label: 'Cancelled', Icon: CalendarX },
  { key: 'clock-3', label: 'Clock', Icon: Clock3 },
  { key: 'bell', label: 'Reminder', Icon: Bell },
  { key: 'megaphone', label: 'Update', Icon: Megaphone },
  { key: 'message-circle', label: 'Message', Icon: MessageCircle },
  { key: 'mail', label: 'Mail', Icon: Mail },
  { key: 'phone', label: 'Phone', Icon: Phone },
  { key: 'shield-check', label: 'Secure', Icon: ShieldCheck },
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'party-popper', label: 'Celebration', Icon: PartyPopper },
];

const ICONS_BY_KEY = Object.fromEntries(ICON_OPTIONS.map((option) => [option.key, option.Icon]));

function TemplateIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS_BY_KEY[icon] ?? FileText;
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

type TemplateDraft = { label: string; icon: string; body: string };

export default function ClientTemplates() {
  const { data = [], isLoading, error } = useClientTemplates();
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState<TemplateDraft>({
    label: '',
    icon: 'file-text',
    body: '',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const update = useUpdateClientTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getClientTemplatesQueryKey() });
        toast({ title: 'Client template saved' });
      },
      onError: (err) => toast({
        variant: 'destructive',
        title: 'Could not save client template',
        description: (err as any)?.data?.error ?? 'Please try again.',
      }),
    },
  });
  const create = useCreateClientTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getClientTemplatesQueryKey() });
        setNewTemplate({ label: '', icon: 'file-text', body: '' });
        setShowCreate(false);
        toast({ title: 'Custom client template created' });
      },
      onError: (err) => toast({
        variant: 'destructive',
        title: 'Could not create client template',
        description: (err as any)?.data?.error ?? 'Please try again.',
      }),
    },
  });
  const remove = useDeleteClientTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getClientTemplatesQueryKey() });
        toast({ title: 'Custom client template deleted' });
      },
      onError: (err) => toast({
        variant: 'destructive',
        title: 'Could not delete client template',
        description: (err as any)?.data?.error ?? 'Please try again.',
      }),
    },
  });

  const valueFor = (item: ClientTemplate): TemplateDraft => drafts[item.key] ?? {
    label: item.label,
    icon: item.icon || 'file-text',
    body: item.body,
  };
  const updateDraft = (key: string, value: TemplateDraft) => setDrafts((current) => ({ ...current, [key]: value }));
  const copy = async (key: string, body: string) => {
    await navigator.clipboard.writeText(body);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Standalone copy library</p>
          <h1 className="text-3xl font-semibold">Client Templates</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Maintain copy-and-paste resources for client care. These templates are separate from Support and are never sent automatically.
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
            <CardTitle>Create a custom Client Template</CardTitle>
            <CardDescription>Create a reusable care resource for staff to copy when supporting clients.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); create.mutate(newTemplate); }}>
              <div className="space-y-2">
                <Label htmlFor="new-client-template-label">Template name</Label>
                <Input
                  id="new-client-template-label"
                  value={newTemplate.label}
                  onChange={(event) => setNewTemplate({ ...newTemplate, label: event.target.value })}
                  placeholder="For example, Post-session reflection"
                  required
                />
              </div>
              <IconPicker value={newTemplate.icon} onChange={(icon) => setNewTemplate({ ...newTemplate, icon })} />
              <div className="space-y-2">
                <Label htmlFor="new-client-template-body">Copyable text</Label>
                <Textarea
                  id="new-client-template-body"
                  className="min-h-36 bg-background"
                  value={newTemplate.body}
                  onChange={(event) => setNewTemplate({ ...newTemplate, body: event.target.value })}
                  placeholder="Write your reusable client-care text here…"
                  required
                />
              </div>
              <Button disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create template'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading client templates…</p>
      ) : error ? (
        <Card><CardContent className="p-6 text-destructive">Client Templates are unavailable for your account.</CardContent></Card>
      ) : (
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
                    {isCustom ? 'Custom template' : 'Built-in template'} · Copy this text into a note, document, or external message.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template name</Label>
                    <Input value={value.label} onChange={(event) => updateDraft(item.key, { ...value, label: event.target.value })} />
                  </div>
                  <IconPicker value={value.icon} onChange={(icon) => updateDraft(item.key, { ...value, icon })} />
                  <div className="space-y-2">
                    <Label>Copyable text</Label>
                    <Textarea className="min-h-36" value={value.body} onChange={(event) => updateDraft(item.key, { ...value, body: event.target.value })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => copy(item.key, value.body)}>
                      <Copy className="h-4 w-4" /> {copied === item.key ? 'Copied' : 'Copy text'}
                    </Button>
                    <Button type="button" disabled={update.isPending} onClick={() => update.mutate({ key: item.key, data: value })}>
                      <Save className="h-4 w-4" /> Save template
                    </Button>
                    {isCustom && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => { if (window.confirm(`Delete “${value.label}”?`)) remove.mutate(item.key); }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}