import { useCallback, useEffect, useState } from "react";
import { customFetch, useGetAuthMe } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, CirclePlay, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, Workflow } from "lucide-react";

type Rule = { id:number; name:string; triggerKey:string; actionKey:string; config:Record<string,any>; enabled:boolean; createdAt?:string };
type Run = { id:number; ruleId:number; ruleName:string; bookingId:number|null; triggerKey:string; outcome:string; detail:string; createdAt:string };

const TRIGGERS = [
  { value:"booking_created", label:"A new booking request is received" },
  { value:"booking_cancelled", label:"A booking is cancelled" },
  { value:"booking_rescheduled", label:"A booking is rescheduled" },
  { value:"booking_completed", label:"A session is completed" },
  { value:"booking_no_show", label:"A booking is marked no-show" },
];
const ACTIONS = [
  { value:"notify_founder", label:"Send an in-app alert to the founder" },
  { value:"notify_client", label:"Send an in-app notification to the linked client" },
  { value:"create_staff_task", label:"Create an internal staff task" },
];

const emptyForm = { name:"", triggerKey:"booking_created", actionKey:"notify_founder", message:"Booking {{confirmationCode}} needs attention for {{date}} at {{time}}.", taskTitle:"Follow up on {{confirmationCode}}", taskDescription:"Review the booking for {{clientName}}.", assignedTo:"", dueDate:"", enabled:false };

