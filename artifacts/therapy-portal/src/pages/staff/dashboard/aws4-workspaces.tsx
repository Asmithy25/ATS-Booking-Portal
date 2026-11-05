import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { customFetch, useGetAuthMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, Plus, RefreshCcw, Sparkles } from "lucide-react";

type Module = {id:string;name:string;description:string;corporate:boolean};
const modules:Module[]=[
 {id:"decisions",name:"Executive Decision Registry",description:"Document decisions, owners, and outcomes.",corporate:true},
 {id:"departments",name:"Department Management Studio",description:"Manage department plans and responsibilities.",corporate:true},
 {id:"policies",name:"Corporate Policy Publisher",description:"Maintain approved policy records and revisions.",corporate:true},
 {id:"delegations",name:"Executive Delegation",description:"Track temporary authority and responsibilities.",corporate:true},
 {id:"performance",name:"Organization Performance Reports",description:"Collect high-level performance reports.",corporate:true},
 {id:"change_control",name:"Corporate Change Control",description:"Document proposed and approved platform changes.",corporate:true},
 {id:"broadcasts",name:"Executive Broadcast Center",description:"Prepare corporate messages and follow-ups.",corporate:true},
 {id:"recruitment",name:"Recruitment Planning",description:"Record recruiting plans alongside the Careers Center.",corporate:true},
 {id:"my_workday",name:"My Workday",description:"Organize personal priorities for your workday.",corporate:false},
 {id:"knowledge",name:"Knowledge Hub",description:"Find and maintain internal operating notes.",corporate:false},
 {id:"shift_exchange",name:"Shift Exchange",description:"Submit shift coverage and exchange requests.",corporate:false},
 {id:"help_desk",name:"Internal Help Desk",description:"Report and track staff support requests.",corporate:false},
 {id:"training",name:"Staff Training Academy",description:"Track training items and learning objectives.",corporate:false},
 {id:"tasks",name:"Task Assignment",description:"Create and update operational assignments.",corporate:false},
 {id:"profiles",name:"Staff Profile Studio",description:"Manage profile update requests.",corporate:false},
 {id:"availability",name:"Availability & Leave Requests",description:"Record availability and time-off requests.",corporate:false},
 {id:"recognition",name:"Staff Recognition",description:"Celebrate staff achievements.",corporate:false},
 {id:"discussions",name:"Department Discussions",description:"Coordinate department discussion topics.",corporate:false},
 {id:"incidents",name:"Operational Incident Reports",description:"Report technical and operational problems.",corporate:false}
];
type RecordItem={id:number;module:string;title:string;body:string;status:string;assignee:string;createdBy:string;createdEmail:string;createdAt:string};
const specializedPaths:Record<string,string>={
 decisions:"/staff/corporate",
 departments:"/staff/v4-suite/organization",
 policies:"/staff/v4-suite/policies",
 delegations:"/staff/v4-suite/delegations",
 performance:"/staff/v4-suite/reports",
 change_control:"/staff/corporate",
 broadcasts:"/staff/v4-suite/broadcasts",
 recruitment:"/staff/careers",
 my_workday:"/staff/my-workday",
 shift_exchange:"/staff/v4-suite/staff-requests",
 training:"/staff/v4-suite/training",
 availability:"/staff/v4-suite/staff-requests",
 recognition:"/staff/v4-suite/recognition",
 discussions:"/staff/department-discussions",
 incidents:"/staff/incidents",
};

