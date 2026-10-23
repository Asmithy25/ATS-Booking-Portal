import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Droplets, Footprints, Heart, Leaf, Sparkles, Wind } from 'lucide-react';

const MOODS = [
  { id: 'steady', label: 'Grounded', detail: 'I feel mostly steady.' },
  { id: 'okay', label: 'Okay', detail: 'I am taking things as they come.' },
  { id: 'on-edge', label: 'On edge', detail: 'I could use a little calm.' },
  { id: 'overloaded', label: 'Overloaded', detail: 'A lot is sitting on me.' },
  { id: 'low-energy', label: 'Low energy', detail: 'I need gentleness today.' },
];

const RESET_ACTIONS = [
  { id: 'breath', title: 'Take five slow breaths', detail: 'Unclench your jaw, soften your shoulders, and breathe at your own pace.', Icon: Wind },
  { id: 'water', title: 'Have a glass of water', detail: 'A tiny act of care still counts.', Icon: Droplets },
  { id: 'movement', title: 'Move for two minutes', detail: 'Stretch, step outside, or take a short walk if it feels right.', Icon: Footprints },
  { id: 'pause', title: 'Take a quiet pause', detail: 'Put one task down and give yourself a moment without fixing anything.', Icon: Leaf },
];

const AFFIRMATIONS = [
  'You do not have to solve the whole day at once.',
  'Small steps still move you forward.',
  'Rest is part of rebuilding, not a reward you have to earn.',
  'You can meet this moment one breath at a time.',
  'Progress can be quiet and still be real.',
  'You are allowed to begin again without being hard on yourself.',
  'You can choose the next kind thing, not every answer.',
];

export default function DailyResetCard() {
  const [mood, setMood] = useState('');
  const [reflection, setReflection] = useState('');
  const [action, setAction] = useState('');
  const [complete, setComplete] = useState(false);
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 0).getTime();
  const day = Math.floor((today.getTime() - start) / 86_400_000);
  const affirmation = AFFIRMATIONS[day % AFFIRMATIONS.length];
  const chosenAction = RESET_ACTIONS.find((item) => item.id === action);

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2"><Badge className="border border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-200">DAILY RESET</Badge><span className="text-xs text-muted-foreground">A small pause for you</span></div>
        <CardTitle className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-primary" /> Start with yourself</CardTitle>
        <CardDescription>There is no perfect mood to have and no score to earn. Just notice where you are and choose one gentle next step.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-primary/15 bg-background/75 p-4">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Today's reminder</p>
          <p className="mt-2 font-serif text-xl leading-7">“{affirmation}”</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">How are you arriving today?</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MOODS.map((item) => (
              <button type="button" key={item.id} aria-pressed={mood === item.id} onClick={() => { setMood(item.id); setComplete(false); }} className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mood === item.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/70 bg-background/60 hover:border-primary/35'}`}>
                <span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Pick one small reset</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {RESET_ACTIONS.map(({ id, title, detail, Icon }) => (
              <button type="button" key={id} aria-pressed={action === id} onClick={() => { setAction(id); setComplete(false); }} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${action === id ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/60 hover:border-primary/35'}`}>
                <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
                <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="aws-daily-reflection" className="text-sm font-semibold">One thing you need from yourself today (optional)</label>
          <Textarea id="aws-daily-reflection" value={reflection} onChange={(event) => { setReflection(event.target.value); setComplete(false); }} maxLength={500} rows={2} placeholder="Be patient with myself, ask for help, take one thing at a time…" />
          <p className="text-xs text-muted-foreground">This reflection stays in this page only. It is not sent to AWS or saved to your account, and clears when you leave or refresh.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">A tiny reset is enough. Skip anything that does not feel right for you.</p>
          <Button type="button" onClick={() => setComplete(true)} disabled={!mood || !action} className="shrink-0">
            {complete ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Reset acknowledged</> : <><Heart className="mr-2 h-4 w-4" /> Mark my reset</>}
          </Button>
        </div>
        {complete && chosenAction && <p role="status" className="rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-sm">You checked in and chose: <strong>{chosenAction.title.toLowerCase()}</strong>. Take it at your own pace.</p>}
      </CardContent>
    </Card>
  );
}
