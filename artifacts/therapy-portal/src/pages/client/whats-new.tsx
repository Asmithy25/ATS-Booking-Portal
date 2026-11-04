import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientMe, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
type Guide={id:number;title:string;description:string;body:string;createdAt:string;acknowledged:boolean};
const api=<T,>(path:string,init?:RequestInit)=>customFetch<T>("/api/v4/suite"+path,{...init,responseType:"json"});
export default function ClientWhatsNew(){
 const [,navigate]=useLocation();const {data:session,isLoading}=useClientMe({query:{retry:false}});
 const [guides,setGuides]=useState<Guide[]>([]),[selected,setSelected]=useState<number|null>(null),[step,setStep]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const refresh=async()=>{setLoading(true);try{const g=await api<Guide[]>("/whats-new/client");setGuides(g);setSelected(x=>x===null?g[0]?.id??null:x);setError("");}catch(e){setError(e instanceof Error?e.message:"Release guides are not available.");}finally{setLoading(false);}};
 useEffect(()=>{if(isLoading)return;if(!session?.authenticated){navigate("/portal/login");return;}void refresh();},[isLoading,session?.authenticated,navigate]);
 const guide=guides.find(g=>g.id===selected);
 const steps=guide?.body.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean)||[];
 const acknowledge=async()=>{if(!guide)return;setBusy(true);try{await api("/whats-new/client/"+guide.id+"/ack",{method:"POST"});setGuides(g=>g.map(x=>x.id===guide.id?{...x,acknowledged:true}:x));setError("");}catch(e){setError(e instanceof Error?e.message:"Could not save your acknowledgment.");}finally{setBusy(false);}};
 return <div className="min-h-screen bg-background px-4 py-10 text-foreground"><main className="mx-auto max-w-5xl space-y-8">
  <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to client portal</Link>
  <div className="space-y-3"><Badge variant="outline">AWS 4.0 · What's New</Badge><h1 className="font-serif text-4xl">Discover what's new.</h1><p className="text-muted-foreground">Guided introductions to changes that matter for your AWS experience.</p></div>
  {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
  {loading?<p className="py-8 text-muted-foreground">Loading release information...</p>:guides.length===0?<Card className="rounded-2xl"><CardContent className="py-12 text-center"><PartyPopper className="mx-auto mb-4 h-10 w-10 text-primary"/><h2 className="text-xl font-semibold">New release walkthroughs are coming.</h2><p className="mt-2 text-sm text-muted-foreground">Published guides will appear here when announced.</p></CardContent></Card>:
   <div className="grid gap-5 lg:grid-cols-[.65fr_1.35fr]">
    <Card className="rounded-2xl"><CardHeader><CardTitle>Release guides</CardTitle></CardHeader><CardContent className="space-y-2">{guides.map(g=><button key={g.id} onClick={()=>{setSelected(g.id);setStep(0);}} className={"w-full rounded-xl border p-3 text-left "+(selected===g.id?"border-primary bg-primary/5":"")}><div className="flex items-center justify-between gap-2"><p className="font-semibold">{g.title}</p>{g.acknowledged?<CheckCircle2 className="h-4 w-4 text-primary"/>:<Sparkles className="h-4 w-4 text-primary"/>}</div><p className="mt-1 text-xs text-muted-foreground">{g.description}</p></button>)}</CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle>{guide?.title}</CardTitle><CardDescription>{guide?.description} · {guide&&new Date(guide.createdAt).toLocaleDateString()}</CardDescription></CardHeader><CardContent className="space-y-5">{guide&&<><div className="flex items-center justify-between"><Badge variant="secondary">Step {Math.min(step+1,steps.length)} of {steps.length}</Badge>{guide.acknowledged&&<Badge>Reviewed</Badge>}</div><div className="min-h-[160px] whitespace-pre-wrap rounded-xl border bg-muted/30 p-5 text-sm leading-7">{steps[step]}</div><div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}><ArrowLeft className="mr-1 h-4 w-4"/>Previous</Button>{step<steps.length-1?<Button onClick={()=>setStep(s=>Math.min(steps.length-1,s+1))}>Next<ArrowRight className="ml-1 h-4 w-4"/></Button>:<Button disabled={busy||guide.acknowledged} onClick={()=>void acknowledge()}><CheckCircle2 className="mr-1 h-4 w-4"/>{guide.acknowledged?"Already reviewed":"Mark guide reviewed"}</Button>}</div></>}</CardContent></Card>
   </div>}
 </main></div>;
}
