import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useGetAuthMe } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch as SwitchComponent } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BriefcaseBusiness, CheckCircle2, ClipboardList, FileUp, Loader2, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Upload } from "lucide-react";

type Client = { clientAccountId: number | null; clientName: string; phone: string };
type Thread = { id:number; clientAccountId:number; clientName:string; clientEmail:string; subject:string; status:string; messages:{id:number;senderType:string;senderName:string;body:string;createdAt:string}[] };
type Assignment = { id:number; clientName:string; title:string; type:string; status:string; percent:number; updatedAt:string };
type UploadItem = { id:number; clientName:string; label:string; fileName:string; sizeBytes:number; createdAt:string };
type Task = { id:number; title:string; description:string; assignedTo:string; status:string; dueDate?:string|null };
type Role = { id:number; slug:string; name:string; builtIn:boolean; permissions:Record<string,boolean> };

const getJson = async <T,>(url:string, options?:RequestInit) =>
  customFetch<T>(url, { ...options, responseType:"json" });

export default function AdvancedWorkspace() {
  const { data: session, isLoading: sessionLoading } = useGetAuthMe({ query:{ retry:false } });
  const { toast } = useToast();
  const [tab,setTab] = useState("overview");
  const [loading,setLoading] = useState(false);
  const [overview,setOverview] = useState<any>(null);
  const [threads,setThreads] = useState<Thread[]>([]);
  const [assignments,setAssignments] = useState<Assignment[]>([]);
  const [uploads,setUploads] = useState<UploadItem[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [clients,setClients] = useState<Client[]>([]);
  const [clientQuery,setClientQuery] = useState("");
  const [selectedClient,setSelectedClient] = useState<number|null>(null);
  const [activeThread,setActiveThread] = useState<number|null>(null);
  const [message,setMessage] = useState("");
  const [uploadLabel,setUploadLabel] = useState("Documents");
  const [uploadDays,setUploadDays] = useState("7");
  const [task,setTask] = useState({title:"",description:"",assignedTo:"",dueDate:""});
  const [aiPrompt,setAiPrompt] = useState("");
  const [preview,setPreview] = useState<any>(null);
  const [aiBusy,setAiBusy] = useState(false);
  const [roles,setRoles] = useState<Role[]>([]);
  const [permissions,setPermissions] = useState<[string,string][]>([]);
  const [newRole,setNewRole] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const data = await Promise.all([
        getJson<any>("/api/advanced/staff/care-overview"),
        getJson<Thread[]>("/api/advanced/staff/client-messages"),
        getJson<Assignment[]>("/api/advanced/staff/assignments"),
        getJson<UploadItem[]>("/api/advanced/staff/uploads"),
        getJson<Task[]>("/api/advanced/staff/tasks"),
      ]);
      setOverview(data[0]); setThreads(data[1] || []); setAssignments(data[2] || []); setUploads(data[3] || []); setTasks(data[4] || []);
    } catch (error:any) {
      toast({variant:"destructive",title:"Care Operations could not load",description:error?.message || "Check permissions and refresh."});
    } finally { setLoading(false); }
  };

  useEffect(() => { if (session?.authenticated) void reload(); }, [session?.authenticated]);

  const searchClients = async (value:string) => {
    setClientQuery(value);
    if (value.trim().length < 2) { setClients([]); return; }
    try {
      const result = await getJson<{clients:Client[]}>("/api/clients/search?q=" + encodeURIComponent(value.trim()));
      setClients(result.clients || []);
    } catch { setClients([]); }
  };

  const reply = async () => {
    if (!activeThread || !message.trim()) return;
    try {
      await getJson("/api/advanced/staff/client-messages",{method:"POST",body:JSON.stringify({threadId:activeThread,message:message.trim()})});
      setMessage(""); await reload(); toast({title:"Message sent"});
    } catch(error:any) { toast({variant:"destructive",title:"Message failed",description:error?.message || "Please try again."}); }
  };

  const downloadUpload = async (id:number, name:string) => { try { const blob = await getJson<Blob>("/api/advanced/staff/uploads/"+id+"/download", { responseType:"blob" } as any); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href=url; anchor.download=name; anchor.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000); } catch (error:any) { toast({variant:"destructive",title:"Download failed",description:error?.message || "Please try again."}); } };

  const createUpload = async () => {
    if (!selectedClient) { toast({variant:"destructive",title:"Select a client first"}); return; }
    try {
      const result = await getJson<{url:string}>("/api/advanced/staff/upload-requests",{method:"POST",body:JSON.stringify({clientId:selectedClient,label:uploadLabel,expiresInDays:Number(uploadDays)})});
      await reload();
      await navigator.clipboard?.writeText(result.url);
      toast({title:"Secure upload link created",description:"The link was copied when your browser allowed clipboard access."});
    } catch(error:any) { toast({variant:"destructive",title:"Upload request failed",description:error?.message || "Please try again."}); }
  };

  const createTask = async () => {
    if (!task.title.trim()) return;
    try {
      await getJson("/api/advanced/staff/tasks",{method:"POST",body:JSON.stringify(task)});
      setTask({title:"",description:"",assignedTo:"",dueDate:""}); await reload(); toast({title:"Task created"});
    } catch(error:any) { toast({variant:"destructive",title:"Task failed",description:error?.message || "Please try again."}); }
  };

  const generatePreview = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const draft = await getJson<any>("/api/advanced/staff/assignment-preview",{method:"POST",body:JSON.stringify({prompt:aiPrompt.trim()})});
      setPreview(draft);
    } catch(error:any) { toast({variant:"destructive",title:"AI preview failed",description:error?.message || "AI may need configuration."}); }
    finally { setAiBusy(false); }
  };

  const sendAssignment = async () => {
    if (!selectedClient || !preview) return;
    try {
      await getJson("/api/advanced/staff/assignments/send",{method:"POST",body:JSON.stringify({
        clientId:selectedClient,previewToken:preview.previewToken,title:preview.title,summary:preview.summary,instructions:preview.instructions,
        type:preview.type,frequency:preview.frequency || "one_time",dueDate:preview.dueDate || null,config:preview.config
      })});
      setPreview(null); setAiPrompt(""); await reload(); toast({title:"Assignment sent",description:"The client has been notified."});
    } catch(error:any) { toast({variant:"destructive",title:"Assignment could not be sent",description:error?.message || "Please try again."}); }
  };

  const loadRoles = async () => {
    try {
      const result = await getJson<{permissions:[string,string][];roles:Role[]}>("/api/advanced/staff/roles");
      setPermissions(result.permissions || []); setRoles(result.roles || []);
    } catch(error:any) { toast({variant:"destructive",title:"Roles unavailable",description:error?.message || "Founder access is required."}); }
  };
  useEffect(() => { if (tab === "roles" && session?.isAdmin) void loadRoles(); }, [tab,session?.isAdmin]);

  const createRole = async () => {
    if (!newRole.trim()) return;
    try {
      await getJson("/api/advanced/staff/roles",{method:"POST",body:JSON.stringify({name:newRole.trim(),permissions:{}})});
      setNewRole(""); await loadRoles(); toast({title:"Role created"});
    } catch(error:any) { toast({variant:"destructive",title:"Could not create role",description:error?.message || "Please try again."}); }
  };

  if (sessionLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div>;
  if (!session?.authenticated) return null;

  const openMessages = threads.filter(t=>t.status==="open").length;
  const activeAssignments = assignments.filter(a=>a.status!=="completed").length;
  const activeTasks = tasks.filter(t=>t.status!=="done").length;

  return <div className="max-w-7xl space-y-7">
    <div className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">Care Operations</p>
        <h1 className="mt-2 flex items-center gap-2 font-serif text-4xl font-normal sm:text-5xl"><BriefcaseBusiness className="h-7 w-7 text-primary"/>Command center</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">One workspace for client communication, uploads, wellness work and staff workload.</p>
      </div>
      <Button variant="outline" onClick={()=>void reload()} disabled={loading}><RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}/>Refresh</Button>
    </div>

    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="messages">Client messages</TabsTrigger><TabsTrigger value="assignments">Assignments</TabsTrigger><TabsTrigger value="uploads">Uploads</TabsTrigger><TabsTrigger value="tasks">Tasks</TabsTrigger>
        {session.isAdmin && <TabsTrigger value="roles">Roles & permissions</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[["Today",overview?.bookingsToday||0,ClipboardList],["Open messages",openMessages,MessageCircle],["Recent uploads",overview?.recentUploads||0,FileUp],["Active assignments",activeAssignments,Sparkles],["Open tasks",activeTasks,CheckCircle2]].map(([label,value,Icon]:any)=>
            <Card key={String(label)} className="rounded-2xl"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-serif text-3xl">{String(value)}</p></div><Icon className="h-5 w-5 text-primary/70"/></div></CardContent></Card>
          )}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-2xl"><CardHeader><CardTitle>Needs attention</CardTitle><CardDescription>Items that still need a human touch.</CardDescription></CardHeader><CardContent className="space-y-3">
            <div className="rounded-xl border p-4"><div className="flex justify-between"><span>Open conversations</span><Badge>{openMessages}</Badge></div></div>
            <div className="rounded-xl border p-4"><div className="flex justify-between"><span>Assignments in progress</span><Badge>{activeAssignments}</Badge></div></div>
            <div className="rounded-xl border p-4"><div className="flex justify-between"><span>Staff tasks outstanding</span><Badge>{activeTasks}</Badge></div></div>
          </CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle>Quick actions</CardTitle></CardHeader><CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" onClick={()=>setTab("messages")}><MessageCircle className="mr-2 h-4 w-4"/>Open client messages</Button>
            <Button variant="outline" className="justify-start" onClick={()=>setTab("assignments")}><Sparkles className="mr-2 h-4 w-4"/>Build wellness assignment</Button>
            <Button variant="outline" className="justify-start" onClick={()=>setTab("uploads")}><Upload className="mr-2 h-4 w-4"/>Create upload request</Button>
            <Button variant="outline" className="justify-start" onClick={()=>setTab("tasks")}><Plus className="mr-2 h-4 w-4"/>Create staff task</Button>
          </CardContent></Card>
        </div>
      </TabsContent>

      <TabsContent value="messages" className="grid gap-4 lg:grid-cols-[330px_1fr]">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Conversations</CardTitle><CardDescription>{openMessages} open</CardDescription></CardHeader><CardContent className="space-y-2">
          {threads.map(thread=><button type="button" key={thread.id} onClick={()=>setActiveThread(thread.id)} className={activeThread===thread.id ? "w-full rounded-xl border border-primary bg-primary/5 p-3 text-left" : "w-full rounded-xl border p-3 text-left"}><div className="flex items-center justify-between gap-2"><b className="truncate">{thread.clientName}</b><Badge>{thread.status}</Badge></div><p className="mt-1 truncate text-sm">{thread.subject}</p><p className="mt-1 truncate text-xs text-muted-foreground">{thread.messages[thread.messages.length-1]?.body || "No messages yet."}</p></button>)}
          {!threads.length&&<p className="text-sm text-muted-foreground">No client conversations yet.</p>}
        </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>{threads.find(t=>t.id===activeThread)?.clientName || "Client conversation"}</CardTitle></CardHeader><CardContent>
          <div className="min-h-72 space-y-3 rounded-xl bg-muted/20 p-4">{(threads.find(t=>t.id===activeThread)?.messages||[]).map(m=><div key={m.id} className={m.senderType==="staff" ? "ml-auto max-w-[85%] rounded-xl border bg-primary p-3 text-sm text-primary-foreground" : "max-w-[85%] rounded-xl border bg-background p-3 text-sm"}><p className="mb-1 text-[10px] uppercase tracking-wider opacity-70">{m.senderName}</p><p className="whitespace-pre-wrap">{m.body}</p></div>)}</div>
          {activeThread&&<div className="mt-3 flex gap-2"><Textarea rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Reply to the client…"/><Button className="self-end" onClick={()=>void reply()} disabled={!message.trim()}><Send className="mr-1 h-4 w-4"/>Send</Button></div>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="assignments" className="space-y-5">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>AI Assignment Builder</CardTitle><CardDescription>AI creates a preview only. Nothing is sent until you review it and click Send assignment.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Client</Label><Input value={clientQuery} onChange={e=>void searchClients(e.target.value)} placeholder="Search client"/></div>
          {clients.length>0&&<div className="relative z-30 grid gap-2 sm:grid-cols-2">{clients.slice(0,6).map(c=><button type="button" key={String(c.clientAccountId ?? c.phone ?? c.clientName)} aria-label={c.clientAccountId ? `Select ${c.clientName}` : `${c.clientName} has no client portal account`} className="pointer-events-auto w-full cursor-pointer rounded-xl border bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary" onMouseDown={(event)=>event.preventDefault()} onClick={()=>{if(c.clientAccountId){setSelectedClient(c.clientAccountId);setClientQuery(c.clientName);setClients([]);toast({title:"Client selected",description:c.clientName});}else{toast({variant:"destructive",title:"Client portal account not linked",description:`${c.clientName} needs a client portal account before assignments or upload links can be sent.`});}}}><div className="flex items-center justify-between gap-2"><b className="truncate">{c.clientName}</b><span className="text-xs font-semibold text-primary">{c.clientAccountId ? "Select" : "No portal"}</span></div><p className="mt-1 text-xs text-muted-foreground">{c.phone}</p></button>)}</div>}
          <Textarea rows={5} value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Describe what you want the client to do…"/>
          <Button onClick={()=>void generatePreview()} disabled={aiBusy||!aiPrompt.trim()}>{aiBusy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Building draft…</>:<>Generate preview <Sparkles className="ml-2 h-4 w-4"/></>}</Button>
          {preview&&<Card className="rounded-2xl border-primary/20 bg-primary/5"><CardHeader><div className="flex items-start justify-between gap-3"><div><Badge>Preview only</Badge><CardTitle className="mt-2">{preview.title}</CardTitle><CardDescription>{preview.summary}</CardDescription></div><Badge variant="secondary">{preview.type}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client-facing instructions</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{preview.instructions}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setPreview(null)}>Discard draft</Button><Button onClick={()=>void sendAssignment()} disabled={!selectedClient}><Send className="mr-2 h-4 w-4"/>Send assignment</Button></div>{!selectedClient&&<p className="text-xs text-destructive">Select a client before sending.</p>}</CardContent></Card>}
        </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Assignment progress</CardTitle><CardDescription>See how far clients have made it.</CardDescription></CardHeader><CardContent className="space-y-2">{assignments.map(a=><div key={a.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><div><b>{a.title}</b><p className="text-xs text-muted-foreground">{a.clientName} · {a.type}</p></div><Badge>{a.percent}%</Badge></div><Progress className="mt-3" value={a.percent}/><p className="mt-2 text-xs text-muted-foreground">{a.status} · {new Date(a.updatedAt).toLocaleString()}</p></div>)}</CardContent></Card>
      </TabsContent>

      <TabsContent value="uploads" className="space-y-5">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Create secure upload link</CardTitle><CardDescription>Send a one-purpose expiring upload link to a client.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Client</Label><Input value={clientQuery} onChange={e=>void searchClients(e.target.value)} placeholder="Search client"/></div>
          {clients.length>0&&<div className="grid gap-2 sm:grid-cols-2">{clients.slice(0,6).map(c=><button type="button" key={String(c.clientAccountId)} className="rounded-xl border p-3 text-left" onClick={()=>{if(c.clientAccountId){setSelectedClient(c.clientAccountId);setClientQuery(c.clientName);setClients([]);}}}><b>{c.clientName}</b><p className="text-xs text-muted-foreground">{c.phone}</p></button>)}</div>}
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Upload label</Label><Input value={uploadLabel} onChange={e=>setUploadLabel(e.target.value)}/></div><div className="space-y-2"><Label>Expires in days</Label><Input type="number" min={1} max={90} value={uploadDays} onChange={e=>setUploadDays(e.target.value)}/></div></div>
          <Button onClick={()=>void createUpload()} disabled={!selectedClient}><FileUp className="mr-2 h-4 w-4"/>Create link</Button>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Received files</CardTitle></CardHeader><CardContent className="space-y-2">{uploads.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><b>{f.fileName}</b><p className="text-xs text-muted-foreground">{f.clientName} · {f.label} · {Math.ceil(f.sizeBytes/1024)} KB</p></div><Button size="sm" variant="outline" onClick={()=>void downloadUpload(f.id,f.fileName)}>Download</Button></div>)}</CardContent></Card>
      </TabsContent>

      <TabsContent value="tasks" className="space-y-5">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Staff task queue</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input value={task.title} onChange={e=>setTask({...task,title:e.target.value})} placeholder="Task title"/><Input value={task.assignedTo} onChange={e=>setTask({...task,assignedTo:e.target.value})} placeholder="Assigned to"/><Input type="date" value={task.dueDate} onChange={e=>setTask({...task,dueDate:e.target.value})}/><Button onClick={()=>void createTask()} disabled={!task.title.trim()}><Plus className="mr-2 h-4 w-4"/>Create task</Button></div><Textarea rows={3} value={task.description} onChange={e=>setTask({...task,description:e.target.value})} placeholder="Task details"/></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Tasks</CardTitle></CardHeader><CardContent className="space-y-2">{tasks.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><b>{t.title}</b><p className="text-xs text-muted-foreground">{t.assignedTo||"Unassigned"}{t.dueDate ? " · due "+t.dueDate : ""}</p><p className="mt-1 text-sm text-muted-foreground">{t.description}</p></div><Button size="sm" variant="outline" onClick={async()=>{await getJson("/api/advanced/staff/tasks/"+t.id,{method:"PATCH",body:JSON.stringify({status:t.status==="done"?"open":"done"})});await reload();}}>{t.status==="done"?"Reopen":"Mark done"}</Button></div>)}</CardContent></Card>
      </TabsContent>

      {session.isAdmin&&<TabsContent value="roles"><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Roles & permissions</CardTitle><CardDescription>Founder-only role definitions and access control.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex gap-2"><Input value={newRole} onChange={e=>setNewRole(e.target.value)} placeholder="New custom role"/><Button onClick={()=>void createRole()}><Plus className="mr-2 h-4 w-4"/>Create</Button></div><div className="space-y-4">{roles.map(role=><Card key={role.id} className="rounded-xl"><CardHeader><CardTitle className="text-lg">{role.name}</CardTitle><CardDescription>{role.builtIn?"Built-in": "Custom"} · {role.slug}</CardDescription></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{permissions.map(([key,label])=><label key={key} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"><span>{label}</span><SwitchComponent checked={role.permissions?.[key]===true} onCheckedChange={async checked=>{await getJson("/api/advanced/staff/roles/"+role.id,{method:"PATCH",body:JSON.stringify({permissions:{...role.permissions,[key]:checked}})});await loadRoles();}}/></label>)}</div></CardContent></Card>)}</div></CardContent></Card></TabsContent>}
    </Tabs>
  </div>;
}
