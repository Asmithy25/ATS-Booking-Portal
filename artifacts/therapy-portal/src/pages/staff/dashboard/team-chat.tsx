import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getCollaborationQueryKey,
  useCollaboration,
  useCreateCollaboration,
  useGetAuthMe,
  type CollaborationItem,
} from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Hash,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Search,
  Send,
  UsersRound,
} from 'lucide-react';

const CHANNELS = [
  { id: 'general', label: 'General', description: 'Everyday team conversation' },
  { id: 'care-coordination', label: 'Care coordination', description: 'Handoffs and client care' },
  { id: 'announcements', label: 'Announcements', description: 'Practice-wide updates' },
] as const;

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function TeamChat() {
  const [channelId, setChannelId] = useState<(typeof CHANNELS)[number]['id']>('general');
  const [body, setBody] = useState('');
  const { data = [], isLoading } = useCollaboration('chat');
  const { data: session } = useGetAuthMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const channel = CHANNELS.find((item) => item.id === channelId) ?? CHANNELS[0];

  const messages = useMemo(
    () => data.filter((item) => item.title === channel.label || (!item.title && channel.id === 'general')),
    [channel.id, channel.label, data],
  );

  const create = useCreateCollaboration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getCollaborationQueryKey('chat') });
        setBody('');
        toast({ title: 'Message posted', description: `Shared in ${channel.label}.` });
      },
      onError: (error) => toast({
        variant: 'destructive',
        title: 'Message could not be posted',
        description: (error as { data?: { error?: string } })?.data?.error ?? 'Please try again.',
      }),
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">A calm room for quick team connection</p>
        <h1 className="text-3xl font-semibold">Team chat</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Keep conversations, care coordination, and practice updates together without mixing them into tasks or shift notes.
        </p>
      </div>

      <Card className="overflow-hidden rounded-[1.5rem] border-primary/15 shadow-sm">
        <div className="grid min-h-[610px] lg:grid-cols-[240px_1fr]">
          <aside className="border-b bg-[#5B422F] p-4 text-[#F7EBDD] lg:border-b-0 lg:border-r lg:border-[#E7C9A3]/20">
            <div className="flex items-center gap-3 border-b border-[#E7C9A3]/20 pb-4">
              <div className="rounded-xl bg-[#E6C27A]/20 p-2 text-[#F3D99A]">
                <UsersRound className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Care team</p>
                <p className="text-xs text-[#E7C9A3]/75">Staff chatroom</p>
              </div>
            </div>
            <div className="mt-5">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#E7C9A3]/70">Channels</p>
              <div className="space-y-1">
                {CHANNELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChannelId(item.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${channelId === item.id ? 'bg-[#E6C27A] text-[#4D3728]' : 'text-[#F7EBDD] hover:bg-[#80624A]/60'}`}
                  >
                    <Hash className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className={`mt-0.5 block truncate text-[11px] ${channelId === item.id ? 'text-[#664A22]/80' : 'text-[#E7C9A3]/70'}`}>{item.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="flex min-w-0 flex-col bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-card/75 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><Hash className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">{channel.label}</CardTitle>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{channel.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="hidden rounded-full sm:inline-flex"><UsersRound className="mr-1 h-3 w-3" /> Staff only</Badge>
                <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Search chat"><Search className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Chat options"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col p-0">
              <div className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(hsl(28_28%_63%/.12)_1px,transparent_1px)] bg-[size:18px_18px] p-5">
                <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-primary/10 bg-card/80 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm">
                  <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Keep this room focused, kind, and useful for the team.
                </div>
                {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading team chat…</p> : messages.length ? messages.map((item: CollaborationItem) => {
                  const ownMessage = item.authorName === session?.staffName;
                  return (
                    <div key={item.id} className={`flex gap-3 ${ownMessage ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ownMessage ? 'bg-primary text-primary-foreground' : 'bg-[#D8C4A8] text-[#5B422F] dark:bg-[#8A6A4A]/50 dark:text-[#F3D99A]'}`}>
                        {initials(item.authorName)}
                      </div>
                      <div className={`max-w-[min(82%,620px)] ${ownMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className={`mb-1 flex items-center gap-2 text-xs text-muted-foreground ${ownMessage ? 'flex-row-reverse' : ''}`}>
                          <span className="font-medium text-foreground">{item.authorName}</span>
                          <span>{new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${ownMessage ? 'rounded-tr-md bg-primary text-primary-foreground' : 'rounded-tl-md border border-border/60 bg-card'}`}>
                          {item.body}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <div className="rounded-2xl bg-primary/10 p-4 text-primary"><MessageCircle className="h-7 w-7" /></div>
                    <p className="mt-4 font-medium">Start the conversation</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">Share a thoughtful update with the team in #{channel.label.toLowerCase()}.</p>
                  </div>
                )}
              </div>
              <div className="border-t bg-card/80 p-4">
                <div className="rounded-2xl border border-primary/20 bg-background p-2 shadow-sm">
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (body.trim()) create.mutate({ kind: 'chat', title: channel.label, body });
                      }
                    }}
                    placeholder={`Message #${channel.label.toLowerCase()}…`}
                    className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-between gap-3 px-2 pb-1">
                    <p className="text-xs text-muted-foreground">Press Enter to send · Shift + Enter for a new line</p>
                    <Button className="rounded-xl" disabled={!body.trim() || create.isPending} onClick={() => create.mutate({ kind: 'chat', title: channel.label, body })}>
                      <Send className="h-4 w-4" /> Send
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </section>
        </div>
      </Card>
    </div>
  );
}