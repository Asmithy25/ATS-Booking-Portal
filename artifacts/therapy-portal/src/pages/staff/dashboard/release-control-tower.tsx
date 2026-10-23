import { useCallback, useEffect, useState } from "react";
import { customFetch, useGetAuthMe } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Circle, Clock3, Database, ExternalLink, GitBranch, RefreshCw, ShieldCheck } from "lucide-react";

type Health = {
  service?:string; environment?:string; uptimeSeconds?:number; checkedAt?:string;
  database?:{status:string;latencyMs?:number}; tables?:Array<{name:string;status:string;count:number|null}>;
  scheduler?:{status:string;cadenceSeconds?:number}; frontend?:{status:string;originHint?:string};
};
const CHECKS=[
  {id:"backup",title:"Fresh pre-release backup created",detail:"Download a new backup and keep it in a secure location before database-changing releases."},
  {id:"ci",title:"GitHub Actions checks passed",detail:"Open CI and confirm typecheck plus both application builds are green."},
  {id:"migration",title:"Database changes reviewed",detail:"Use additive, reviewed migrations. Do not approve a destructive Drizzle push prompt just to make a deploy pass."},
  {id:"rollback",title:"Rollback and smoke-test plan ready",detail:"Know which release to restore and verify login, bookings, client portal, and notifications after deployment."},
];

