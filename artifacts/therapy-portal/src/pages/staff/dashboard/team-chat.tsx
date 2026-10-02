import { useEffect, useMemo, useState } from 'react';
import { useGetAuthMe, customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Hash, Heart, MessageCircle, Pin, Plus, Search, Send, ThumbsUp, UsersRound, Check } from 'lucide-react';

type Channel = { id: string; label: string; description: string; unread: number; active: boolean };
type Message = { id: number; authorName: string; body: string; createdAt: string; pinned?: boolean; metadata?: { reactions?: Record<string, string[]>; replyToId?: number | null; mentions?: string[] } };
type SearchResult = Message & { channelId: string };

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

export default function TeamChat() {
  const { data: session } = useGetAuthMe();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ label: '', description: '' });

  const canManage = session?.role === 'founder' || session?.role === 'manager' || session?.isAdmin;
  const channel = useMemo(() => channels.find((item) => item.id === channelId) ?? channels[0], [channels, channelId]);

  const loadChannels = async () => {
    try {
      const data = await customFetch<Channel[]>('/api/workspace/chat/channels');
      setChannels(Array.isArray(data) ? data : []);
    } catch { setChannels([]); }
  };

  const loadMessages = async (id = channelId) => {
    if (!id) return;
    try {
      const data = await customFetch<Message[]>('/api/workspace/chat?channel=' + encodeURIComponent(id));
      setMessages(Array.isArray(data) ? data : []);
      await customFetch('/api/workspace/chat/read', { method: 'POST', body: JSON.stringify({ channel: id }) }).catch(() => undefined);
      setChannels((items) => items.map((item) => item.id === id ? { ...item, unread: 0 } : item));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load chat', description: err instanceof Error ? err.message : 'Please refresh.' });
    }
  };

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { loadMessages(channelId); }, [channelId]);

  const send = async () => {
    if (!body.trim() || !channel) return;
    try {
      await customFetch('/api/workspace/chat', { method: 'POST', body: JSON.stringify({ channel: channel.id, body, replyToId }) });
      setBody('');
      setReplyToId(null);
      await loadMessages(channelId);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Message could not be sent', description: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  const react = async (id: number, reaction: string) => {
    try { await customFetch('/api/workspace/chat/' + id + '/reaction', { method: 'POST', body: JSON.stringify({ reaction }) }); await loadMessages(channel.id); }
    catch { toast({ variant: 'destructive', title: 'Reaction could not be updated' }); }
  };

  const togglePin = async (item: Message) => {
    try { await customFetch('/api/workspace/chat/' + item.id + '/pin', { method: 'PATCH', body: JSON.stringify({ pinned: !item.pinned }) }); await loadMessages(channel.id); }
    catch { toast({ variant: 'destructive', title: 'Pin could not be updated' }); }
  };

  const runSearch = async () => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    try {
      const data = await customFetch<SearchResult[]>('/api/workspace/chat/search?q=' + encodeURIComponent(search.trim()));
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
  };

  const createChannel = async () => {
    const label = newChannel.label.trim();
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id) return;
    try {
      await customFetch('/api/workspace/chat/channels', { method: 'POST', body: JSON.stringify({ id, label, description: newChannel.description }) });
      setNewChannel({ label: '', description: '' });
      setAddingChannel(false);
      await loadChannels();
      setChannelId(id);
      toast({ title: 'Channel created' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not create channel', description: err instanceof Error ? err.message : 'Choose another name.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">A staff-only room for conversation, coordination, and quick connection.</p>
        <h1 className="text-3xl font-semibold">Team chat</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Reactions, pinned notes, mentions, unread counts, search, replies, and manager-controlled channels now live here.</p>
      </div>

      <Card className="overflow-hidden rounded-[1.5rem] border-primary/15 shadow-sm">
        <div className="grid min-h-[680px] lg:grid-cols-[250px_1fr]">
          <aside className="border-b bg-[#5B422F] p-4 text-[#F7EBDD] lg:border-b-0 lg:border-r lg:border-[#E7C9A3]/20">
            <div className="flex items-center justify-between gap-3 border-b border-[#E7C9A3]/20 pb-4">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-[#E6C27A]/20 p-2 text-[#F3D99A]"><UsersRound className="h-5 w-5" /></div><div><p className="font-semibold">Care team</p><p className="text-xs text-[#E7C9A3]/75">Staff chatroom</p></div></div>
              {canManage && <Button size="icon" variant="ghost" className="text-[#F7EBDD] hover:bg-[#80624A] hover:text-white" onClick={() => setAddingChannel((v) => !v)} aria-label="Add channel"><Plus className="h-4 w-4" /></Button>}
            </div>
            {addingChannel && <div className="mt-4 space-y-2 rounded-xl border border-[#E7C9A3]/20 bg-[#80624A]/40 p-3"><Input value={newChannel.label} onChange={(e) => setNewChannel((v) => ({ ...v, label: e.target.value }))} placeholder="Channel name" /><Input value={newChannel.description} onChange={(e) => setNewChannel((v) => ({ ...v, description: e.target.value }))} placeholder="Short description" /><Button size="sm" className="w-full bg-[#E6C27A] text-[#4D3728] hover:bg-[#F0D38E]" onClick={createChannel}>Create channel</Button></div>}
            <div className="mt-5"><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#E7C9A3]/70">Channels</p><div className="space-y-1">
              {channels.map((item) => <button key={item.id} type="button" onClick={() => setChannelId(item.id)} className={'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ' + (channelId === item.id ? 'bg-[#E6C27A] text-[#4D3728]' : 'text-[#F7EBDD] hover:bg-[#80624A]/60')}><Hash className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.label}</span><span className={'mt-0.5 block truncate text-[11px] ' + (channelId === item.id ? 'text-[#664A22]/80' : 'text-[#E7C9A3]/70')}>{item.description}</span></span>{item.unread > 0 && <span className="rounded-full bg-[#E6C27A] px-1.5 py-0.5 text-[9px] font-bold text-[#4D3728]">{item.unread}</span>}</button>)}
            </div></div>
          </aside>

          <section className="flex min-w-0 flex-col bg-background">
            <CardHeader className="flex flex-col gap-3 border-b bg-card/75 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Hash className="h-5 w-5" /></div><div className="min-w-0"><CardTitle className="truncate text-lg">{channel?.label ?? 'Team chat'}</CardTitle><p className="mt-0.5 truncate text-xs text-muted-foreground">{channel?.description}</p></div></div>
              <div className="flex items-center gap-2"><Badge variant="secondary" className="hidden rounded-full sm:inline-flex">Staff only</Badge><Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSearchOpen((v) => !v)} aria-label="Search chat"><Search className="h-4 w-4" /></Button></div>
            </CardHeader>

            {searchOpen && <div className="border-b bg-muted/20 p-3"><div className="flex gap-2"><Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} placeholder="Search team messages…" /><Button onClick={runSearch}>Search</Button></div>{searchResults.length > 0 && <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{searchResults.map((item) => <button key={item.id} type="button" className="w-full rounded-xl border bg-card p-3 text-left" onClick={() => { setChannelId(item.channelId); setSearchOpen(false); }}><p className="text-xs font-semibold text-primary">{item.authorName} · #{item.channelId}</p><p className="mt-1 line-clamp-2 text-sm">{item.body}</p></button>)}</div>}</div>}

            <CardContent className="flex flex-1 flex-col p-0">
              <div className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(hsl(28_28%_63%/.12)_1px,transparent_1px)] bg-[size:18px_18px] p-5">
                {messages.some((item) => item.pinned) && <div className="mb-2 rounded-2xl border border-primary/15 bg-primary/[0.045] p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary">Pinned</p>{messages.filter((item) => item.pinned).slice(-2).map((item) => <div key={item.id} className="text-sm"><span className="font-semibold">{item.authorName}:</span> {item.body}</div>)}</div>}
                {messages.length ? messages.map((item) => {
                  const own = item.authorName === session?.staffName;
                  const reactions = item.metadata?.reactions ?? {};
                  const replyTarget = item.metadata?.replyToId ? messages.find((message) => message.id === item.metadata?.replyToId) : null;
                  return <div key={item.id} className={'flex gap-3 ' + (own ? 'flex-row-reverse' : '')}>
                    <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' + (own ? 'bg-primary text-primary-foreground' : 'bg-[#D8C4A8] text-[#5B422F]')}>{initials(item.authorName)}</div>
                    <div className={'flex max-w-[min(82%,620px)] flex-col ' + (own ? 'items-end' : 'items-start')}>
                      <div className={'mb-1 flex items-center gap-2 text-xs text-muted-foreground ' + (own ? 'flex-row-reverse' : '')}><span className="font-medium text-foreground">{item.authorName}</span><span>{new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>{item.pinned && <Pin className="h-3 w-3 text-primary" />}</div>
                      <div className={'rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ' + (own ? 'rounded-tr-md bg-primary text-primary-foreground' : 'rounded-tl-md border border-border/60 bg-card')}>
                        {replyTarget && <div className={'mb-2 border-l-2 pl-3 text-xs opacity-75 ' + (own ? 'border-primary-foreground/50' : 'border-primary/30')}><span className="font-semibold">{replyTarget.authorName}</span>: {replyTarget.body.slice(0, 100)}</div>}
                        {item.body}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <button onClick={() => react(item.id, 'heart')} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] hover:bg-muted"><Heart className="h-3 w-3" />{reactions.heart?.length || ''}</button>
                        <button onClick={() => react(item.id, 'thumbs_up')} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] hover:bg-muted"><ThumbsUp className="h-3 w-3" />{reactions.thumbs_up?.length || ''}</button>
                        <button onClick={() => react(item.id, 'check')} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] hover:bg-muted"><Check className="h-3 w-3" />{reactions.check?.length || ''}</button>
                        <button onClick={() => setReplyToId(item.id)} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] hover:bg-muted"><MessageCircle className="h-3 w-3" />Reply</button>
                        {canManage && <button onClick={() => togglePin(item)} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] hover:bg-muted"><Pin className="h-3 w-3" />{item.pinned ? 'Unpin' : 'Pin'}</button>}
                      </div>
                    </div>
                  </div>;
                }) : <div className="flex min-h-64 flex-col items-center justify-center text-center"><div className="rounded-2xl bg-primary/10 p-4 text-primary"><MessageCircle className="h-7 w-7" /></div><p className="mt-4 font-medium">Start the conversation</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Share something useful with the team in #{channel?.label?.toLowerCase()}.</p></div>}
              </div>
              <div className="border-t bg-card/80 p-4">
                {replyToId && <div className="mb-2 flex items-center justify-between rounded-xl bg-primary/[0.045] px-3 py-2 text-xs"><span>Replying to {messages.find((item) => item.id === replyToId)?.authorName ?? 'message'}</span><button onClick={() => setReplyToId(null)} className="font-semibold text-primary">Cancel</button></div>}
                <div className="rounded-2xl border border-primary/20 bg-background p-2 shadow-sm"><Textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Message the team… Use @Name to mention someone." className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between gap-3 px-2 pb-1"><p className="text-xs text-muted-foreground">Enter to send · Shift + Enter for a new line</p><Button className="rounded-xl" disabled={!body.trim()} onClick={() => void send()}><Send className="h-4 w-4" />Send</Button></div></div>
              </div>
            </CardContent>
          </section>
        </div>
      </Card>
    </div>
  );
}
