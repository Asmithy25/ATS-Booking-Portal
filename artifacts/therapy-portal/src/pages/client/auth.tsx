import { useState } from 'react';
import { useLocation } from 'wouter';
import { useClientLogin, useClientSignup, getClientMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, HeartHandshake, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';

export default function ClientAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const finish = (name: string) => {
    queryClient.invalidateQueries({ queryKey: getClientMeQueryKey() });
    toast({ title: mode === 'login' ? 'Welcome back' : 'Your account is ready', description: `Good to see you, ${name}.` });
    setLocation('/portal');
  };
  const login = useClientLogin({ mutation: { onSuccess: (data) => finish(data.client.name), onError: (error) => toast({ variant: 'destructive', title: 'Could not sign in', description: (error as any)?.data?.error ?? 'Please check your details.' }) } });
  const signup = useClientSignup({ mutation: { onSuccess: (data) => finish(data.client.name), onError: (error) => toast({ variant: 'destructive', title: 'Could not create account', description: (error as any)?.data?.error ?? 'Please check your details.' }) } });
  const pending = login.isPending || signup.isPending;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Ayden's Therapy Services
        </Link>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
          <section className="max-w-xl">
            <img src={logoUrl} alt="Ayden's Therapy Services" className="mb-5 h-16 w-16 rounded-2xl object-cover shadow-md" />
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-primary">A private space for your care</p>
            <h1 className="mb-5 text-4xl font-semibold leading-tight sm:text-6xl">Stay connected to your healing journey.</h1>
            <p className="text-lg leading-8 text-muted-foreground">View appointments, keep your information current, reach support, and find gentle resources whenever you need them.</p>
          </section>
          <Card className="rounded-3xl border-primary/10 shadow-xl">
            <CardHeader>
              <div className="mb-4 flex gap-2 rounded-xl bg-muted p-1">
                <button onClick={() => setMode('login')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}>Sign in</button>
                <button onClick={() => setMode('signup')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'signup' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}>Create account</button>
              </div>
              <CardTitle>{mode === 'login' ? 'Welcome back' : 'Create your client account'}</CardTitle>
              <CardDescription>{mode === 'login' ? 'Use the email connected to your care.' : 'Your account keeps your appointments and support in one place.'}</CardDescription>
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
                </>}
                <div className="space-y-2"><Label htmlFor="client-email">Email</Label><Input id="client-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="client-password">Password</Label><Input id="client-password" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
                <Button className="h-11 w-full rounded-xl" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'login' ? 'Sign in securely' : 'Create my account'}</Button>
              </form>
              <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">Your client portal is for care coordination and is not monitored for emergencies.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}