export default function ReleaseControlTower() {
  const {data:auth}=useGetAuthMe();
  const {toast}=useToast();
  const [health,setHealth]=useState<Health|null>(null);
  const [healthStatus,setHealthStatus]=useState<"idle"|"checking"|"ok"|"error">("idle");
  const [manual,setManual]=useState<Record<string,boolean>>(()=>{
    try {const raw=window.localStorage.getItem("aws-release-readiness-checks-v1");return raw?JSON.parse(raw):{};}catch{return {};}
  });
  const [checkedAt,setCheckedAt]=useState<Date|null>(null);

  useEffect(()=>{try{window.localStorage.setItem("aws-release-readiness-checks-v1",JSON.stringify(manual));}catch{/* checklist is optional */}},[manual]);

  const runChecks=useCallback(async()=>{
    setHealthStatus("checking");
    try {
      const [api,workspace]=await Promise.all([
        customFetch<{status:string}>("/api/healthz",{responseType:"json",cache:"no-store"}),
        customFetch<Health>("/api/workspace/health",{responseType:"json",cache:"no-store"}),
      ]);
      const value=workspace||{};
      setHealth({...value,service:value.service||"Aydens Wellness Services API",frontend:value.frontend||{status:"unknown"},scheduler:value.scheduler||{status:"unknown"},database:value.database||{status:api.status==="ok"?"reachable":"unknown"}});
      setCheckedAt(new Date());
      const healthy=api.status==="ok"&&value.database?.status==="healthy"&&value.tables?.every((table)=>table.status==="healthy");
      setHealthStatus(healthy?"ok":"error");
      if(healthy)toast({title:"Live health checks passed",description:"The API, database probe, and reported core tables are responding."});
      else toast({variant:"destructive",title:"Health checks found a warning",description:"Review the database and table states below. This does not check GitHub CI or Render deployment status."});
    }catch(error){
      setHealthStatus("error");
      toast({variant:"destructive",title:"Release health check failed",description:error instanceof Error?error.message:"The API or workspace health endpoint could not be reached."});
    }
  },[toast]);

  if((auth as any)?.authenticated&&(auth as any)?.role!=="founder")return <Card className="rounded-2xl"><CardHeader><CardTitle>Founder access required</CardTitle><CardDescription>Release readiness includes database and operational details.</CardDescription></CardHeader></Card>;

  const completed=CHECKS.filter((item)=>manual[item.id]).length;
  const healthLabel=healthStatus==="ok"?"Passed":healthStatus==="error"?"Review needed":healthStatus==="checking"?"Checking…":"Not checked";

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[.12] via-card to-secondary/[.13] p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><Activity className="h-4 w-4"/> AWS / Release operations</div><h1 className="mt-3 font-serif text-4xl font-medium sm:text-5xl">Release Control Tower<span className="text-primary">.</span></h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">A safety checklist plus live API/database smoke checks. This console does not trigger Render deployments or claim GitHub CI passed; those are linked separately for you to verify.</p></div><Button onClick={()=>void runChecks()} disabled={healthStatus==="checking"}>{healthStatus==="checking"?<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>:<Activity className="mr-2 h-4 w-4"/>}Run live checks</Button></div></section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live API / database</p><div className="mt-2 flex items-center gap-2"><Badge variant={healthStatus==="ok"?"default":healthStatus==="error"?"destructive":"secondary"}>{healthLabel}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{checkedAt?"Checked "+checkedAt.toLocaleTimeString():"Run a live check to inspect status."}</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Database latency</p><p className="mt-2 font-serif text-3xl">{health?.database?.latencyMs!==undefined?health.database.latencyMs+" ms":"—"}</p><p className="mt-1 text-xs text-muted-foreground">One query probe</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API uptime</p><p className="mt-2 font-serif text-3xl">{health?.uptimeSeconds!==undefined?Math.floor(health.uptimeSeconds/3600)+"h "+Math.floor((health.uptimeSeconds%3600)/60)+"m":"—"}</p><p className="mt-1 text-xs text-muted-foreground">Current process only</p></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Release checklist</p><p className="mt-2 font-serif text-3xl">{completed}/{CHECKS.length}</p><p className="mt-1 text-xs text-muted-foreground">Manual confirmations in this browser</p></CardContent></Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Pre-release safety checklist</CardTitle><CardDescription>Check each item only after verifying it. State is local to this browser and does not auto-confirm a backup, CI run, or migration.</CardDescription></CardHeader><CardContent className="space-y-3">{CHECKS.map((item)=> <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 hover:bg-muted/30"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={manual[item.id]===true} onChange={(e)=>setManual((current)=>({...current,[item.id]:e.target.checked}))}/><span className="min-w-0 flex-1"><span className="block font-medium">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span></span>{manual[item.id]?<CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600"/>:<Circle className="mt-0.5 h-4 w-4 text-muted-foreground"/>}</label>)}
       <div className="flex flex-wrap gap-2 pt-2"><Button variant="outline" onClick={()=>window.open("https://github.com/Asmithy25/ATS-Booking-Portal/actions","_blank","noopener,noreferrer")}><GitBranch className="mr-2 h-4 w-4"/>Open GitHub CI<ExternalLink className="ml-2 h-3 w-3"/></Button><Button variant="outline" onClick={()=>window.open("https://dashboard.render.com","_blank","noopener,noreferrer")}>Open Render<ExternalLink className="ml-2 h-3 w-3"/></Button><Button variant="ghost" onClick={()=>setManual({})}>Reset checklist</Button></div>
      </CardContent></Card>

      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary"/>Core database tables</CardTitle><CardDescription>Read-only results from the authenticated workspace health check.</CardDescription></CardHeader><CardContent className="space-y-2">{health?.tables?.length?health.tables.map((table)=><div key={table.name} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{table.name}</p><p className="text-xs text-muted-foreground">{table.count===null?"Count unavailable":table.count.toLocaleString()+" rows"}</p></div><Badge variant={table.status==="healthy"?"default":"destructive"}>{table.status}</Badge></div>):<div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 h-5 w-5"/>Run live checks to see table status.</div>}
       <div className="rounded-xl border border-amber-500/25 bg-amber-500/[.06] p-4 text-sm leading-6"><AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600"/>Before a database-changing deployment, verify a backup and inspect migration scripts. Live health checks cannot prove that a release is safe to apply.</div>
       <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={()=>window.location.href=import.meta.env.BASE_URL+"staff/system-health"}>System Health<ArrowUpRight className="ml-2 h-4 w-4"/></Button><Button variant="outline" onClick={()=>window.location.href=import.meta.env.BASE_URL+"staff/backup"}>Backup & Recovery<ArrowUpRight className="ml-2 h-4 w-4"/></Button></div>
      </CardContent></Card>
    </div>
  </div>;
}
