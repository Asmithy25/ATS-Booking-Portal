import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { customFetch } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowUpRight, Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { Link } from 'wouter';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4, 6, or 8 digits').or(z.literal('')),
  keepSignedIn: z.boolean().default(false),
});
type LoginFormValues = z.infer<typeof loginSchema>;

function bytesToBase64Url(value: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [setupToken, setSetupToken] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [passkeyPendingToken, setPasskeyPendingToken] = useState('');
  const [passkeyPin, setPasskeyPin] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [pinLength, setPinLength] = useState<4|6|8>(6);
  useEffect(() => { customFetch<{pinLength:4|6|8}>('/api/auth/staff-pin/policy',{responseType:'json'}).then((value)=>setPinLength(value.pinLength)).catch(()=>undefined); }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', pin: '', keepSignedIn: false },
  });

  const signIn = async (values: LoginFormValues) => {
    try {
      const data = await customFetch<{ success:boolean; staffName:string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
        responseType: 'json',
      });
      if (data.success) {
        toast({ title: 'Welcome back', description: 'Signed in securely.' });
        setLocation('/staff/dashboard');
      }
    } catch (error) {
      const err = error as { status?: number; data?: { error?: string; pinSetupRequired?: boolean; setupToken?: string; staffName?: string; pinLength?: 4|6|8 } };
      if (err.status === 428 && err.data?.pinSetupRequired && err.data.setupToken) {
        setSetupToken(err.data.setupToken);
        setPinLength(err.data.pinLength ?? pinLength);
        setSetupPin('');
        setSetupConfirm('');
        toast({ title: 'Set your staff PIN', description: 'Your account needs a PIN before access can be completed.' });
        return;
      }
      toast({ variant: 'destructive', title: 'Login failed', description: err.data?.error || 'Check your email, password, and staff PIN.' });
    }
  };

  const finishPinSetup = async () => {
    if (setupPin.length!==pinLength || !/^\d+$/.test(setupPin) || setupPin !== setupConfirm) {
      toast({ variant:'destructive', title:'Choose a valid PIN', description:'Use a '+pinLength+'-digit PIN and avoid obvious sequences.' });
      return;
    }
    try {
      await customFetch('/api/auth/staff-pin/setup', {
        method:'POST',
        body:JSON.stringify({ setupToken, pin:setupPin, pinLength }),
        responseType:'json',
      });
      toast({ title:'PIN configured', description:'Your staff session is now active.' });
      setLocation('/staff/dashboard');
    } catch (error) {
      const err = error as { data?: { error?: string } };
      toast({ variant:'destructive', title:'PIN setup failed', description:err.data?.error || 'Please start sign-in again.' });
    }
  };

  const startPasskey = async () => {
    const { email, password } = form.getValues();
    if (!email || !password) {
      toast({ variant:'destructive', title:'Email and password required', description:'Enter your account credentials before using your passkey.' });
      return;
    }
    if (!window.PublicKeyCredential || !navigator.credentials) {
      toast({ variant:'destructive', title:'Passkeys unavailable', description:'This browser does not support device passkeys.' });
      return;
    }
    setPasskeyBusy(true);
    try {
      const options = await customFetch<{
        challenge:string; rpId:string; timeout:number; userVerification:string;
        allowCredentials:{type:'public-key';id:string;transports?:string[]}[];
      }>('/api/advanced/staff/passkey/options', {
        method:'POST',
        body:JSON.stringify({ email, password }),
        responseType:'json',
      });
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: base64UrlToBytes(options.challenge),
          rpId: options.rpId,
          timeout: options.timeout,
          userVerification: 'required',
          allowCredentials: options.allowCredentials.map((item) => ({
            type:'public-key',
            id:base64UrlToBytes(item.id),
            transports:item.transports as AuthenticatorTransport[] | undefined,
          })),
        },
      }) as PublicKeyCredential | null;
      if (!credential) throw new Error('No passkey credential was returned.');
      const assertion = credential.response as AuthenticatorAssertionResponse;
      const verified = await customFetch<{ pendingToken:string }>('/api/advanced/staff/passkey/verify', {
        method:'POST',
        body:JSON.stringify({
          email,
          id:credential.id,
          clientDataJSON:bytesToBase64Url(assertion.clientDataJSON),
          authenticatorData:bytesToBase64Url(assertion.authenticatorData),
          signature:bytesToBase64Url(assertion.signature),
        }),
        responseType:'json',
      });
      setPasskeyPendingToken(verified.pendingToken);
      const existingPin = form.getValues('pin');
      if (/^\d{4,8}$/.test(existingPin)) {
        await customFetch('/api/advanced/staff/passkey/complete',{method:'POST',body:JSON.stringify({pendingToken:verified.pendingToken,pin:existingPin}),responseType:'json'});
        toast({title:'Welcome back',description:'Passkey and PIN verified.'});
        setLocation('/staff/dashboard');
      } else {
        toast({title:'Biometric verified',description:'Enter your staff PIN to finish signing in.'});
      }
    } catch (error) {
      const err = error as { data?: { error?: string } };
      toast({ variant:'destructive', title:'Passkey sign-in failed', description:err.data?.error || (error instanceof Error ? error.message : 'Please use password + PIN sign-in.') });
    } finally { setPasskeyBusy(false); }
  };

  const finishPasskey = async () => {
    if (!passkeyPendingToken || !/^\d{4,8}$/.test(passkeyPin)) return;
    try {
      await customFetch('/api/advanced/staff/passkey/complete',{method:'POST',body:JSON.stringify({pendingToken:passkeyPendingToken,pin:passkeyPin}),responseType:'json'});
      toast({title:'Welcome back',description:'Passkey and PIN verified.'});
      setLocation('/staff/dashboard');
    } catch (error) {
      const err = error as { data?: { error?: string } };
      toast({variant:'destructive',title:'PIN verification failed',description:err.data?.error || 'Enter your current staff PIN.'});
    }
  };

  if (setupToken) {
    return (
      <div className="min-h-screen bg-[#edf0eb] p-4 text-foreground dark:bg-background sm:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
          <section className="w-full rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-12">
            <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4"/> Practice home</Link>
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center bg-secondary p-1"><img src={logoUrl} alt="" className="h-full w-full object-cover mix-blend-multiply"/></span><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">Staff security</p><h1 className="font-serif text-4xl">Set your PIN.</h1></div></div>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">Choose your personal PIN length. Your selection applies only to your staff account.</p>
            <div className="mt-8 space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium">PIN length</label><Select value={String(pinLength)} onValueChange={(value)=>{ const next=Number(value) as 4|6|8; setPinLength(next); setSetupPin(''); setSetupConfirm(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="4">4 digits</SelectItem><SelectItem value="6">6 digits</SelectItem><SelectItem value="8">8 digits</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Create {pinLength}-digit PIN</label><Input inputMode="numeric" maxLength={pinLength} type="password" value={setupPin} onChange={(e)=>setSetupPin(e.target.value.replace(/\D/g,''))} autoComplete="new-password"/></div>
              <div className="space-y-2"><label className="text-sm font-medium">Confirm PIN</label><Input inputMode="numeric" maxLength={pinLength} type="password" value={setupConfirm} onChange={(e)=>setSetupConfirm(e.target.value.replace(/\D/g,''))} autoComplete="new-password"/></div>
              <Button className="w-full" onClick={()=>void finishPinSetup()} disabled={setupPin.length!==pinLength||setupConfirm.length!==pinLength}>Set PIN & continue <ArrowUpRight className="ml-2 h-4 w-4"/></Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (passkeyPendingToken) {
    return (
      <div className="min-h-screen bg-[#edf0eb] p-4 text-foreground dark:bg-background sm:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
          <section className="w-full rounded-2xl border border-border bg-card p-7 shadow-xl sm:p-12">
            <Fingerprint className="h-8 w-8 text-primary"/>
            <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">Second factor required</p>
            <h1 className="mt-2 font-serif text-4xl">Enter your PIN.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Your fingerprint or Face ID was verified. Your staff PIN is still required.</p>
            <div className="mt-6 space-y-2"><label className="text-sm font-medium">Staff PIN</label><Input inputMode="numeric" maxLength={pinLength} type="password" value={passkeyPin} onChange={(e)=>setPasskeyPin(e.target.value.replace(/\D/g,'').slice(0,pinLength))} autoComplete="one-time-code"/></div>
            <Button className="mt-5 w-full" onClick={()=>void finishPasskey()} disabled={passkeyPin.length!==pinLength}>Finish sign in</Button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf0eb] p-4 text-foreground dark:bg-background sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-stretch overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:grid-cols-[1fr_420px]">
        <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div>
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center bg-secondary p-1"><img src={logoUrl} alt="Aydens Wellness Services" className="h-full w-full object-cover mix-blend-multiply"/></span><span className="max-w-[180px] text-[11px] font-extrabold uppercase leading-[1.15] tracking-[.1em]">Aydens Wellness Services</span></div>
            <p className="mt-24 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-secondary">Care workspace</p>
            <h1 className="mt-5 max-w-md font-serif text-7xl font-normal leading-[.87]">Clarity for the work that matters.</h1>
            <p className="mt-7 max-w-sm text-sm leading-7 text-primary-foreground/70">A private operational space for appointments, client care, and the details that help the practice move well.</p>
          </div>
          <div className="border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground/60"><div className="flex items-center gap-2 text-primary-foreground"><ShieldCheck className="h-4 w-4 text-secondary"/> Password + PIN protected</div><p className="mt-2">Biometric passkeys can be added as a secondary sign-in method.</p></div>
        </section>
        <section className="flex items-center p-7 sm:p-12">
          <div className="w-full">
            <Link href="/" className="mb-12 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive"><ArrowLeft className="h-4 w-4"/> Practice home</Link>
            <div className="mb-9"><span className="flex h-12 w-12 items-center justify-center bg-secondary p-1 lg:hidden"><img src={logoUrl} alt="" className="h-full w-full object-cover mix-blend-multiply"/></span><p className="mt-7 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">Staff access</p><h2 className="mt-3 font-serif text-5xl font-normal leading-none">Welcome back.</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">Sign in with your password and required {pinLength}-digit PIN.</p></div>
            <form onSubmit={form.handleSubmit(signIn)} className="space-y-5">
              <div className="space-y-2"><label className="text-sm font-medium">Email Address</label><Input autoComplete="username" placeholder="ayden@aydenstherapyservices.com" {...form.register('email')}/>{form.formState.errors.email&&<p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}</div>
              <div className="space-y-2"><label className="text-sm font-medium">Password</label><Input autoComplete="current-password" type="password" placeholder="Enter your password" {...form.register('password')}/>{form.formState.errors.password&&<p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}</div>
              <div className="space-y-2"><label className="text-sm font-medium">Staff PIN</label><Input inputMode="numeric" maxLength={8} type="password" placeholder="Required every time" autoComplete="one-time-code" {...form.register('pin')} onChange={(e)=>form.setValue('pin',e.target.value.replace(/\D/g,''),{shouldValidate:true})}/>{form.formState.errors.pin&&<p className="text-xs text-destructive">{form.formState.errors.pin.message}</p>}</div>
              <div className="flex items-center gap-3 py-1"><Checkbox checked={form.watch('keepSignedIn')} onCheckedChange={(value)=>form.setValue('keepSignedIn',Boolean(value))}/><span className="text-sm">Keep me signed in</span></div>
              <Button type="submit" className="h-12 w-full" disabled={form.formState.isSubmitting}><ShieldCheck className="mr-2 h-4 w-4"/>{form.formState.isSubmitting?'Signing in…':'Sign in securely'}<ArrowUpRight className="ml-auto h-4 w-4"/></Button>
            </form>
            <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-border"/><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Secondary option</span><div className="h-px flex-1 bg-border"/></div>
            <Button type="button" variant="outline" className="h-12 w-full" onClick={()=>void startPasskey()} disabled={passkeyBusy}><Fingerprint className="mr-2 h-4 w-4"/>{passkeyBusy?'Verifying device…':'Use fingerprint / Face ID'} </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Passkey verification is followed by your required PIN.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
