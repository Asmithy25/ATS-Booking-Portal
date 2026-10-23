import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientMe } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type WelcomeDocument = {
  key:string; version:string; title:string; summary:string; label:string;
  status:"needed"|"acknowledged"|"withdrawn"; acknowledgedAt?:string|null;
};

export default function ClientWelcomePackage() {
  const [,setLocation]=useLocation();
  const {data:session,isLoading:isLoadingSession}=useClientMe({query:{retry:false}});
  const {toast}=useToast();
  const [documents,setDocuments]=useState<WelcomeDocument[]>([]);
  const [loading,setLoading]=useState(true);
  const [busyKey,setBusyKey]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const result=await customFetch<{documents:WelcomeDocument[]}>("/api/advanced/client/welcome-package",{responseType:"json"});
      setDocuments(Array.isArray(result.documents)?result.documents:[]);
    } catch(error) {
      toast({variant:"destructive",title:"Welcome package unavailable",description:error instanceof Error?error.message:"Please refresh and try again."});
    } finally {setLoading(false);}
  },[toast]);

  useEffect(()=>{if(session?.authenticated)void load();},[session?.authenticated,load]);

  if(isLoadingSession)return <div className="grid min-h-screen place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div>;
  if(!session?.authenticated){setLocation("/portal/login");return null;}

  const save=async(document:WelcomeDocument,accepted:boolean)=>{
    setBusyKey(document.key);
    try {
      const result=await customFetch<{message:string}>("/api/advanced/client/welcome-package/acknowledge",{
        method:"POST",body:JSON.stringify({key:document.key,version:document.version,accepted}),responseType:"json"
      });
      toast({title:accepted?"Acknowledgement saved":"Acknowledgement withdrawn",description:result.message});
      await load();
    } catch(error) {
      toast({variant:"destructive",title:"Could not save acknowledgement",description:error instanceof Error?error.message:"Please try again."});
    } finally {setBusyKey(null);}
  };

  const completed=documents.filter((document)=>document.status==="acknowledged").length;

  return <main className="min-h-screen bg-[#f7f2e9] text-foreground dark:bg-background">
    <header className="border-b bg-background/90 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8"><Link href="/portal/tools" className="inline-flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4"/>My AWS</Link><Badge variant="outline">Welcome package</Badge></div></header>
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-8 sm:py-12">
      <section className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[.1] via-card to-secondary/[.12] p-6 sm:p-9">
        <div className="flex items-center gap-3 text-primary"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10"><FileCheck2 className="h-5 w-5"/></span><span className="text-xs font-bold uppercase tracking-[.18em]">Your first steps</span></div>
        <h1 className="mt-4 font-serif text-4xl font-medium sm:text-5xl">Welcome to AWS<span className="text-primary">.</span></h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Review these short service and privacy acknowledgements. You can revisit this page later to see which versions you acknowledged and when.</p>
        <div className="mt-5 max-w-md rounded-xl border bg-background/70 p-4"><div className="flex items-center justify-between text-sm"><span className="font-medium">Welcome steps</span><span className="text-muted-foreground">{completed} of {documents.length}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:(documents.length?completed/documents.length*100:0)+"%"}}/></div></div>
      </section>
      <div className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><p><strong className="text-foreground">A clear note:</strong> these are recorded acknowledgements of the information shown here—not an electronic signature, contract, or substitute for reviewing the service's complete applicable privacy and legal documents.</p></div>
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Review each item</h2><p className="mt-1 text-sm text-muted-foreground">Current version is shown on every card.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button></div>
      {loading?<div className="flex justify-center py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading your welcome package…</div>:documents.length?documents.map((document)=>(
        <Card key={document.key} className="rounded-2xl">
          <CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>{document.title}</CardTitle><Badge variant="outline">Version {document.version}</Badge><Badge variant={document.status==="acknowledged"?"default":"secondary"} className="ml-auto">{document.status==="acknowledged"?"Acknowledged":document.status==="withdrawn"?"Withdrawn":"Review needed"}</Badge></div><CardDescription>{document.summary}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6">{document.label}</p><div className="flex shrink-0 flex-wrap gap-2">{document.status==="acknowledged"?<Button variant="outline" onClick={()=>void save(document,false)} disabled={busyKey===document.key}>{busyKey===document.key?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}Withdraw acknowledgement</Button>:<Button onClick={()=>void save(document,true)} disabled={busyKey===document.key}>{busyKey===document.key?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<CheckCircle2 className="mr-2 h-4 w-4"/>}I understand</Button>}</div>{document.acknowledgedAt&&<p className="text-xs text-muted-foreground sm:basis-full">Acknowledged {new Date(document.acknowledgedAt).toLocaleString()}</p>}</CardContent>
        </Card>
      )):<Card className="rounded-2xl"><CardContent className="py-10 text-center text-sm text-muted-foreground">There are no welcome steps available right now.</CardContent></Card>}
      <div className="flex flex-wrap gap-3"><Link href="/portal"><Button variant="outline">Open appointments</Button></Link><Link href="/portal/tools"><Button>Return to My AWS</Button></Link></div>
    </div>
  </main>;
}
