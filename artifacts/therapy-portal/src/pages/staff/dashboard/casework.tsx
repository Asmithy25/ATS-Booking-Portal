import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { customFetch, useGetAuthMe, getGetAuthMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ClipboardList, MessageSquareText, RefreshCcw, Save, ShieldCheck } from "lucide-react";
type Feedback={id:number;clientId:number;category:string;title:string;details:string;status:string;privateResponse:string;reviewedBy?:string;createdAt:string};
type Incident={id:number;reporterName:string;reporterEmail:string;category:string;title:string;description:string;severity:string;status:string;ownerEmail:string;resolution:string;createdAt:string};
type IncidentUpdate={id:number;actorName:string;action:string;details:string;createdAt:string};
const api=<T,>(path:string,init?:RequestInit):Promise<T>=>customFetch<T>("/api/v4/experience"+path,{...init,responseType:"json"});
export default function Casework(){
 const [location]=useLocation();
 const incidentsMode=location.includes("/incidents");
 const {data:session}=useGetAuthMe({query:{queryKey:getGetAuthMeQueryKey(),retry:false}});
 const role=String((session as any)?.role||"");
 const perms=(session as any)?.permissions||{};
 const reviewer=role==="founder"||role==="ash_executive"||role==="manager"||perms.viewClientMessages===true;
 const manager=role==="founder"||role==="ash_executive"||role==="manager"||perms.manageTasks===true;
 const [feedback,setFeedback]=useState<Feedback[]>([]),[incidents,setIncidents]=useState<Incident[]>([]);
 const [selected,setSelected]=useState<Feedback|null>(null),[chosen,setChosen]=useState<Incident|null>(null);
 const [newIncident,setNewIncident]=useState({category:"Operations",title:"",description:"",severity:"medium"});
 const [history,setHistory]=useState<IncidentUpdate[]>([]);
 const [search,setSearch]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=async()=>{
  setLoading(true);
  try{
   if(incidentsMode){const rows=await api<Incident[]>("/staff/incidents");setIncidents(rows);setChosen(c=>c?rows.find(r=>r.id===c.id)||null:null);}
   else{const rows=await api<Feedback[]>("/staff/feedback");setFeedback(rows);setSelected(s=>s?rows.find(x=>x.id===s.id)||null:null);}
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Casework records are unavailable.");}
  finally{setLoading(false);}
 };
 useEffect(()=>{void refresh();},[incidentsMode]);
 const create=async()=>{
  setBusy(true);setError("");setNotice("");
  try{await api("/staff/incidents",{method:"POST",body:JSON.stringify(newIncident)});setNewIncident({category:"Operations",title:"",description:"",severity:"medium"});setNotice("Incident reported. Please complete your Staff Logging entry.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Couldn't submit incident.");}
  finally{setBusy(false);}
 };
 const saveFeedback=async()=>{
  if(!selected)return;setBusy(true);setError("");setNotice("");
  try{await api("/staff/feedback/"+selected.id,{method:"PATCH",body:JSON.stringify({status:selected.status,privateResponse:selected.privateResponse})});setNotice("Feedback review recorded. A manual Staff Log is required.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Feedback review couldn't be saved.");}
  finally{setBusy(false);}
 };
 const saveIncident=async()=>{
  if(!chosen)return;setBusy(true);setError("");setNotice("");
  try{await api("/staff/incidents/"+chosen.id,{method:"PATCH",body:JSON.stringify({status:chosen.status,ownerEmail:chosen.ownerEmail,resolution:chosen.resolution})});setNotice("Incident action recorded. Complete your Staff Log.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Incident update failed.");}
  finally{setBusy(false);}
 };
 const selectIncident=async(item:Incident)=>{setChosen({...item});setHistory([]);try{setHistory(await api<IncidentUpdate[]>("/staff/incidents/"+item.id+"/history"));}catch(e){setError(e instanceof Error?e.message:"Couldn't read the incident timeline.");}};
 const f=feedback.filter(x=>[x.title,x.category,x.status,String(x.clientId)].join(" ").toLowerCase().includes(search.toLowerCase()));
 const i=incidents.filter(x=>[x.title,x.category,x.status,x.reporterName].join(" ").toLowerCase().includes(search.toLowerCase()));
 return <div className="space-y-7">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">AWS 4.0 · Operational accountability</p><h1 className="mt-2 font-serif text-3xl">{incidentsMode?"Incident Management":"Client Feedback Review"}</h1><p className="mt-2 text-sm text-muted-foreground">{incidentsMode?"Report operational concerns, assign ownership and track the resolution trail.":"Review client suggestions and service concerns, and send a private response."}</p></div><Button variant="outline" onClick={()=>void refresh()}><RefreshCcw className="mr-2 h-4 w-4"/>Refresh</Button></div>
  {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-primary/30 p-4 text-sm">{notice}</p>}
  <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
   <div className="space-y-4"><Card className="rounded-2xl"><CardHeader><CardTitle>{incidentsMode?"Incident queue":"Feedback queue"}</CardTitle><CardDescription>{incidentsMode?"Only your incidents and assigned reports are shown unless you're an authorized manager.":"Restricted to staff with client-feedback permissions."}</CardDescription></CardHeader><CardContent className="space-y-3"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records"/><div className="max-h-[620px] space-y-2 overflow-y-auto">{(incidentsMode?i:f).map(row=><button key={row.id} onClick={()=>incidentsMode?void selectIncident(row as Incident):setSelected({...row as Feedback})} className={"block w-full rounded-xl border p-3 text-left hover:bg-muted/60 "+((incidentsMode?chosen?.id:selected?.id)===row.id?"border-primary bg-primary/5":"")}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{row.title}</span><Badge variant="outline">{row.status.replaceAll("_"," ")}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{row.category}{incidentsMode?" · "+(row as Incident).severity:" · Client #"+(row as Feedback).clientId}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</p></button>)}{!loading&&(incidentsMode?i:f).length===0&&<p className="py-8 text-center text-sm text-muted-foreground">No records match your search.</p>}</div></CardContent></Card></div>
   {incidentsMode?<Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary"/>{chosen?"Incident #"+chosen.id:"Report a new incident"}</CardTitle><CardDescription>Use operational facts only; don't include client clinical details or passwords.</CardDescription></CardHeader><CardContent className="space-y-4">{!chosen?<><label className="block space-y-2 text-sm font-semibold">Category<Input maxLength={80} value={newIncident.category} onChange={e=>setNewIncident(s=>({...s,category:e.target.value}))}/></label><label className="block space-y-2 text-sm font-semibold">Title<Input maxLength={180} value={newIncident.title} onChange={e=>setNewIncident(s=>({...s,title:e.target.value}))}/></label><label className="block space-y-2 text-sm font-semibold">Severity<select className="w-full rounded-md border bg-background p-3 text-sm" value={newIncident.severity} onChange={e=>setNewIncident(s=>({...s,severity:e.target.value}))}>{["low","medium","high","critical"].map(s=><option key={s} value={s}>{s}</option>)}</select></label><label className="block space-y-2 text-sm font-semibold">Operational details<Textarea rows={6} maxLength={4000} value={newIncident.description} onChange={e=>setNewIncident(s=>({...s,description:e.target.value}))}/></label><Button disabled={busy||!newIncident.title.trim()||newIncident.description.trim().length<10} onClick={()=>void create()}><ClipboardList className="mr-2 h-4 w-4"/>Report incident</Button></>:<><Button variant="outline" size="sm" onClick={()=>setChosen(null)}>Start another report</Button><div className="rounded-xl border p-4"><p className="font-semibold">{chosen.title}</p><p className="mt-1 text-xs text-muted-foreground">Reported by {chosen.reporterName} · {new Date(chosen.createdAt).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap text-sm">{chosen.description}</p></div>{manager&&<><label className="block space-y-2 text-sm font-semibold">Status<select className="w-full rounded-md border bg-background p-3 text-sm" value={chosen.status} onChange={e=>setChosen(s=>s?{...s,status:e.target.value}:s)}>{["reported","investigating","mitigated","resolved","closed"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label><label className="block space-y-2 text-sm font-semibold">Assigned owner email<Input value={chosen.ownerEmail||""} onChange={e=>setChosen(s=>s?{...s,ownerEmail:e.target.value}:s)}/></label><label className="block space-y-2 text-sm font-semibold">Resolution details<Textarea rows={4} value={chosen.resolution||""} onChange={e=>setChosen(s=>s?{...s,resolution:e.target.value}:s)}/></label><Button disabled={busy} onClick={()=>void saveIncident()}><Save className="mr-2 h-4 w-4"/>Save incident update</Button></>}<h3 className="font-semibold">Incident timeline</h3><div className="space-y-2">{history.map(v=><div className="rounded-xl bg-muted p-3 text-sm" key={v.id}><strong>{v.actorName} · {v.action}</strong><p className="text-xs text-muted-foreground">{v.details} · {new Date(v.createdAt).toLocaleString()}</p></div>)}</div></>}</CardContent></Card>:
   <Card className="rounded-2xl"><CardHeader><CardTitle><MessageSquareText className="mr-2 inline h-5 w-5 text-primary"/>{selected?"Review feedback #"+selected.id:"Select a submission"}</CardTitle></CardHeader><CardContent className="space-y-4">{selected?<><p className="font-semibold">{selected.title}</p><div className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{selected.details}</div><p className="text-xs text-muted-foreground">Client account #{selected.clientId} · {new Date(selected.createdAt).toLocaleString()}</p><label className="block space-y-2 text-sm font-semibold">Review status<select className="w-full rounded-md border bg-background p-3 text-sm" value={selected.status} onChange={e=>setSelected(s=>s?{...s,status:e.target.value}:s)}>{["new","in_review","resolved","closed"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label><label className="block space-y-2 text-sm font-semibold">Private response to client<Textarea rows={6} maxLength={3000} value={selected.privateResponse||""} onChange={e=>setSelected(s=>s?{...s,privateResponse:e.target.value}:s)} placeholder="Respond clearly and avoid sensitive personal or clinical details."/></label><Button disabled={busy} onClick={()=>void saveFeedback()}><Save className="mr-2 h-4 w-4"/>Save feedback review</Button></>:<p className="py-10 text-center text-sm text-muted-foreground">Select a client submission to review.</p>}</CardContent></Card>}
  </div>
  <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Casework is permission-restricted, separately audit logged and subject to mandatory manual Staff Logging after changes.</p>
 </div>;
}
