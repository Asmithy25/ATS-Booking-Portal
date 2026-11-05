import { useEffect, useMemo, useState } from "react";
import { customFetch, useGetAuthMe, getGetAuthMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Lock, MessageSquareText, Pin, Plus, RefreshCcw, Send, ShieldCheck } from "lucide-react";
type Department={id:number;name:string;description:string;leaderEmail:string};
type Thread={id:number;departmentId:number;title:string;summary:string;locked:boolean;pinned:boolean;createdBy:string;createdName:string;createdAt:string;updatedAt:string;replyCount:number};
type Post={id:number;authorEmail:string;authorName:string;body:string;createdAt:string};
const api=<T,>(url:string,init?:RequestInit)=>customFetch<T>("/api/v4/discussions"+url,{...init,responseType:"json"});
export default function DepartmentDiscussions(){
 const {data:session}=useGetAuthMe({query:{queryKey:getGetAuthMeQueryKey(),retry:false}});
 const email=String((session as any)?.email||"").toLowerCase(),role=String((session as any)?.role||"");
 const corporate=role==="founder"||role==="ash_executive";
 const [departments,setDepartments]=useState<Department[]>([]);
 const [dept,setDept]=useState<number|null>(null);
 const [threads,setThreads]=useState<Thread[]>([]),[selected,setSelected]=useState<Thread|null>(null),[posts,setPosts]=useState<Post[]>([]);
 const [title,setTitle]=useState(""),[summary,setSummary]=useState(""),[reply,setReply]=useState(""),[search,setSearch]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const loadDepartments=async()=>{try{const d=await api<Department[]>("/departments");setDepartments(d);setDept(s=>s??d[0]?.id??null);setError("");}catch(e){setError(e instanceof Error?e.message:"Can't load your departments.");}};
 useEffect(()=>{void loadDepartments();},[]);
 const reload=async()=>{
  if(!dept){setThreads([]);setLoading(false);return;}
  setLoading(true);try{const rows=await api<Thread[]>("/departments/"+dept+"/threads");setThreads(rows);setSelected(x=>x?rows.find(r=>r.id===x.id)||null:null);setError("");}
  catch(e){setError(e instanceof Error?e.message:"Department discussions couldn't be loaded.");}
  finally{setLoading(false);}
 };
 useEffect(()=>{setSelected(null);setPosts([]);void reload();},[dept]);
 const open=async(item:Thread)=>{setSelected({...item});setPosts([]);try{setPosts(await api<Post[]>("/threads/"+item.id+"/posts"));}catch(e){setError(e instanceof Error?e.message:"Can't open this discussion.");}};
 const create=async()=>{
  if(!dept)return;setBusy(true);setError("");setNotice("");
  try{await api("/departments/"+dept+"/threads",{method:"POST",body:JSON.stringify({title,summary})});setTitle("");setSummary("");setNotice("Discussion created. Record this action in Staff Logging.");await reload();}
  catch(e){setError(e instanceof Error?e.message:"Couldn't create a topic.");}finally{setBusy(false);}
 };
 const submit=async()=>{
  if(!selected||!reply.trim())return;setBusy(true);setError("");setNotice("");
  try{await api("/threads/"+selected.id+"/posts",{method:"POST",body:JSON.stringify({body:reply})});setReply("");setNotice("Reply posted. Complete your Staff Log.");await open(selected);}
  catch(e){setError(e instanceof Error?e.message:"Couldn't post your reply.");}finally{setBusy(false);}
 };
 const moderate=async(item:Thread,field:"locked"|"pinned")=>{
  setBusy(true);setError("");try{const next=await api<Thread>("/threads/"+item.id+"/moderate",{method:"PATCH",body:JSON.stringify({[field]:!item[field]})});setSelected({...item,[field]:next[field]});setNotice("Moderation recorded. Complete your Staff Log.");await reload();}
  catch(e){setError(e instanceof Error?e.message:"Cannot moderate this topic.");}finally{setBusy(false);}
 };
 const selectedDept=departments.find(x=>x.id===dept),moderator=corporate||selectedDept?.leaderEmail?.toLowerCase()===email;
 const visible=useMemo(()=>threads.filter(t=>[t.title,t.summary,t.createdName].join(" ").toLowerCase().includes(search.toLowerCase())),[threads,search]);
 return <div className="space-y-6">
  <div className="space-y-2"><Badge variant="outline">AWS 4.0 · Team Communication</Badge><h1 className="font-serif text-3xl">Department Discussions</h1><p className="text-sm text-muted-foreground">Share work updates, collaborate within your department, and keep important threads accessible to the right staff.</p></div>
  {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="rounded-lg border border-primary/20 p-3 text-sm">{notice}</p>}
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary"/><select className="rounded-lg border bg-background p-2 text-sm" value={dept??""} onChange={e=>setDept(Number(e.target.value)||null)}><option value="" disabled>Select department</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><Button variant="outline" onClick={()=>void reload()}><RefreshCcw className="mr-2 h-4 w-4"/>Refresh</Button></div>
  <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
   <div className="space-y-4">
    <Card className="rounded-2xl"><CardHeader><CardTitle>Topics</CardTitle><CardDescription>Only authorized members can open and participate.</CardDescription></CardHeader><CardContent className="space-y-3"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search topics"/><div className="max-h-[520px] space-y-2 overflow-y-auto">{loading?<p className="py-8 text-center text-sm">Loading...</p>:visible.map(t=><button key={t.id} type="button" onClick={()=>void open(t)} className={"w-full rounded-xl border p-3 text-left hover:bg-muted/60 "+(selected?.id===t.id?"border-primary bg-primary/5":"")}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{t.title}</p>{t.pinned?<Pin className="h-4 w-4 text-primary"/>:t.locked?<Lock className="h-4 w-4 text-muted-foreground"/>:null}</div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.summary}</p><p className="mt-2 text-xs text-muted-foreground">{t.createdName} · {t.replyCount} replies · {new Date(t.updatedAt).toLocaleString()}</p></button>)}{!loading&&!visible.length&&<p className="py-8 text-center text-sm text-muted-foreground">No matching discussions.</p>}</div></CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Start a discussion</CardTitle><CardDescription>Keep topics focused on operations; avoid client medical information.</CardDescription></CardHeader><CardContent className="space-y-3"><label className="block space-y-2 text-sm font-semibold">Topic title<Input maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block space-y-2 text-sm font-semibold">Summary<Textarea rows={4} maxLength={3000} value={summary} onChange={e=>setSummary(e.target.value)}/></label><Button disabled={!dept||busy||title.trim().length<3||summary.trim().length<3} onClick={()=>void create()}><Plus className="mr-2 h-4 w-4"/>Create topic</Button></CardContent></Card>
   </div>
   <Card className="h-fit rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary"/>{selected?selected.title:"Choose a discussion"}</CardTitle><CardDescription>{selected?selected.summary:"Select a department topic to see posts and replies."}</CardDescription></CardHeader><CardContent className="space-y-4">{selected?<><div className="flex flex-wrap gap-2"><Badge variant="outline">{selected.locked?"Locked":"Open"}</Badge>{selected.pinned&&<Badge>Important topic</Badge>}{moderator&&<><Button size="sm" variant="outline" disabled={busy} onClick={()=>void moderate(selected,"locked")}>{selected.locked?"Unlock":"Lock"} topic</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void moderate(selected,"pinned")}>{selected.pinned?"Unpin":"Pin"} topic</Button></>}</div><div className="max-h-[480px] space-y-3 overflow-y-auto">{posts.map(p=><div key={p.id} className="rounded-xl border p-3"><p className="text-xs font-semibold">{p.authorName} · {new Date(p.createdAt).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p></div>)}{!posts.length&&<p className="py-10 text-center text-sm text-muted-foreground">No replies yet. Be the first to contribute.</p>}</div>{!selected.locked||moderator?<div className="space-y-3"><Textarea rows={4} maxLength={3000} placeholder="Write a thoughtful work-related reply" value={reply} onChange={e=>setReply(e.target.value)}/><Button disabled={busy||!reply.trim()} onClick={()=>void submit()}><Send className="mr-2 h-4 w-4"/>Post reply</Button></div>:<p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground"><Lock className="mr-2 inline h-4 w-4"/>Department leadership has locked this discussion.</p>}</>:<p className="py-12 text-center text-sm text-muted-foreground">Your department conversations are private to assigned team members and authorized executives.</p>}</CardContent></Card>
  </div>
  <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Department membership and moderation rules are enforced by the API. Staff changes are subject to manual logging.</p>
 </div>;
}
