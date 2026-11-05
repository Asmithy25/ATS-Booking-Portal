import { useEffect, useState, type FormEvent } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, AlertTriangle, History, RefreshCcw, ShieldCheck } from "lucide-react";

type Pending={id:number; method:string; endpoint:string; occurredAt:string};
type Entry={id:number;actorName:string;actorEmail:string;category:string;actionTaken:string;summary:string;reference:string;pendingActionId:number|null;createdAt:string};
const api=<T,>(path:string,init?:RequestInit):Promise<T>=>customFetch<T>(path,{...init,responseType:"json"});
const categories=["Appointment rescheduling","Appointment management","Website settings","Client support","Staff management","Phone center","Recruitment","Corporate operations","Wellness resources","Communications","Security / incident","Other"];
const hint=(p:Pending)=>p.method+" "+p.endpoint;

export default function StaffLogging() {
  const [pending,setPending]=useState<Pending[]>([]);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [pendingId,setPendingId]=useState("");
  const [category,setCategory]=useState(categories[0]);
  const [actionTaken,setActionTaken]=useState("");
  const [summary,setSummary]=useState("");
  const [reference,setReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const refresh=async()=>{
    try {
      const [actions,logs]=await Promise.all([api<Pending[]>("/api/v4/staff-logs/pending"),api<Entry[]>("/api/v4/staff-logs")]);
      setPending(actions);setEntries(logs);
      setPendingId(current=>current && actions.some(item=>String(item.id)===current)?current:actions.length?String(actions[0].id):"");
      setError("");
    } catch(e) { setError(e instanceof Error?e.message:"Could not load staff logs."); }
  };
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),20000);return()=>window.clearInterval(timer);},[]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError("");setSuccess("");
    try {
      await api("/api/v4/staff-logs",{method:"POST",body:JSON.stringify({pendingActionId:pendingId?Number(pendingId):null,category,actionTaken,summary,reference})});
      setSuccess("Manual log recorded successfully. This entry cannot be edited or deleted.");
      setActionTaken("");setSummary("");setReference("");
      await refresh();
      window.dispatchEvent(new Event("aws4-log-updated"));
    } catch(e){setError(e instanceof Error?e.message:"Could not save the manual log.");}finally{setBusy(false);}
  };
  const chosen=pending.find(item=>String(item.id)===pendingId);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">AWS 4.0 · Accountability</p><h1 className="mt-2 font-serif text-3xl font-semibold">Staff Logging</h1><p className="mt-2 text-sm text-muted-foreground">All staff must manually document their operational actions. This complements, but never replaces, the automatic audit history.</p></div><Button variant="outline" onClick={()=>void refresh()}><RefreshCcw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    {error&&<div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}
    {success&&<div role="status" className="rounded-xl border border-primary/30 p-3 text-sm text-primary">{success}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><Card className="rounded-xl"><CardContent className="pt-6"><p className="text-3xl font-bold">{pending.length}</p><p className="text-xs text-muted-foreground">Actions awaiting manual logs</p></CardContent></Card><Card className="rounded-xl"><CardContent className="pt-6"><p className="text-3xl font-bold">{entries.length}</p><p className="text-xs text-muted-foreground">Recent manual entries accessible to you</p></CardContent></Card><Card className="rounded-xl"><CardContent className="flex items-center gap-3 pt-6"><ShieldCheck className="h-8 w-8 text-primary"/><p className="text-xs text-muted-foreground">Automatic audit trails remain separate and reviewable.</p></CardContent></Card></div>
    {pending.length>0&&<div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/><div><strong>Logging required:</strong> You have {pending.length} completed system {pending.length===1?"action":"actions"} that require a corresponding manual entry. Finish them below before continuing operational work.</div></div>}
    <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary"/>Unlogged actions</CardTitle><CardDescription>Recorded automatically when a staff-initiated API change succeeds.</CardDescription></CardHeader><CardContent><div className="max-h-[470px] space-y-2 overflow-y-auto">{pending.map(item=><button key={item.id} onClick={()=>{setPendingId(String(item.id));setActionTaken(hint(item));}} className={"block w-full rounded-xl border p-3 text-left text-sm hover:bg-muted/60 "+(String(item.id)===pendingId?"border-primary bg-primary/5":"")}><span className="font-medium">{hint(item)}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString()}</span></button>)}{pending.length===0&&<p className="py-10 text-center text-sm text-muted-foreground">No outstanding system actions. You may also create a manual entry for work performed outside the portal.</p>}</div></CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary"/>Write a manual log</CardTitle><CardDescription>Describe the administrative action taken, not confidential client conversations or health information.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium">Completed system action<select value={pendingId} onChange={e=>{setPendingId(e.target.value);const item=pending.find(x=>String(x.id)===e.target.value);if(item)setActionTaken(hint(item));}} className="w-full rounded-md border bg-background p-3 text-sm"><option value="">Independent manual entry (outside portal)</option>{pending.map(item=><option key={item.id} value={item.id}>#{item.id} · {hint(item)}</option>)}</select></label>
        <label className="block space-y-2 text-sm font-medium">Action category<select value={category} onChange={e=>setCategory(e.target.value)} className="w-full rounded-md border bg-background p-3 text-sm">{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="block space-y-2 text-sm font-medium">Action taken<Input required maxLength={180} value={actionTaken} onChange={e=>setActionTaken(e.target.value)} placeholder="Example: Rescheduled a confirmed appointment"/></label>
        <label className="block space-y-2 text-sm font-medium">Summary / reason<Textarea required rows={5} maxLength={1000} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Describe the action, reason, and outcome. Do not include protected health details."/></label>
        <label className="block space-y-2 text-sm font-medium">Internal reference (optional)<Input maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Non-sensitive booking or change reference"/></label>
        <Button disabled={busy||!actionTaken.trim()||!summary.trim()} type="submit" className="w-full"><ClipboardCheck className="mr-2 h-4 w-4"/>{busy?"Recording...":"Submit permanent manual log"}</Button>
        <p className="text-xs text-muted-foreground">Your account name and timestamp are attached automatically. Entries cannot be edited or deleted.</p>
      </form></CardContent></Card>
    </div>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Manual activity ledger</CardTitle><CardDescription>Founder and authorized audit reviewers see all staff entries; other team members see their own.</CardDescription></CardHeader><CardContent><div className="divide-y">{entries.slice(0,100).map(item=><div key={item.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{item.actorName} · {item.actionTaken}</p><Badge variant="outline">{item.category}</Badge></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.summary}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}{item.reference?" · Ref: "+item.reference:""}{item.pendingActionId?" · Verified action #"+item.pendingActionId:""}</p></div>)}{entries.length===0&&<p className="py-8 text-center text-sm text-muted-foreground">No manual entries yet.</p>}</div></CardContent></Card>
  </div>;
}
