import { useEffect, useState, type FormEvent } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';

type PinLength = 4 | 6 | 8;
type Passkey = { id: string; transports: string[] };

type Info = {
  accountType: 'founder' | 'staff';
  role: string;
  email: string;
  secureCookie: boolean;
  sessionRememberDays: number;
  passwordChangeSupported: boolean;
  permissionNames: string[];
  pinConfigured: boolean;
  pinLength: PinLength;
  passkeys: Passkey[];
};

function bytesToBase64Url(value: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export default function Security() {
  const { toast } = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [targetPinLength, setTargetPinLength] = useState<PinLength>(6);
  const [saving, setSaving] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);
  const [passkeySaving, setPasskeySaving] = useState(false);

  const load = async () => {
    try {
      const [base, advanced] = await Promise.all([
        customFetch<any>('/api/auth/security', { responseType: 'json' }),
        customFetch<any>('/api/advanced/staff/security-center', { responseType: 'json' }),
      ]);
      const next = { ...base, ...advanced } as Info;
      setInfo(next);
      setTargetPinLength(next.pinLength);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not load security status',
        description: error?.message || 'Please refresh.',
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 10 || newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Check your new password',
        description: 'Use at least 10 characters and make both fields match.',
      });
      return;
    }
    setSaving(true);
    try {
      await customFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
        responseType: 'json',
      });
      toast({ title: 'Password changed', description: 'Your session was signed out. Please sign in again.' });
      window.location.href = import.meta.env.BASE_URL + 'staff/login';
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Password change failed',
        description: error?.message || 'Please check your current password.',
      });
    } finally {
      setSaving(false);
    }
  };

  const changePin = async (event: FormEvent) => {
    event.preventDefault();
    const currentLength = info?.pinLength ?? 6;
    if (!/^\d+$/.test(currentPin) || currentPin.length !== currentLength ||
        !/^\d+$/.test(newPin) || newPin.length !== targetPinLength ||
        newPin !== confirmPin) {
      toast({
        variant: 'destructive',
        title: 'Check your PIN',
        description: 'Enter your current ' + currentLength + '-digit PIN and a matching new ' + targetPinLength + '-digit PIN.',
      });
      return;
    }
    setPinSaving(true);
    try {
      const result = await customFetch<any>('/api/advanced/staff/pin/change', {
        method: 'POST',
        body: JSON.stringify({ currentPin, newPin, pinLength: targetPinLength }),
        responseType: 'json',
      });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setInfo((current) => current ? { ...current, pinLength: result.pinLength ?? targetPinLength, pinConfigured: true } : current);
      toast({ title: 'PIN updated', description: 'Your PIN length and PIN are now saved for your account only.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'PIN change failed',
        description: error?.message || 'Please check your current PIN.',
      });
    } finally {
      setPinSaving(false);
    }
  };

  const registerPasskey = async () => {
    if (!info?.pinConfigured) {
      toast({
        variant: 'destructive',
        title: 'Set your PIN first',
        description: 'Complete staff PIN setup before adding a passkey.',
      });
      return;
    }
    if (!window.PublicKeyCredential || !navigator.credentials) {
      toast({
        variant: 'destructive',
        title: 'Passkeys unavailable',
        description: 'Use a browser/device that supports fingerprint or Face ID passkeys.',
      });
      return;
    }

    setPasskeySaving(true);
    try {
      const options = await customFetch<any>('/api/advanced/staff/passkey/register-options', {
        method: 'POST',
        body: JSON.stringify({}),
        responseType: 'json',
      });

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64UrlToBytes(options.challenge),
          rp: options.rp,
          user: {
            id: base64UrlToBytes(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          authenticatorSelection: options.authenticatorSelection,
          timeout: options.timeout,
          attestation: 'none',
        },
      }) as PublicKeyCredential | null;

      if (!credential) throw new Error('No passkey was created.');

      const response = credential.response as AuthenticatorAttestationResponse & {
        getPublicKey?: () => ArrayBuffer | null;
        getTransports?: () => AuthenticatorTransport[];
      };
      const publicKey = response.getPublicKey?.();
      if (!publicKey) {
        throw new Error('This browser did not return a usable public key. Try a current browser.');
      }

      await customFetch('/api/advanced/staff/passkey/register', {
        method: 'POST',
        body: JSON.stringify({
          id: credential.id,
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
          publicKey: bytesToBase64Url(publicKey),
          transports: response.getTransports?.() || [],
        }),
        responseType: 'json',
      });

      toast({ title: 'Passkey added', description: 'Your fingerprint or Face ID can now be used for staff sign-in.' });
      await load();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Passkey registration failed',
        description: error?.message || 'Please try again on a device with biometrics enabled.',
      });
    } finally {
      setPasskeySaving(false);
    }
  };

  const removePasskey = async (id: string) => {
    try {
      await customFetch('/api/advanced/staff/passkey/' + encodeURIComponent(id), {
        method: 'DELETE',
        responseType: 'json',
      });
      toast({ title: 'Passkey removed' });
      await load();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not remove passkey',
        description: error?.message || 'Please try again.',
      });
    }
  };

  return (
    <div className="max-w-6xl space-y-7">
      <div>
        <p className="text-sm text-muted-foreground">Your password, PIN, passkeys, and session security.</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold">
          <ShieldCheck className="h-6 w-6 text-primary" /> Security Center
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Account</p>
            <p className="mt-2 truncate font-semibold">{info?.email ?? 'Loading…'}</p>
            <Badge className="mt-2" variant="secondary">{info?.role ?? '—'}</Badge>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">PIN</p>
            <p className="mt-2 font-semibold">{info?.pinConfigured ? info.pinLength + '-digit' : 'Setup required'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Your PIN length is personal to this account.</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Passkeys</p>
            <p className="mt-2 font-semibold">{info?.passkeys?.length ?? 0} registered</p>
            <p className="mt-1 text-xs text-muted-foreground">Fingerprint / Face ID.</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Session</p>
            <p className="mt-2 font-semibold">{info?.secureCookie ? 'Protected' : 'Development mode'}</p>
            <p className="mt-1 text-xs text-muted-foreground">HTTP-only signed staff session.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" /> Change password</CardTitle>
            <CardDescription>The founder password remains environment-managed. Other staff can change their password here.</CardDescription>
          </CardHeader>
          <CardContent>
            {info?.passwordChangeSupported ? (
              <form className="space-y-4" onSubmit={changePassword}>
                <Input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                <Button disabled={saving} type="submit">Change password</Button>
              </form>
            ) : (
              <p className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">The founder password is managed through the Railway environment.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Staff PIN</CardTitle>
            <CardDescription>Choose 4, 6, or 8 digits for your own PIN. Changing it here affects only your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {info?.pinConfigured ? (
              <form className="space-y-4" onSubmit={changePin}>
                <div>
                  <p className="mb-2 text-sm font-medium">Current PIN</p>
                  <Input inputMode="numeric" maxLength={info.pinLength} type="password" placeholder={'Current ' + info.pinLength + '-digit PIN'} value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, info.pinLength))} autoComplete="current-password" />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">New PIN length</p>
                  <Select value={String(targetPinLength)} onValueChange={(value) => { setTargetPinLength(Number(value) as PinLength); setNewPin(''); setConfirmPin(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 digits</SelectItem>
                      <SelectItem value="6">6 digits</SelectItem>
                      <SelectItem value="8">8 digits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input inputMode="numeric" maxLength={targetPinLength} type="password" placeholder={'New ' + targetPinLength + '-digit PIN'} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, targetPinLength))} autoComplete="new-password" />
                <Input inputMode="numeric" maxLength={targetPinLength} type="password" placeholder="Confirm new PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, targetPinLength))} autoComplete="new-password" />
                <Button type="submit" disabled={pinSaving || currentPin.length !== info.pinLength || newPin.length !== targetPinLength || confirmPin.length !== targetPinLength}>
                  <KeyRound className="mr-2 h-4 w-4" /> {pinSaving ? 'Saving…' : 'Save PIN'}
                </Button>
              </form>
            ) : (
              <div className="rounded-xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                Your PIN is not configured yet. Sign in again with your password to complete first-time PIN setup; you can choose 4, 6, or 8 digits there.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-primary" /> Biometric passkeys</CardTitle>
          <CardDescription>Register this device's fingerprint or Face ID. The passkey is stored only on your staff account, and can replace the PIN as your second verification method.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void registerPasskey()} disabled={passkeySaving || !info?.pinConfigured}>
            <Fingerprint className="mr-2 h-4 w-4" /> {passkeySaving ? 'Registering…' : 'Add passkey'}
          </Button>
          {(info?.passkeys ?? []).map((key) => (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-medium">Passkey</p>
                <p className="text-xs text-muted-foreground">Credential {key.id.slice(0, 16)}…</p>
              </div>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void removePasskey(key.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
          {!info?.passkeys?.length && <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Access snapshot</CardTitle><CardDescription>Your current application permissions.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {info?.permissionNames?.length
              ? info.permissionNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>)
              : <p className="text-sm text-muted-foreground">Role defaults grant access automatically.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