const statuses=["open","in_progress","pending_review","approved","done","closed"];
const api=<T,>(path:string,init?:RequestInit):Promise<T>=>customFetch<T>(path,{...init,responseType:"json"});
export default function AWS4Workspaces(){
 const [location,setLocation]=useLocation();
 const id=location.split("/")[3]||"";
 const current=modules.find(m=>m.id===id)||null;
 const session=useGetAuthMe();
 const role=String((session.data as any)?.role||"");
 const corporate=role==="founder"||role==="ash_executive";
 const [labFlags,setLabFlags]=useState<Array<{key:string;enabled:boolean}>>([]);
 useEffect(()=>{customFetch<{items:Array<{key:string;enabled:boolean}>}>("/api/v4/suite/feature-lab",{responseType:"json"}).then(x=>setLabFlags(x.items||[])).catch(()=>undefined);},[]);
 const available=modules.filter(m=>(!m.corporate||corporate)&&(corporate||labFlags.find(f=>f.key==="v4-"+m.id)?.enabled!==false));
 const [records,setRecords]=useState<RecordItem[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [title,setTitle]=useState("");
 const [body,setBody]=useState("");
 const [assignee,setAssignee]=useState("");
 const [search,setSearch]=useState("");
 const [expandedComments,setExpandedComments]=useState<number|null>(null);
 const [comments,setComments]=useState<Record<number,Array<{id:number;authorName:string;body:string;createdAt:string}>>>({});
 const [commentDraft,setCommentDraft]=useState("");
 const [busy,setBusy]=useState(false);
 const load=async()=>{if(!current)return;setLoading(true);setError("");try{setRecords(await api<RecordItem[]>("/api/v4/workspaces/"+current.id+(search?"?search="+encodeURIComponent(search):"")));}catch(e){setError(e instanceof Error?e.message:"Could not load this workspace.");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[id,search]);
 const create=async()=>{if(!current||!title.trim())return;setBusy(true);setError("");try{await api("/api/v4/workspaces/"+current.id,{method:"POST",body:JSON.stringify({title,body,assignee})});setTitle("");setBody("");setAssignee("");setNotice("Record created. Don't forget your required Staff Log.");await load();}catch(e){setError(e instanceof Error?e.message:"Could not create record.");}finally{setBusy(false);}};
 const openComments=async(recordId:number)=>{
   if(expandedComments===recordId){setExpandedComments(null);return;}
   setExpandedComments(recordId);setCommentDraft("");
   if(!current)return;
   try{const loaded=await api<Array<{id:number;authorName:string;body:string;createdAt:string}>>("/api/v4/workspaces/"+current.id+"/"+recordId+"/comments");setComments(old=>({...old,[recordId]:loaded}));}
   catch(e){setError(e instanceof Error?e.message:"Cannot load item discussion.");}
 };
 const addComment=async(recordId:number)=>{
   if(!current||!commentDraft.trim())return;setBusy(true);
   try{await api("/api/v4/workspaces/"+current.id+"/"+recordId+"/comments",{method:"POST",body:JSON.stringify({body:commentDraft})});setCommentDraft("");
      const value=await api<Array<{id:number;authorName:string;body:string;createdAt:string}>>("/api/v4/workspaces/"+current.id+"/"+recordId+"/comments");
      setComments(old=>({...old,[recordId]:value}));setNotice("Comment saved. Complete Staff Logging before your next action.");
   }catch(e){setError(e instanceof Error?e.message:"Could not send comment.");}finally{setBusy(false);}
 };
 const updateStatus=async(row:RecordItem,status:string)=>{if(!current)return;setError("");try{await api("/api/v4/workspaces/"+current.id+"/"+row.id,{method:"PATCH",body:JSON.stringify({status})});setNotice("Status saved. Please log the action.");await load();}catch(e){setError(e instanceof Error?e.message:"Could not update record.");}};
 if(current&&current.corporate&&!corporate)return <div className="rounded-xl border p-8 text-center"><h1 className="text-xl font-semibold">Corporate access required</h1><p className="mt-2 text-sm text-muted-foreground">This workspace is available only to Founder and Corporate.</p></div>;
 return <div className="space-y-7">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="outline" className="mb-3">AWS 4.0 · One Organization</Badge><h1 className="font-serif text-3xl font-semibold">{current?.name||"AWS 4.0 Headquarters"}</h1><p className="mt-2 text-sm text-muted-foreground">{current?.description||"One place for Corporate, Staff, and organization-wide operations."}</p></div>{current?<Button variant="outline" onClick={()=>setLocation("/staff/v4")}><ArrowLeft className="mr-2 h-4 w-4"/>All workspaces</Button>:<Button onClick={()=>setLocation("/staff/staff-logs")}><CheckCircle2 className="mr-2 h-4 w-4"/>Staff Logging</Button>}</div>
   {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
   {notice&&<p role="status" className="rounded-lg border border-primary/30 p-3 text-sm">{notice}</p>}
   {!current?<><Card className="rounded-2xl border-primary/20 bg-primary/5"><CardContent className="flex flex-col justify-between gap-4 pt-6 sm:flex-row sm:items-center"><div><h2 className="font-serif text-2xl">Welcome to the next era.</h2><p className="mt-1 text-sm text-muted-foreground">Access role-based operations and the new AWS 4.0 tools.</p></div><Button onClick={()=>setLocation("/staff/careers")} disabled={!corporate}><BriefcaseBusiness className="mr-2 h-4 w-4"/>Corporate Careers</Button></CardContent></Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{available.map(m=><button key={m.id} onClick={()=>setLocation(specializedPaths[m.id]||"/staff/v4/"+m.id)} className="rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-primary">{m.corporate?"ASH Corporate":"AWS Staff"}</span><ArrowRight className="h-4 w-4 text-muted-foreground"/></div><h2 className="text-lg font-semibold">{m.name}</h2><p className="mt-2 text-sm text-muted-foreground">{m.description}</p></button>)}</div></>:
   <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5"/>New record</CardTitle><CardDescription>Save a new operational item within {current.name}.</CardDescription></CardHeader><CardContent className="space-y-4"><label className="block space-y-2 text-sm font-medium">Title<Input maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="New item"/></label><label className="block space-y-2 text-sm font-medium">Details<Textarea rows={6} maxLength={5000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Details, requirements or a concise internal summary. Exclude confidential health information."/></label><label className="block space-y-2 text-sm font-medium">Assigned to (optional)<Input maxLength={180} value={assignee} onChange={e=>setAssignee(e.target.value)} placeholder="Staff account email (or leave blank)"/></label><Button disabled={busy||!title.trim()} onClick={()=>void create()}><Plus className="mr-2 h-4 w-4"/>Create record</Button></CardContent></Card><Card className="rounded-2xl"><CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Workspace records</CardTitle><Button size="sm" variant="outline" onClick={()=>void load()}><RefreshCcw className="h-4 w-4"/></Button></div><CardDescription>Newest first. Search titles or details; actions are also captured for manual logging.</CardDescription></CardHeader><CardContent className="max-h-[720px] space-y-3 overflow-y-auto"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search work items or knowledge articles"/>{loading&&<p className="text-sm text-muted-foreground">Loading...</p>}{!loading&&records.length===0&&<p className="py-8 text-center text-sm text-muted-foreground">No records yet.</p>}{records.map(r=><div key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{r.title}</h3><Badge variant="secondary">{r.status.replaceAll("_"," ")}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p><p className="mt-3 text-xs text-muted-foreground">Created by {r.createdBy}{r.assignee?" · Assigned: "+r.assignee:""} · {new Date(r.createdAt).toLocaleString()}</p><div className="mt-4"><Button size="sm" variant="outline" onClick={()=>void openComments(r.id)}>{expandedComments===r.id?"Hide discussion":"Open discussion"}</Button>{expandedComments===r.id&&<div className="mt-3 space-y-3 rounded-xl bg-muted/40 p-3">{(comments[r.id]||[]).map(k=><div key={k.id} className="rounded-lg border bg-card p-3"><p className="text-xs font-semibold">{k.authorName} · {new Date(k.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm">{k.body}</p></div>)}{(comments[r.id]||[]).length===0&&<p className="text-xs text-muted-foreground">No discussion yet.</p>}<Textarea rows={3} maxLength={3000} value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} placeholder="Add a work item comment; don't include confidential client health details."/><Button size="sm" disabled={busy||!commentDraft.trim()} onClick={()=>void addComment(r.id)}>Post comment</Button></div>}</div><label className="mt-3 flex items-center gap-2 text-xs">Status<select value={r.status} onChange={e=>void updateStatus(r,e.target.value)} className="rounded-md border bg-background p-2 text-xs">{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label></div>)}</CardContent></Card></div>}
   <div className="flex items-center gap-2 rounded-xl bg-muted p-4 text-xs text-muted-foreground"><Sparkles className="h-4 w-4 shrink-0 text-primary"/>AWS 4.0 workspaces are role-restricted operational record tools. Features requiring specialized integrations must be verified separately before being described as fully operational.</div>
 </div>;
}
