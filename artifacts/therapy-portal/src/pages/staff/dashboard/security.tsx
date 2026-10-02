import { useEffect, useState, type FormEvent } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

type SecurityInfo = {
  accountType: 'founder' | 'staff';
  role: string;
  email: string;
  secureCookie: boolean;
  sessionRememberDays: number;
  passwordChangeSupported: boolean;
  permissionNames: string[];
  accountCreatedAt?: string | null;
};

export default function Security() {
  const { toast } = useToast();
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customFetch<SecurityInfo>('/api/auth/security')
      .then(setInfo)
      .catch((err) => toast({ variant: 'destructive', title: 'Could not load security status', description: err instanceof Error ? err.message : 'Please refresh.' }));
  }, []);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 10) {
      toast({ variant: 'destructive', title: 'Use a stronger password', description: 'Your new password must be at least 10 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    setSaving(true);
    try {
      await customFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password changed', description: 'Your current session was signed out. Please sign in again.' });
      window.location.href = import.meta.env.BASE_URL + 'staff/login';
    } catch (err) {
      toast({ variant: 'destructive', title: 'Password change failed', description: err instanceof Error ? err.message : 'Please check your current password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-7">
      <div><p className="text-sm text-muted-foreground">Account access, session protections, and password hygiene.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><ShieldCheck className="h-6 w-6 text-primary" /> Security center</h1></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</p><p className="mt-2 font-semibold">{info?.email ?? 'Loading…'}</p><Badge className="mt-2" variant="secondary">{info?.role ?? '—'}</Badge></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Secure session</p><p className="mt-2 font-semibold">{info?.secureCookie ? 'Enabled in production' : 'Development mode'}</p><p className="mt-1 text-xs text-muted-foreground">Signed, HTTP-only staff session cookie.</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remember me</p><p className="mt-2 font-semibold">{info?.sessionRememberDays ?? 30} days</p><p className="mt-1 text-xs text-muted-foreground">Only when staff selects Keep me signed in.</p></CardContent></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" /> Change password</CardTitle><CardDescription>{info?.passwordChangeSupported ? 'Change your staff account password. Your current session will be cleared afterward.' : 'The founder account password is managed through the Railway environment variable AYDEN_ADMIN_PASSWORD.'}</CardDescription></CardHeader>
          <CardContent>
            {info?.passwordChangeSupported ? <form className="space-y-4" onSubmit={changePassword}><div className="space-y-2"><Label>Current password</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></div><div className="space-y-2"><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></div><div className="space-y-2"><Label>Confirm new password</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></div><Button disabled={saving} type="submit"><KeyRound className="mr-2 h-4 w-4" />{saving ? 'Updating…' : 'Change password'}</Button></form> : <div className="rounded-2xl bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">The founder login remains environment-managed so the secret is never stored in the application database.</div>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Access snapshot</CardTitle><CardDescription>Your current application permissions.</CardDescription></CardHeader>
          <CardContent><div className="flex flex-wrap gap-2">{info?.permissionNames?.length ? info.permissionNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>) : <p className="text-sm text-muted-foreground">Role defaults grant access automatically.</p>}</div>{info?.accountCreatedAt && <p className="mt-5 text-xs text-muted-foreground">Account created {new Date(info.accountCreatedAt).toLocaleDateString()}.</p>}</CardContent>
        </Card>
      </div>
    </div>
  );
}
