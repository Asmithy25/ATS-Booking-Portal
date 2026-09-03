import { useState } from 'react';
import { useLocation } from 'wouter';
import { useClientLogin, useClientSignup, getClientMeQueryKey, useGetSettings } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowUpRight, HeartHandshake, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';

export default function ClientAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', updatesOptIn: false });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSettings();
  const updatesPreferenceEnabled = settings?.featureFlags?.clientUpdatesOptIn !== false;

  const finish = (name: string) => {
    queryClient.invalidateQueries({ queryKey: getClientMeQueryKey() });
    toast({ title: mode === 'login' ? 'Welcome back' : 'Your account is ready', description: `Good to see you, ${name}.` });
    setLocation('/portal');
  };
  const login = useClientLogin({ mutation: { onSuccess: (data) => finish(data.client.name), onError: (error) => toast({ variant: 'destructive', title: 'Could not sign in', description: (error as any)?.data?.error ?? 'Please check your details.' }) } });
  const signup = useClientSignup({ mutation: { onSuccess: (data) => finish(data.client.name), onError: (error) => toast({ variant: 'destructive', title: 'Could not create account', description: (error as any)?.data?.error ?? 'Please check your details.' }) } });
  const pending = login.isPending || signup.isPending;

  return (
    <main className="min-h-screen bg-[#f7f2e9] px-4 py-8 text-foreground dark:bg-background sm:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive">
          <ArrowLeft className="h-4 w-4" /> Back to Ayden's Therapy Services
        </Link>
        <div className="grid items-stretch gap-12 lg:grid-cols-[1fr_440px]">
          <section className="flex max-w-xl flex-col justify-center">
            <span className="mb-8 flex h-12 w-12 items-center justify-center bg-secondary p-1">
              <img src={logoUrl} alt="Ayden's Therapy Services" className="h-full w-full object-cover mix-blend-multiply" />
            </span>
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">A private space for your care</p>
            <h1 className="mb-6 font-serif text-6xl font-normal leading-[.9] sm:text-8xl">Stay connected to your healing journey.</h1>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">View appointments, keep your information current, reach support, and find gentle resources whenever you need them.</p>
            <div className="mt-10 grid gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /><span>Private coordination with your care team.</span></div>
              <div className="flex items-start gap-3"><HeartHandshake className="mt-0.5 h-4 w-4 text-primary" /><span>Appointments and support in one place.</span></div>
            </div>
          </section>
          <Card className="rounded-sm border-primary/15 shadow-xl">
            <CardHeader>
              <div className="mb-5 flex gap-5 border-b border-border">
                <button onClick={() => setMode('login')} className={`border-b-2 px-0 py-3 text-xs font-bold uppercase tracking-[.1em] ${mode === 'login' ? 'border-destructive text-foreground' : 'border-transparent text-muted-foreground'}`}>Sign in</button>
                <button onClick={() => setMode('signup')} className={`border-b-2 px-0 py-3 text-xs font-bold uppercase tracking-[.1em] ${mode === 'signup' ? 'border-destructive text-foreground' : 'border-transparent text-muted-foreground'}`}>Create account</button>
              </div>
              <CardTitle className="font-serif text-3xl font-normal">{mode === 'login' ? 'Welcome back' : 'Create your client account'}</CardTitle>
              <CardDescription className="leading-6">{mode === 'login' ? 'Use the email connected to your care.' : 'Your account keeps your appointments and support in one place.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                if (mode === 'login') login.mutate({ email: form.email, password: form.password, keepSignedIn: true });
                else signup.mutate(form);
              }}>
                {mode === 'signup' && <>
                  <div className="space-y-2"><Label htmlFor="client-name">Full name</Label><Input id="client-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="client-phone">Phone</Label><Input id="client-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
                  {updatesPreferenceEnabled && <label htmlFor="client-updates-opt-in" className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-muted/30 p-4">
                    <input
                      id="client-updates-opt-in"
                      type="checkbox"
                      checked={form.updatesOptIn}
                      onChange={(event) => setForm({ ...form, updatesOptIn: event.target.checked })}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"
                    />
                    <span>
                      <span className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-primary" /> Receive practice updates</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">Get non-urgent updates from the care team in your client portal. You can change this anytime in Settings.</span>
                    </span>
                  </label>}
                </>}
                <div className="space-y-2"><Label htmlFor="client-email">Email</Label><Input id="client-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="client-password">Password</Label><Input id="client-password" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
                 <Button className="h-11 w-full" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}{mode === 'login' ? 'Sign in securely' : 'Create my account'}</Button>
              </form>
              <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">Your client portal is for care coordination and is not monitored for emergencies.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}