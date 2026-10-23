import { useCallback, useEffect, useMemo, useState } from "react";
import { customFetch, useGetAuthMe } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Clock3, Mail, MessageSquareText, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react";

type Delivery = {
  id:number; bookingId:number|null; confirmationCode?:string|null; clientName?:string|null; eventKind:string;
  channel:"email"|"sms"; recipientMasked:string; status:"submitted"|"failed"|"skipped"; detail:string;
  attemptSource:string; createdAt:string;
};

const kindLabels:Record<string,string> = {
  booking_confirmation:"Booking confirmation",
  appointment_reminder:"Appointment reminder",
  starting_soon:"Starting-soon reminder",
  appointment_start:"Appointment start",
  cancellation:"Cancellation",
  reschedule:"Reschedule",
};

export default function NotificationMissionControl() {
  const { data: auth } = useGetAuthMe();
  const { toast } = useToast();
  const [items,setItems] = useState<Delivery[]>([]);
  const [loading,setLoading] = useState(true);
  const [filter,setFilter] = useState<"all"|"failed"|"submitted"|"skipped">("all");
  const [busyId,setBusyId] = useState<number|null>(null);
  const [lastUpdated,setLastUpdated] = useState<Date|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result=await customFetch<Delivery[]>("/api/notification-mission-control/deliveries",{responseType:"json",cache:"no-store"});
      setItems(Array.isArray(result)?result:[]);
      setLastUpdated(new Date());
    } catch(error) {
      toast({variant:"destructive",title:"Delivery ledger unavailable",description:error instanceof Error?error.message:"Founder access is required."});
    } finally {setLoading(false);}
  },[toast]);

  useEffect(()=>{if(auth?.authenticated&&(auth as any).role==="founder")void load();},[auth?.authenticated,(auth as any)?.role,load]);

  const visible = useMemo(()=>filter==="all"?items:items.filter((item)=>item.status===filter),[items,filter]);
  const counts = useMemo(()=>({
    submitted:items.filter((item)=>item.status==="submitted").length,
    failed:items.filter((item)=>item.status==="failed").length,
    skipped:items.filter((item)=>item.status==="skipped").length,
  }),[items]);

  const retry = async (item:Delivery) => {
    setBusyId(item.id);
    try {
      const result=await customFetch<{message:string}>("/api/notification-mission-control/deliveries/"+item.id+"/retry",{method:"POST",responseType:"json"});
      toast({title:"Retry submitted",description:result.message});
      await load();
    } catch(error) {
      toast({variant:"destructive",title:"Retry failed",description:error instanceof Error?error.message:"The channel could not be retried."});
      await load();
    } finally {setBusyId(null);}
  };

  if((auth as any)?.authenticated&&(auth as any)?.role!=="founder") return <Card className="rounded-2xl"><CardHeader><CardTitle>Founder access required</CardTitle><CardDescription>This view contains communication delivery diagnostics.</CardDescription></CardHeader></Card>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-card to-secondary/[0.13] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><ShieldCheck className="h-4 w-4"/> AWS / Delivery operations</div><h1 className="mt-3 font-serif text-4xl font-medium sm:text-5xl">Notification Mission Control<span className="text-primary">.</span></h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">See recorded email and SMS attempts, separate skipped sends from failures, and retry only a failed channel when the client has opted in and provider configuration is ready.</p><p className="mt-2 text-xs text-muted-foreground">{lastUpdated?"Last checked "+lastUpdated.toLocaleTimeString():"Delivery history has not been refreshed yet."}</p></div>
          <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh history</Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-5 w-5"/></span><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provider accepted</p><p className="mt-1 text-3xl font-semibold">{counts.submitted}</p></div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-destructive/10 text-destructive"><AlertCircle className="h-5 w-5"/></span><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failed attempts</p><p className="mt-1 text-3xl font-semibold">{counts.failed}</p></div></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Clock3 className="h-5 w-5"/></span><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skipped</p><p className="mt-1 text-3xl font-semibold">{counts.skipped}</p></div></CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Channel attempt ledger</CardTitle><CardDescription>The latest 150 recorded email/SMS attempts. Recipient addresses and phone numbers are masked.</CardDescription></div><div className="flex flex-wrap gap-2">{(["all","failed","submitted","skipped"] as const).map((value)=><Button key={value} size="sm" variant={filter===value?"default":"outline"} onClick={()=>setFilter(value)}>{value==="all"?"All":value==="submitted"?"Submitted":value[0].toUpperCase()+value.slice(1)}</Button>)}</div></CardHeader>
        <CardContent className="space-y-3">
          {loading?<div className="flex justify-center py-10 text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin"/>Loading attempt history…</div>:visible.length?visible.map((item)=>(
            <article key={item.id} className="rounded-xl border bg-background/55 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl "+(item.channel==="email"?"bg-primary/10 text-primary":"bg-sky-500/10 text-sky-600")}>{item.channel==="email"?<Mail className="h-4 w-4"/>:<MessageSquareText className="h-4 w-4"/>}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{kindLabels[item.eventKind]||item.eventKind.replaceAll("_"," ")}</h3><Badge variant="outline" className="capitalize">{item.channel}</Badge><Badge variant={item.status==="failed"?"destructive":item.status==="submitted"?"default":"secondary"}>{item.status==="submitted"?"Provider accepted":item.status}</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.clientName||"Client"}{item.confirmationCode?" · "+item.confirmationCode:""}{item.recipientMasked?" · "+item.recipientMasked:""}</p>
                  <p className="mt-2 text-sm leading-5">{item.detail}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()} · {item.attemptSource==="manual_retry"?"Manual retry":"Automatic attempt"}</p>
                </div>
                {item.status==="failed"&&<Button size="sm" variant="outline" onClick={()=>void retry(item)} disabled={busyId===item.id} className="shrink-0">{busyId===item.id?<RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin"/>:<Send className="mr-1.5 h-3.5 w-3.5"/>}Retry channel</Button>}
              </div>
            </article>
          )):<div className="rounded-xl border border-dashed p-10 text-center"><XCircle className="mx-auto h-7 w-7 text-muted-foreground"/><p className="mt-3 font-medium">No matching attempts</p><p className="mt-1 text-sm text-muted-foreground">New attempts appear here when AWS's delivery service records an email or SMS send attempt.</p></div>}
        </CardContent>
      </Card>
      <div className="rounded-xl border border-primary/15 bg-primary/[.04] p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mr-1.5 inline h-4 w-4 text-primary"/>“Provider accepted” means the email server or messaging API accepted a send request. It does not guarantee the recipient received or read it. Final delivery receipts are only available when the external provider supplies them through a callback integration.</div>
    </div>
  );
}
