import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CalendarDays, ClipboardList, BookOpen, FileCheck2, ArrowRight, RefreshCcw, Sparkles } from "lucide-react";
type Item={id:number;title:string;status:string;assignee:string;createdAt:string};
type Summary={staffName:string;staffRole:string;localDay:string;asOf:string;appointmentsToday:number;openTasks:number;pendingManualLogs:number;trainingToComplete:number;policiesToAcknowledge:number;requestsAwaitingReview:number;work:Item[]};
export default function MyWorkday(){
 const [,navigate]=useLocation();
 const [data,setData]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=async()=>{setLoading(true);try{setData(await customFetch<Summary>("/api/v4/suite/my-workday",{responseType:"json"}));setError("");}catch(e){setError(e instanceof Error?e.message:"My Workday isn't available.");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const summaries=[
  {title:"Appointments today",value:data?.appointmentsToday||0,icon:CalendarDays,path:"/staff/bookings"},
  {title:"Open work items",value:data?.openTasks||0,icon:ClipboardList,path:"/staff/v4/tasks"},
  {title:"Manual logs due",value:data?.pendingManualLogs||0,icon:Activity,path:"/staff/staff-logs"},
  {title:"Training to finish",value:data?.trainingToComplete||0,icon:BookOpen,path:"/staff/v4-suite/training"},
  {title:"Policies to review",value:data?.policiesToAcknowledge||0,icon:FileCheck2,path:"/staff/v4-suite/policies"},
  {title:"Pending requests",value:data?.requestsAwaitingReview||0,icon:ClipboardList,path:"/staff/v4-suite/staff-requests"},
 ];
 return <div className="space-y-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="outline">AWS 4.0 · My Workday</Badge><h1 className="mt-3 font-serif text-3xl font-semibold">Your day, organized.</h1><p className="mt-2 text-sm text-muted-foreground">A personalized operational briefing for {data?.staffName||"your team"}{data?.staffRole?" · "+data.staffRole:""}. All counts reflect permitted work only.</p></div><Button variant="outline" onClick={()=>void load()}><RefreshCcw className="mr-2 h-4 w-4"/>Refresh</Button></div>
  {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
  {loading?<p className="p-8 text-center text-muted-foreground">Preparing your workday...</p>:<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{summaries.map(s=><button key={s.title} onClick={()=>navigate(s.path)} className={"rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary/50 "+(s.title==="Manual logs due"&&s.value>0?"border-amber-400/60":"")}><div className="flex justify-between"><s.icon className="h-6 w-6 text-primary"/><ArrowRight className="h-4 w-4 text-muted-foreground"/></div><p className="mt-4 text-4xl font-semibold">{s.value}</p><p className="mt-1 text-sm text-muted-foreground">{s.title}</p></button>)}</div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card className="rounded-2xl"><CardHeader><CardTitle>Your open work items</CardTitle><CardDescription>Tasks you created or that were assigned to your staff account.</CardDescription></CardHeader><CardContent className="space-y-3">{data?.work?.length?data.work.map(x=><div className="flex items-start justify-between gap-3 rounded-xl border p-3" key={x.id}><div><p className="text-sm font-semibold">{x.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(x.createdAt).toLocaleString()}</p></div><Badge variant="secondary">{x.status.replaceAll("_"," ")}</Badge></div>):<p className="py-8 text-center text-sm text-muted-foreground">No open work items assigned to you.</p>}<Button variant="outline" onClick={()=>navigate("/staff/v4/tasks")}>Manage my tasks<ArrowRight className="ml-2 h-4 w-4"/></Button></CardContent></Card><Card className="rounded-2xl border-primary/20 bg-primary/5"><CardHeader><Sparkles className="h-7 w-7 text-primary"/><CardTitle>Stay on top of what's important</CardTitle><CardDescription>Start with required manual logs, then review outstanding training and policies. Your appointments and assigned tasks are always one click away.</CardDescription></CardHeader><CardContent className="space-y-2"><Button onClick={()=>navigate("/staff/staff-logs")} className="w-full">Open Staff Logging</Button><Button variant="outline" onClick={()=>navigate("/staff/v4")} className="w-full">AWS 4.0 Headquarters</Button><p className="pt-2 text-xs text-muted-foreground">Operational briefing as of {data?.asOf?new Date(data.asOf).toLocaleString():"now"}.</p></CardContent></Card></div></>}
 </div>;
}