export default function AutomationStudio() {
  const { data: auth } = useGetAuthMe();
  const { toast } = useToast();
  const [rules,setRules] = useState<Rule[]>([]);
  const [runs,setRuns] = useState<Run[]>([]);
  const [form,setForm] = useState(emptyForm);
  const [editingId,setEditingId] = useState<number|null>(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [busyId,setBusyId] = useState<number|null>(null);
  const [tab,setTab] = useState<"builder"|"history">("builder");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleData,runData] = await Promise.all([
        customFetch<Rule[]>("/api/automation-studio/rules",{responseType:"json"}),
        customFetch<Run[]>("/api/automation-studio/runs",{responseType:"json"}),
      ]);
      setRules(Array.isArray(ruleData)?ruleData:[]);
      setRuns(Array.isArray(runData)?runData:[]);
    } catch (error) {
      toast({variant:"destructive",title:"Automation Studio could not load",description:error instanceof Error?error.message:"Founder access is required."});
    } finally { setLoading(false); }
  },[toast]);

  useEffect(()=>{ if (auth?.authenticated && (auth as any).role === "founder") void load(); },[auth?.authenticated,(auth as any)?.role,load]);

  const setField = (key:string,value:string|boolean) => setForm((current)=>({...current,[key]:value}));

  const beginEdit = (rule:Rule) => {
    setEditingId(rule.id);
    setForm({
      ...emptyForm,
      name:rule.name,
      triggerKey:rule.triggerKey,
      actionKey:rule.actionKey,
      message:String(rule.config?.message||emptyForm.message),
      taskTitle:String(rule.config?.taskTitle||emptyForm.taskTitle),
      taskDescription:String(rule.config?.taskDescription||emptyForm.taskDescription),
      assignedTo:String(rule.config?.assignedTo||""),
      dueDate:String(rule.config?.dueDate||""),
      enabled:rule.enabled,
    });
    setTab("builder");
  };

  const resetForm = () => {setEditingId(null);setForm(emptyForm);};

  const save = async (event:React.FormEvent) => {
    event.preventDefault();
    if(!form.name.trim()) return;
    setSaving(true);
    const config = form.actionKey==="create_staff_task"
      ? {taskTitle:form.taskTitle,taskDescription:form.taskDescription,assignedTo:form.assignedTo,dueDate:form.dueDate}
      : {message:form.message};
    const payload = {name:form.name,triggerKey:form.triggerKey,actionKey:form.actionKey,config,enabled:form.enabled};
    try {
      if(editingId) await customFetch("/api/automation-studio/rules/"+editingId,{method:"PATCH",body:JSON.stringify(payload),responseType:"json"});
      else await customFetch("/api/automation-studio/rules",{method:"POST",body:JSON.stringify(payload),responseType:"json"});
      toast({title:editingId?"Automation updated":"Automation saved",description:form.enabled?"The rule is enabled and can run on matching booking events.":"The rule is saved but disabled."});
      resetForm();
      await load();
    } catch(error) {
      toast({variant:"destructive",title:"Could not save automation",description:error instanceof Error?error.message:"Check the rule and try again."});
    } finally {setSaving(false);}
  };

  const toggle = async(rule:Rule) => {
    setBusyId(rule.id);
    try {
      await customFetch("/api/automation-studio/rules/"+rule.id,{method:"PATCH",body:JSON.stringify({enabled:!rule.enabled}),responseType:"json"});
      await load();
      toast({title:rule.enabled?"Automation paused":"Automation enabled",description:rule.name});
    } catch(error) {toast({variant:"destructive",title:"Could not change automation",description:error instanceof Error?error.message:"Try again."});}
    finally {setBusyId(null);}
  };

  const remove = async(rule:Rule) => {
    if(!window.confirm("Delete “"+rule.name+"”? Run history will remain for review.")) return;
    setBusyId(rule.id);
    try {
      await customFetch("/api/automation-studio/rules/"+rule.id,{method:"DELETE",responseType:"json"});
      setRules((current)=>current.filter((item)=>item.id!==rule.id));
      if(editingId===rule.id) resetForm();
      toast({title:"Automation deleted"});
    } catch(error) {toast({variant:"destructive",title:"Could not delete automation",description:error instanceof Error?error.message:"Try again."});}
    finally {setBusyId(null);}
  };

  const dryRun = async(rule:Rule) => {
    setBusyId(rule.id);
    try {
      const result = await customFetch<any>("/api/automation-studio/rules/"+rule.id+"/dry-run",{method:"POST",responseType:"json"});
      toast({title:"Dry run complete",description:result.summary+" No records were changed."});
    } catch(error) {toast({variant:"destructive",title:"Preview failed",description:error instanceof Error?error.message:"Try again."});}
    finally {setBusyId(null);}
  };

  if((auth as any)?.authenticated && (auth as any)?.role!=="founder") return <Card className="rounded-2xl"><CardHeader><CardTitle>Founder access required</CardTitle><CardDescription>Automation rules can change how booking events are handled, so this studio is founder-only.</CardDescription></CardHeader></Card>;
  const triggerLabel = (value:string) => TRIGGERS.find((item)=>item.value===value)?.label||value;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[0.13] via-card to-secondary/[0.13] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><Bot className="h-4 w-4"/> AWS / Automation</div><h1 className="mt-3 font-serif text-4xl font-medium sm:text-5xl">Aurora Automation Studio<span className="text-primary">.</span></h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Create real, server-side rules for booking events. Start with one trigger and one controlled action; rules are disabled by default until you explicitly turn them on.</p></div>
          <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant={tab==="builder"?"default":"outline"} onClick={()=>setTab("builder")}><Workflow className="mr-2 h-4 w-4"/>Rule builder</Button>
        <Button variant={tab==="history"?"default":"outline"} onClick={()=>setTab("history")}><CirclePlay className="mr-2 h-4 w-4"/>Run history <Badge className="ml-2" variant="secondary">{runs.length}</Badge></Button>
      </div>

      {tab==="builder" ? <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>{editingId?"Edit automation":"Create an automation"}</CardTitle><CardDescription>Use a safe, auditable trigger/action pair. Templates support {"{{clientName}}"}, {"{{confirmationCode}}"}, {"{{date}}"}, and {"{{time}}"}.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e)=>void save(e)}>
              <div className="space-y-1.5"><Label>Automation name</Label><Input required minLength={3} maxLength={100} value={form.name} onChange={(e)=>setField("name",e.target.value)} placeholder="Example: Notify founder of cancellations"/></div>
              <div className="space-y-1.5"><Label>When this happens</Label><Select value={form.triggerKey} onValueChange={(v)=>setField("triggerKey",v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TRIGGERS.map((item)=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Then do this</Label><Select value={form.actionKey} onValueChange={(v)=>setField("actionKey",v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ACTIONS.map((item)=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              {form.actionKey!=="create_staff_task" ? <div className="space-y-1.5"><Label>{form.actionKey==="notify_client"?"Client notification":"Founder alert"} message</Label><Textarea rows={4} maxLength={1000} value={form.message} onChange={(e)=>setField("message",e.target.value)} required/><p className="text-xs text-muted-foreground">Client notifications require the booking to be linked to an AWS client account.</p></div> :
                <div className="space-y-3 rounded-xl border p-3"><div className="space-y-1.5"><Label>Task title</Label><Input required value={form.taskTitle} onChange={(e)=>setField("taskTitle",e.target.value)}/></div><div className="space-y-1.5"><Label>Task details</Label><Textarea rows={3} value={form.taskDescription} onChange={(e)=>setField("taskDescription",e.target.value)}/></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Assign to (optional)</Label><Input value={form.assignedTo} onChange={(e)=>setField("assignedTo",e.target.value)} placeholder="Staff email or name"/></div><div className="space-y-1.5"><Label>Due date (optional)</Label><Input type="date" value={form.dueDate} onChange={(e)=>setField("dueDate",e.target.value)}/></div></div></div>}
              <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium text-sm">Enable after saving</p><p className="text-xs text-muted-foreground">Disabled rules never run.</p></div><Switch checked={form.enabled} onCheckedChange={(v)=>setField("enabled",v)} /></div>
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Plus className="mr-2 h-4 w-4"/>}{saving?"Saving…":editingId?"Save changes":"Save automation"}</Button>{editingId&&<Button type="button" variant="outline" onClick={resetForm}>Cancel edit</Button>}</div>
            </form>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Automation library</CardTitle><CardDescription>{rules.length} saved rules. Each booking event/rule combination is deduplicated so repeated polls do not rerun the same action.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading saved rules…</p>:rules.length?rules.map((rule)=><article key={rule.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{rule.name}</h3><Badge variant={rule.enabled?"default":"secondary"}>{rule.enabled?"Enabled":"Paused"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">When: {triggerLabel(rule.triggerKey)}</p><p className="mt-1 text-sm text-muted-foreground">Action: {ACTIONS.find((item)=>item.value===rule.actionKey)?.label||rule.actionKey}</p></div><Switch checked={rule.enabled} disabled={busyId===rule.id} onCheckedChange={()=>void toggle(rule)} aria-label={"Enable "+rule.name}/></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void dryRun(rule)} disabled={busyId===rule.id}><CirclePlay className="mr-1.5 h-3.5 w-3.5"/>Dry run</Button><Button size="sm" variant="outline" onClick={()=>beginEdit(rule)}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={()=>void remove(rule)} disabled={busyId===rule.id}><Trash2 className="mr-1.5 h-3.5 w-3.5"/>Delete</Button></div></article>):<div className="rounded-xl border border-dashed p-8 text-center"><Workflow className="mx-auto h-7 w-7 text-muted-foreground"/><p className="mt-3 font-medium">No automations yet</p><p className="mt-1 text-sm text-muted-foreground">Create your first rule. We recommend starting with a founder alert before automating client messages.</p></div>}
            <div className="rounded-xl border border-primary/15 bg-primary/[.04] p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1.5 inline h-4 w-4 text-primary"/>Automation actions run server-side and create a history record. They cannot edit or delete an appointment, change permissions, or send email/SMS; external notifications require a separate, explicit communication workflow.</div>
          </CardContent>
        </Card>
      </div> : <Card className="rounded-2xl"><CardHeader><CardTitle>Recent automation runs</CardTitle><CardDescription>Latest 100 attempted actions. Failed actions are logged without breaking the original booking operation.</CardDescription></CardHeader><CardContent className="space-y-2">{runs.length?runs.map((run)=><div key={run.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium">{run.ruleName||"Deleted automation"}</p><p className="mt-1 text-xs text-muted-foreground">{triggerLabel(run.triggerKey)}{run.bookingId? " · Booking #"+run.bookingId:""} · {new Date(run.createdAt).toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">{run.detail}</p></div><Badge variant={run.outcome==="success"?"default":run.outcome==="failed"?"destructive":"secondary"}>{run.outcome}</Badge></div>):<p className="py-8 text-center text-sm text-muted-foreground">No automation runs have been recorded yet.</p>}</CardContent></Card>}
    </div>
  );
}
