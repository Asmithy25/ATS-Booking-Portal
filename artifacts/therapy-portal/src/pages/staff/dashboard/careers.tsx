import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, RefreshCcw, Plus, Save, ShieldCheck, UserRoundCheck } from "lucide-react";

type Opening = { id:number;title:string;department:string;description:string;requirements:string;active:boolean };
type Application = { id:number;openingId:number;roleTitle:string;firstName:string;lastName:string;phone:string;email:string;status:string;internalNotes:string;createdAt:string;decisionBy?:string };
const api = <T,>(path:string, init?:RequestInit):Promise<T> => customFetch<T>(path,{...init,responseType:"json"});
const blankOpening:Opening={id:0,title:"",department:"",description:"",requirements:"",active:true};
const statusOptions = ["submitted","under_review","approved","denied"];

export default function CareersManagement() {
  const [openings,setOpenings]=useState<Opening[]>([]);
  const [applications,setApplications]=useState<Application[]>([]);
  const [selectedOpening,setSelectedOpening]=useState<Opening>(blankOpening);
  const [selectedApplication,setSelectedApplication]=useState<Application|null>(null);
  const [activeTab,setActiveTab]=useState<"applications"|"openings">("applications");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const refresh=async()=>{
    setError("");
    try {
      const [jobs,applicants]=await Promise.all([api<Opening[]>("/api/v4/careers/admin/openings"),api<Application[]>("/api/v4/careers/admin/applications")]);
      setOpenings(jobs);setApplications(applicants);
      setSelectedApplication(current=>current?applicants.find(item=>item.id===current.id)||null:null);
    } catch(e) { setError(e instanceof Error?e.message:"Could not load recruitment information."); }
  };
  useEffect(()=>{void refresh();},[]);
  const saveOpening=async()=>{
    setBusy(true);setError("");setNotice("");
    try {
      const path=selectedOpening.id?"/api/v4/careers/admin/openings/"+selectedOpening.id:"/api/v4/careers/admin/openings";
      await api(path,{method:selectedOpening.id?"PATCH":"POST",body:JSON.stringify(selectedOpening)});
      setNotice("Job opening saved.");setSelectedOpening(blankOpening);await refresh();
    } catch(e){setError(e instanceof Error?e.message:"Could not save job opening.");}finally{setBusy(false);}
  };
  const saveApplication=async()=>{
    if(!selectedApplication)return;setBusy(true);setError("");setNotice("");
    try {
      await api("/api/v4/careers/admin/applications/"+selectedApplication.id,{method:"PATCH",body:JSON.stringify(selectedApplication)});
      setNotice("Application review saved.");await refresh();
    } catch(e){setError(e instanceof Error?e.message:"Could not update application.");}finally{setBusy(false);}
  };
  const filtered=applications.filter(item=>(item.firstName+" "+item.lastName+" "+item.email+" "+item.roleTitle+" "+item.status).toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">ASH × AWS · Corporate only</p><h1 className="mt-2 font-serif text-3xl font-semibold">Careers & Recruitment</h1><p className="mt-2 text-sm text-muted-foreground">Review applications, publish openings and make hiring decisions. Approval does not create a staff account.</p></div><Button variant="outline" onClick={()=>void refresh()}><RefreshCcw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    <div className="grid gap-3 sm:grid-cols-3">{[{name:"All applications",value:applications.length},{name:"Awaiting review",value:applications.filter(a=>a.status==="submitted"||a.status==="under_review").length},{name:"Open positions",value:openings.filter(o=>o.active).length}].map(item=><Card key={item.name} className="rounded-xl"><CardContent className="pt-6"><p className="text-3xl font-semibold">{item.value}</p><p className="text-xs text-muted-foreground">{item.name}</p></CardContent></Card>)}</div>
    {error&&<div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">{error}</div>}
    {notice&&<div role="status" className="rounded-xl border border-primary/30 p-4 text-sm">{notice}</div>}
    <div className="flex gap-2"><Button variant={activeTab==="applications"?"default":"outline"} onClick={()=>setActiveTab("applications")}>Applications</Button><Button variant={activeTab==="openings"?"default":"outline"} onClick={()=>setActiveTab("openings")}>Openings</Button></div>
    {activeTab==="applications"?<div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Card className="rounded-2xl"><CardHeader><CardTitle>Applicant queue</CardTitle><CardDescription>Accessible only to Founder and ASH Corporate.</CardDescription></CardHeader><CardContent className="space-y-3"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search candidates and positions"/><div className="max-h-[590px] space-y-2 overflow-y-auto">{filtered.map(app=><button key={app.id} type="button" onClick={()=>setSelectedApplication({...app})} className={"w-full rounded-xl border p-3 text-left hover:bg-muted/60 "+(selectedApplication?.id===app.id?"border-primary bg-primary/5":"")}><div className="flex items-center justify-between gap-2"><span className="font-medium">{app.firstName} {app.lastName}</span><Badge variant="outline">{app.status.replaceAll("_"," ")}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{app.roleTitle} · AWS-{app.id}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(app.createdAt).toLocaleString()}</p></button>)}{filtered.length===0&&<p className="py-8 text-center text-sm text-muted-foreground">No applications match your search.</p>}</div></CardContent></Card>
      {selectedApplication?<Card className="rounded-2xl"><CardHeader><CardTitle>Review AWS-{selectedApplication.id}</CardTitle><CardDescription>Only corporate reviewers can change applicant details, notes, or decisions.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">First name<Input value={selectedApplication.firstName} onChange={e=>setSelectedApplication({...selectedApplication,firstName:e.target.value})}/></label><label className="text-xs font-semibold">Last name<Input value={selectedApplication.lastName} onChange={e=>setSelectedApplication({...selectedApplication,lastName:e.target.value})}/></label></div>
        <label className="block text-xs font-semibold">Email<Input type="email" value={selectedApplication.email} onChange={e=>setSelectedApplication({...selectedApplication,email:e.target.value})}/></label>
        <label className="block text-xs font-semibold">Phone<Input value={selectedApplication.phone} onChange={e=>setSelectedApplication({...selectedApplication,phone:e.target.value})}/></label>
        <p className="text-sm"><strong>Applied for:</strong> {selectedApplication.roleTitle}</p>
        <label className="block text-xs font-semibold">Application status<select className="mt-1 w-full rounded-md border bg-background p-3 text-sm" value={selectedApplication.status} onChange={e=>setSelectedApplication({...selectedApplication,status:e.target.value})}>{statusOptions.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
        <label className="block text-xs font-semibold">Private recruitment notes<Textarea rows={5} value={selectedApplication.internalNotes||""} onChange={e=>setSelectedApplication({...selectedApplication,internalNotes:e.target.value})} placeholder="Internal reviewer notes. Avoid unnecessary sensitive information."/></label>
        <Button onClick={()=>void saveApplication()} disabled={busy}><Save className="mr-2 h-4 w-4"/>Save application</Button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Changes are captured in the AWS audit log and require a staff activity entry.</p>
      </CardContent></Card>:<Card className="rounded-2xl"><CardContent className="py-14 text-center text-muted-foreground"><UserRoundCheck className="mx-auto mb-3 h-9 w-9"/>Select an applicant to review.</CardContent></Card>}
    </div>:<div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Card className="rounded-2xl"><CardHeader><CardTitle>Published & draft openings</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" onClick={()=>setSelectedOpening(blankOpening)}><Plus className="mr-2 h-4 w-4"/>New opening</Button>{openings.map(job=><button key={job.id} onClick={()=>setSelectedOpening({...job})} className={"block w-full rounded-xl border p-3 text-left hover:bg-muted/60 "+(selectedOpening.id===job.id?"border-primary bg-primary/5":"")}><p className="font-semibold">{job.title}</p><p className="text-xs text-muted-foreground">{job.department} · {job.active?"Accepting applications":"Closed"}</p></button>)}</CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle>{selectedOpening.id?"Edit role":"Publish a new role"}</CardTitle><CardDescription>Only active roles appear on the public Careers page.</CardDescription></CardHeader><CardContent className="space-y-4">
        <label className="block text-xs font-semibold">Position title<Input value={selectedOpening.title} onChange={e=>setSelectedOpening({...selectedOpening,title:e.target.value})}/></label>
        <label className="block text-xs font-semibold">Department<Input value={selectedOpening.department} onChange={e=>setSelectedOpening({...selectedOpening,department:e.target.value})}/></label>
        <label className="block text-xs font-semibold">Description<Textarea rows={6} value={selectedOpening.description} onChange={e=>setSelectedOpening({...selectedOpening,description:e.target.value})}/></label>
        <label className="block text-xs font-semibold">Requirements<Textarea rows={4} value={selectedOpening.requirements} onChange={e=>setSelectedOpening({...selectedOpening,requirements:e.target.value})}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedOpening.active} onChange={e=>setSelectedOpening({...selectedOpening,active:e.target.checked})}/>Accepting applications</label>
        <Button disabled={busy||!selectedOpening.title.trim()||!selectedOpening.description.trim()} onClick={()=>void saveOpening()}><BriefcaseBusiness className="mr-2 h-4 w-4"/>Save position</Button>
      </CardContent></Card>
    </div>}
  </div>;
}
