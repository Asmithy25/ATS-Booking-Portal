import { useEffect, useMemo, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ChevronDown, ChevronRight, Crown, Phone, Search, UserRound, UsersRound, ShieldCheck } from "lucide-react";
type Person={email:string;name:string;role:string;roleLabel:string;departmentId?:number|null;department?:string;reportsToEmail?:string|null;bio?:string};
type Department={id:number;name:string;description:string;leaderEmail:string};
type PhoneMember={name:string;division:string;extension:string};
type Data={staff:Person[];departments:Department[];founder?:{name:string;roleLabel:string}};
const founderEmail="ayden@aydenstherapyservices.com";
const normal=(s:string|undefined|null)=>String(s||"").trim().toLowerCase();
export default function OrganizationChart({data}:{data:Data}){
 const [department,setDepartment]=useState("all");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState<string|null>(null);
 const [collapsed,setCollapsed]=useState<string[]>([]);
 const [phone,setPhone]=useState<PhoneMember[]>([]);
 useEffect(()=>{customFetch<{staff:PhoneMember[]}>("/api/phone",{responseType:"json"}).then(result=>setPhone(result.staff||[])).catch(()=>undefined);},[]);
 const people=useMemo(()=>{
  const staff=Array.isArray(data.staff)?data.staff:[];
  const all=[...staff];
  if(!all.some(x=>x.role==="founder"||normal(x.email)===founderEmail))all.unshift({email:founderEmail,name:data.founder?.name||"Founder",role:"founder",roleLabel:"Founder & CEO",department:"ASH Headquarters",reportsToEmail:""});
  return all.map(p=>({...p,email:normal(p.email),reportsToEmail:normal(p.reportsToEmail)}));
 },[data]);
 const roster=useMemo(()=>department==="all"?people:people.filter(p=>String(p.departmentId||"")===department||p.role==="founder"),[people,department]);
 const lookup=useMemo(()=>new Map(roster.map(p=>[p.email,p])),[roster]);
 const children=useMemo(()=>{const out=new Map<string,Person[]>();for(const person of roster){
  const boss=person.reportsToEmail||"";
  if(boss&&boss!==person.email&&lookup.has(boss)){const group=out.get(boss)||[];group.push(person);out.set(boss,group);}
 }for(const group of out.values())group.sort((a,b)=>a.name.localeCompare(b.name));return out;},[roster,lookup]);
 const roots=useMemo(()=>{let base=roster.filter(p=>!p.reportsToEmail||!lookup.has(p.reportsToEmail)||p.reportsToEmail===p.email);
  const reachable=new Set<string>();const visit=(p:Person)=>{if(reachable.has(p.email))return;reachable.add(p.email);for(const ch of children.get(p.email)||[])visit(ch);};
  base.forEach(visit);
  // Malformed cycles can occur when reporting lines are manually edited.
  // Show every orphaned member rather than making them disappear.
  base=[...base,...roster.filter(p=>!reachable.has(p.email))];
  return base.sort((a,b)=>(a.role==="founder"?-1:b.role==="founder"?1:0)||a.name.localeCompare(b.name));
 },[roster,lookup,children]);
 const visible=useMemo(()=>{
  const q=normal(search);if(!q)return null;
  const matches=new Set<string>();const include=(p:Person,seen:Set<string>)=>{
   if(seen.has(p.email))return;
   matches.add(p.email);
   if(p.reportsToEmail&&lookup.has(p.reportsToEmail))include(lookup.get(p.reportsToEmail)!,new Set([...seen,p.email]));
  };
  for(const p of roster)if([p.name,p.roleLabel,p.department,p.email].join(" ").toLowerCase().includes(q))include(p,new Set());
  return matches;
 },[search,roster,lookup]);
 const directory=useMemo(()=>new Map(phone.map(p=>[normal(p.name),p])),[phone]);
 const chosen=selected?lookup.get(selected)||people.find(x=>x.email===selected):undefined;
 const render=(person:Person,ancestry:Set<string>,depth:number):React.ReactNode=>{
  if(ancestry.has(person.email))return null;
  if(visible&&!visible.has(person.email))return null;
  const list=(children.get(person.email)||[]).filter(p=>!visible||visible.has(p.email));
  const folded=collapsed.includes(person.email)&&!search.trim();
  const ext=directory.get(normal(person.name))?.extension||"";
  const isLead=(data.departments||[]).some(d=>normal(d.leaderEmail)===person.email);
  return <div key={person.email} className="space-y-2"><div className="relative">
   <button type="button" onClick={()=>setSelected(person.email)} className={"flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/50 "+(selected===person.email?"border-primary bg-primary/5":"")}>
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{person.role==="founder"?<Crown className="h-5 w-5"/>:person.name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.roleLabel||person.role}{person.department?" · "+person.department:""}</p></div>
    {isLead&&<Badge variant="outline" className="hidden sm:inline-flex">Department head</Badge>}
    {ext&&<span className="text-xs text-muted-foreground"><Phone className="mr-1 inline h-3 w-3"/>{ext}</span>}
   </button>
   {list.length>0&&<Button type="button" size="sm" variant="ghost" className="absolute -bottom-3 left-4 z-10 h-7 rounded-full border bg-background px-2" aria-label={folded?"Expand "+person.name:"Collapse "+person.name} onClick={()=>setCollapsed(old=>old.includes(person.email)?old.filter(x=>x!==person.email):[...old,person.email])}>{folded?<ChevronRight className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}<span className="ml-1 text-xs">{list.length}</span></Button>}
  </div>
  {list.length>0&&!folded&&<div className="ml-5 space-y-3 border-l-2 border-primary/15 py-3 pl-5">{list.map(p=>render(p,new Set([...ancestry,person.email]),depth+1))}</div>}
 </div>;
 };
 return <div className="space-y-6">
  <Card className="rounded-2xl border-primary/30 bg-primary/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><Building2 className="h-7 w-7 text-primary"/></div><div><p className="text-xs uppercase tracking-[.16em] text-primary">Ayden Smith Holdings × Aydens Wellness Services</p><h2 className="font-serif text-2xl font-semibold">Organizational Chart</h2><p className="text-sm text-muted-foreground">{roster.length} people · {data.departments?.length||0} departments · live staff directory</p></div></div><Badge variant="outline">ASH Corporate + AWS</Badge></CardContent></Card>
  <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} className="pl-10" placeholder="Search staff, position or department"/></div><select className="rounded-lg border bg-background px-4 py-2 text-sm" value={department} onChange={e=>{setDepartment(e.target.value);setSelected(null)}}><option value="all">All departments</option>{(data.departments||[]).map(d=><option key={d.id} value={String(d.id)}>{d.name}</option>)}</select><Button variant="outline" onClick={()=>{setCollapsed([]);setSearch("");setDepartment("all");}}>Reset view</Button></div>
  <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary"/>Reporting structure</CardTitle><CardDescription>Expand or collapse teams; select a person for more information. Reporting lines come from the managed staff directory.</CardDescription></CardHeader><CardContent className="space-y-5">{roots.some(p=>!visible||visible.has(p.email))?roots.map(p=>render(p,new Set(),0)):<p className="py-10 text-center text-sm text-muted-foreground">No people match this search.</p>}</CardContent></Card>
   <Card className="h-fit rounded-2xl"><CardHeader><CardTitle>Person / department detail</CardTitle><CardDescription>{chosen?"Selected from the reporting structure.":"Select a staff member to view role details."}</CardDescription></CardHeader><CardContent>{chosen?<div className="space-y-4"><div className="flex items-center gap-3"><UserRound className="h-8 w-8 text-primary"/><div><p className="font-semibold">{chosen.name}</p><p className="text-sm text-muted-foreground">{chosen.roleLabel}</p></div></div><div className="rounded-xl border p-3 text-sm"><strong>Department</strong><p className="mt-1 text-muted-foreground">{chosen.department||"Not assigned"}</p></div><div className="rounded-xl border p-3 text-sm"><strong>Reports to</strong><p className="mt-1 text-muted-foreground">{chosen.reportsToEmail?lookup.get(chosen.reportsToEmail)?.name||"External leadership":"Executive leadership / top level"}</p></div>{directory.get(normal(chosen.name))?.extension&&<div className="rounded-xl border p-3 text-sm"><strong>Phone extension</strong><p className="mt-1 text-muted-foreground">{directory.get(normal(chosen.name))?.extension}</p></div>}</div>:<p className="py-8 text-center text-sm text-muted-foreground">Click a team member for details.</p>}</CardContent></Card></div>
  <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Only staff directory data is displayed here. No personal client or session data is included.</p>
 </div>;
}
