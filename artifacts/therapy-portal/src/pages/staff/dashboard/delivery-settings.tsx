import { useEffect, useState } from 'react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, MessageSquareText, RefreshCw, Send, ShieldCheck, CircleCheck, CircleAlert } from 'lucide-react';

type ChannelStatus = { configured: boolean; provider: string; sender: string; missing: string[] };
type DeliveryStatus = { email: ChannelStatus; sms: ChannelStatus; replyTo: string };

export default function DeliverySettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailTo, setEmailTo] = useState('');
  const [smsTo, setSmsTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setStatus(await customFetch<DeliveryStatus>('/api/delivery-settings/status'));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not load delivery status', description: error instanceof Error ? error.message : 'Founder access is required.' });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const testEmail = async () => {
    setSendingEmail(true);
    try {
      const result = await customFetch<{ message: string }>('/api/delivery-settings/test-email', { method: 'POST', body: JSON.stringify({ to: emailTo.trim() }) });
      toast({ title: 'Email test accepted', description: result.message });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Email test failed', description: error instanceof Error ? error.message : 'Check the provider configuration.' });
    } finally { setSendingEmail(false); }
  };
  const testSms = async () => {
    setSendingSms(true);
    try {
      const result = await customFetch<{ message: string }>('/api/delivery-settings/test-sms', { method: 'POST', body: JSON.stringify({ to: smsTo.trim() }) });
      toast({ title: 'SMS test accepted', description: result.message });
    } catch (error) {
      toast({ variant: 'destructive', title: 'SMS test failed', description: error instanceof Error ? error.message : 'Check the provider configuration.' });
    } finally { setSendingSms(false); }
  };

  const statusBadge = (channel?: ChannelStatus) => channel?.configured
    ? <Badge className="gap-1"><CircleCheck className="h-3 w-3" /> Configured</Badge>
    : <Badge variant="secondary" className="gap-1"><CircleAlert className="h-3 w-3" /> Setup required</Badge>;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Founder controls · external delivery</p>
          <h1 className="mt-1 text-3xl font-semibold">Email &amp; SMS delivery</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Connect real email and text-message delivery for appointment confirmations, reminders, cancellations, and reschedules.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh status</Button>
      </div>

      <div className="rounded-2xl border bg-muted/25 p-4 text-sm leading-6">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Credentials stay out of the website</p><p className="text-muted-foreground">Provider API keys are read only by the backend from Railway environment variables. They are never shown in this screen or sent to the browser. Add them to the <strong>ats-api-live</strong> service, not the frontend.</p></div></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="mb-1 flex items-center justify-between gap-3"><Mail className="h-6 w-6 text-primary" />{statusBadge(status?.email)}</div>
            <CardTitle>Email delivery</CardTitle>
            <CardDescription>Provider: Gmail SMTP · Reply-to: {status?.replyTo || 'aydenswellnessservices@gmail.com'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border p-3 text-sm"><p className="font-medium">Sender address</p><p className="mt-1 break-all text-muted-foreground">{status?.email.sender || 'Not set in Railway yet'}</p></div>
            <div><p className="mb-2 text-sm font-medium">Required Railway variables</p><div className="space-y-2">{['GMAIL_USER', 'GMAIL_APP_PASSWORD'].map((key) => <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><code>{key}</code><Badge variant={status?.email.missing.includes(key) ? 'outline' : 'secondary'}>{status?.email.missing.includes(key) ? 'Missing' : 'Set'}</Badge></div>)}</div></div>
            <div className="space-y-2"><Label htmlFor="test-email">Send a test email to</Label><Input id="test-email" type="email" placeholder="you@example.com" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} /></div>
            <Button className="w-full" onClick={testEmail} disabled={sendingEmail || !status?.email.configured || !emailTo.trim()}><Send className="mr-2 h-4 w-4" />{sendingEmail ? 'Sending test…' : 'Send test email'}</Button>
            <p className="text-xs leading-5 text-muted-foreground">Use the AWS Gmail account and a Google App Password. The From address is the authenticated Gmail account; replies go to <strong>aydenswellnessservices@gmail.com</strong>. Create an App Password in your Google Account after enabling 2-Step Verification. Never use your normal Google password.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <div className="mb-1 flex items-center justify-between gap-3"><MessageSquareText className="h-6 w-6 text-primary" />{statusBadge(status?.sms)}</div>
            <CardTitle>SMS delivery</CardTitle>
            <CardDescription>Provider: Twilio · Appointment texts go to the client’s booking phone number.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border p-3 text-sm"><p className="font-medium">Twilio sender number</p><p className="mt-1 break-all text-muted-foreground">{status?.sms.sender || 'Not set in Railway yet'}</p></div>
            <div><p className="mb-2 text-sm font-medium">Required Railway variables</p><div className="space-y-2">{['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'].map((key) => <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><code>{key}</code><Badge variant={status?.sms.missing.includes(key) ? 'outline' : 'secondary'}>{status?.sms.missing.includes(key) ? 'Missing' : 'Set'}</Badge></div>)}</div></div>
            <div className="space-y-2"><Label htmlFor="test-sms">Send a test SMS to</Label><Input id="test-sms" type="tel" placeholder="+15612918556" value={smsTo} onChange={(event) => setSmsTo(event.target.value)} /></div>
            <Button className="w-full" onClick={testSms} disabled={sendingSms || !status?.sms.configured || !smsTo.trim()}><Send className="mr-2 h-4 w-4" />{sendingSms ? 'Sending test…' : 'Send test SMS'}</Button>
            <p className="text-xs leading-5 text-muted-foreground">Use international phone format, such as +15612918556. Twilio account permissions, sender registration, and destination-country rules may apply.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>What happens after setup?</CardTitle><CardDescription>Once each provider is configured, AWS can send these through the connected provider in addition to in-portal notifications.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {['Booking confirmations', 'Appointment reminders', 'Starting-soon alerts', 'Cancellations and reschedules'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><CircleCheck className="h-4 w-4 shrink-0 text-primary" />{item}</div>)}
          <p className="sm:col-span-2 text-xs leading-5 text-muted-foreground">Email is sent only when the client has a linked portal account with an email address. SMS uses the phone number saved on the booking. Provider setup and a successful test are required before external messages can be delivered.</p>
        </CardContent>
      </Card>
    </div>
  );
}
