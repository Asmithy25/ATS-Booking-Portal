import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { customFetch, useClientMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, HeartHandshake, MessageSquareText, ShieldCheck, Send, RefreshCcw } from "lucide-react";
type Feedback={id:number;category:string;title:string;details:string;status:string;privateResponse:string;createdAt:string;updatedAt:string};
const categories=[["suggestion","Suggestion"],["complaint","Complaint"],["service_experience","Service experience"],["accessibility","Accessibility"],["other","Other"] ] as const;
const api=<T,>(url:string,init?:RequestInit)=>customFetch<T>("/api/v4/experience"+url,{...init,responseType:"json"});
export default function ClientFeedback(){
 const [,navigate]=useLocation();
 const {data:session,isLoading}=useClientMe({query:{retry:false}});
 const [items,setItems]=useState<Feedback[]>([]),[category,setCategory]=useState("suggestion");
 const [title,setTitle]=useState(""),[details,setDetails]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=async()=>{setLoading(true);try{setItems(await api<Feedback[]>("/client/feedback"));setError("");}catch(e){setError(e instanceof Error?e.message:"Feedback history is unavailable.");}finally{setLoading(false);}};
 useEffect(()=>{if(isLoading)return;if(!session?.authenticated){navigate("/portal/login");return;}void refresh();},[isLoading,session?.authenticated,navigate]);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setNotice("");setError("");
  try{await api("/client/feedback",{method:"POST",body:JSON.stringify({category,title,details})});setTitle("");setDetails("");setNotice("Your feedback has been sent to the AWS review team.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"We couldn't submit your feedback.");}
  finally{setBusy(false);}
 };
 return <div className="min-h-screen bg-background px-4 py-10 text-foreground"><main className="mx-auto max-w-5xl space-y-8">
  <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to my portal</Link>
  <div className="space-y-3"><Badge variant="outline">AWS 4.0 · Your voice matters</Badge><h1 className="font-serif text-4xl">Feedback & suggestions</h1><p className="max-w-3xl text-muted-foreground">Tell us what works, what could be better or where you need assistance with your experience. Only authorized AWS reviewers can access submissions.</p></div>
  {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{notice}</p>}
  <div className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]"><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary"/>Send feedback</CardTitle><CardDescription>Feedback isn't monitored for emergencies or immediate assistance.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4">
   <label className="block space-y-2 text-sm font-semibold">Type of feedback<select required className="w-full rounded-md border bg-background p-3 text-sm" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label className="block space-y-2 text-sm font-semibold">Title<Input required minLength={3} maxLength={140} placeholder="A short summary" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="block space-y-2 text-sm font-semibold">What would you like us to know?<Textarea required minLength={10} maxLength={3000} rows={6} placeholder="Tell us about the experience, idea or concern. Please avoid medical information or other sensitive personal details." value={details} onChange={e=>setDetails(e.target.value)}/></label>
   <Button type="submit" disabled={busy||title.trim().length<3||details.trim().length<10} className="w-full"><Send className="mr-2 h-4 w-4"/>{busy?"Sending...":"Send feedback"}</Button>
   <p className="text-xs leading-5 text-muted-foreground">For an urgent safety concern, contact emergency services or an appropriate crisis service directly. This form is for service feedback, not immediate clinical support.</p>
  </form></CardContent></Card>
  <Card className="rounded-2xl"><CardHeader><div className="flex flex-wrap justify-between gap-2"><CardTitle>My submissions</CardTitle><Button size="sm" variant="outline" onClick={()=>void refresh()}><RefreshCcw className="h-4 w-4"/></Button></div><CardDescription>Track your own feedback and any private reply from the review team.</CardDescription></CardHeader><CardContent className="max-h-[780px] space-y-3 overflow-y-auto">{loading?<p className="py-8 text-sm text-muted-foreground">Loading...</p>:items.length?items.map(item=><div key={item.id} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><strong>{item.title}</strong><Badge variant="outline">{item.status.replaceAll("_"," ")}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.details}</p><p className="mt-2 text-xs text-muted-foreground">{item.category.replaceAll("_"," ")} · {new Date(item.createdAt).toLocaleString()}</p>{item.privateResponse&&<div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Private AWS reply</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.privateResponse}</p></div>}</div>):<div className="py-12 text-center"><HeartHandshake className="mx-auto mb-3 h-9 w-9 text-primary"/><p className="text-sm text-muted-foreground">You haven't submitted feedback yet.</p></div>}</CardContent></Card></div>
  <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Your submissions are associated with your signed-in client account and not displayed publicly.</p>
 </main></div>;
}
