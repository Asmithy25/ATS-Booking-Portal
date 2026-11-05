import {useEffect,useState} from "react";
import {customFetch,useGetAuthMe,getGetAuthMeQueryKey} from "@workspace/api-client-react";
import {Card,CardHeader,CardTitle,CardContent,CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Badge} from "@/components/ui/badge";
type RequestItem={id:number;actorEmail:string;actorName:string;publicTitle:string;bio:string;availabilityNote:string;status:string;reviewNote:string;createdAt:string};
type Profile={name:string;email:string;roleLabel:string;publicTitle:string;bio:string;availabilityNote:string;requests:RequestItem[]};
const call=<T,>(path:string,options?:RequestInit)=>customFetch<T>("/api/v4/profiles"+path,{...options,responseType:"json"});
export default function StaffProfileStudio(){
 const {data:session}=useGetAuthMe({query:{queryKey:getGetAuthMeQueryKey(),retry:false}});
 const corporate=["founder","ash_executive"].includes(String((session as any)?.role||""));
 const [profile,setProfile]=useState<Profile|null>(null),[queue,setQueue]=useState<RequestItem[]>([]);
 const [draft,setDraft]=useState({publicTitle:"",bio:"",availabilityNote:""});
 const [reason,setReason]=useState<Record<number,string>>({});
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const load=async()=>{try{
  const own=await call<Profile>("/me");setProfile(own);setDraft({publicTitle:own.publicTitle,bio:own.bio,availabilityNote:own.availabilityNote});
  if(corporate)setQueue(await call<RequestItem[]>("/admin/requests"));
  setError("");
 }catch(e){setError(e instanceof Error?e.message:"Could not load staff profiles.");}};
 useEffect(()=>{void load();},[corporate]);
 const submit=async()=>{setBusy(true);setError("");try{
  await call("/me/requests",{method:"POST",body:JSON.stringify(draft)});
  setNotice("Submitted for corporate approval. Please complete Staff Logging.");await load();
 }catch(e){setError(e instanceof Error?e.message:"Could not request a profile update.");}finally{setBusy(false);}};
 const decide=async(id:number,status:"approved"|"denied")=>{setBusy(true);setError("");try{
  await call("/admin/requests/"+id,{method:"PATCH",body:JSON.stringify({status,reviewNote:reason[id]||""})});
  setNotice("Review recorded. Complete your required Staff Logging entry.");await load();
 }catch(e){setError(e instanceof Error?e.message:"Review failed.");}finally{setBusy(false);}};
 return <div className="space-y-6"><div><Badge variant="outline">AWS 4.0 · People</Badge><h1 className="mt-3 font-serif text-3xl">Staff Profile Studio</h1><p className="mt-2 text-sm text-muted-foreground">Request profile changes and track leadership approvals. Published titles never alter security permissions.</p></div>
 {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
 {notice&&<p role="status" className="rounded-lg border border-primary/20 p-3 text-sm">{notice}</p>}
 <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>My profile</CardTitle><CardDescription>{profile?.name||"Staff"} · {profile?.roleLabel||""}</CardDescription></CardHeader><CardContent className="space-y-3">
 <label className="block space-y-2 text-sm font-semibold">Public title<Input maxLength={140} value={draft.publicTitle} onChange={e=>setDraft(s=>({...s,publicTitle:e.target.value}))}/></label>
 <label className="block space-y-2 text-sm font-semibold">Profile biography<Textarea rows={5} maxLength={1200} value={draft.bio} onChange={e=>setDraft(s=>({...s,bio:e.target.value}))}/></label>
 <label className="block space-y-2 text-sm font-semibold">Availability note<Textarea rows={3} maxLength={500} value={draft.availabilityNote} onChange={e=>setDraft(s=>({...s,availabilityNote:e.target.value}))}/></label>
 <Button disabled={busy||!profile||profile.requests.some(r=>r.status==="pending")} onClick={()=>void submit()}>Request profile approval</Button></CardContent></Card>
 <Card><CardHeader><CardTitle>My request history</CardTitle></CardHeader><CardContent className="space-y-3">{profile?.requests.length?profile.requests.map(r=><div key={r.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{r.publicTitle||"Profile change"}</strong><Badge variant="outline">{r.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>{r.reviewNote&&<p className="mt-2 text-sm">{r.reviewNote}</p>}</div>):<p className="text-sm text-muted-foreground">No requests yet.</p>}</CardContent></Card>
 </div>
 {corporate&&<Card><CardHeader><CardTitle>Corporate profile approval queue</CardTitle><CardDescription>Founder and ASH Corporate can approve other staff members' proposed profile information.</CardDescription></CardHeader><CardContent className="space-y-4">{queue.length?queue.map(r=><div key={r.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{r.actorName}</strong><Badge variant="outline">{r.status}</Badge></div><p className="text-sm"><strong>Title:</strong> {r.publicTitle||"No title"}</p><p className="whitespace-pre-wrap text-sm">{r.bio}</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{r.availabilityNote}</p>{r.status==="pending"&&<><label className="block space-y-2 text-sm font-semibold">Review note<Textarea rows={2} maxLength={1000} value={reason[r.id]||""} onChange={e=>setReason(s=>({...s,[r.id]:e.target.value}))}/></label><div className="flex gap-2"><Button disabled={busy||r.actorEmail===profile?.email} onClick={()=>void decide(r.id,"approved")}>Approve</Button><Button variant="outline" disabled={busy} onClick={()=>void decide(r.id,"denied")}>Deny</Button></div></>}</div>):<p className="text-sm text-muted-foreground">No profile requests pending.</p>}</CardContent></Card>}
 </div>;
}
