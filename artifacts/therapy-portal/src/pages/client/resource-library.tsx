import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientMe, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookHeart, Bookmark, BookmarkCheck, HeartHandshake, ShieldCheck, Search } from "lucide-react";

type Resource={id:number;title:string;category:string;description:string;content:string;url:string|null;isEmergency:boolean;bookmarked:boolean};
const api=<T,>(path:string,init?:RequestInit):Promise<T>=>customFetch<T>(path,{...init,responseType:"json"});
export default function WellnessLibrary(){
 const [,nav]=useLocation();const {data:session,isLoading}=useClientMe({query:{retry:false}});
 const [resources,setResources]=useState<Resource[]>([]);
 const [search,setSearch]=useState(""),[category,setCategory]=useState("all"),[savedOnly,setSavedOnly]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState("");
 const load=async()=>{setLoading(true);try{setResources(await api<Resource[]>("/api/v4/suite/client/bookmarks"));setError("");}catch(e){setError(e instanceof Error?e.message:"Wellness Library cannot be loaded right now.");}finally{setLoading(false);}};
 useEffect(()=>{if(isLoading)return;if(!session?.authenticated){nav("/portal/login");return;}void load();},[isLoading,session?.authenticated,nav]);
 const filtered=useMemo(()=>resources.filter(r=>(category==="all"||r.category===category)&&(!savedOnly||r.bookmarked)&&[r.title,r.description,r.category].join(" ").toLowerCase().includes(search.toLowerCase())),[resources,category,savedOnly,search]);
 const categories=useMemo(()=>["all",...new Set(resources.map(r=>r.category))],[resources]);
 const toggle=async(r:Resource)=>{setBusy(r.id);try{await api("/api/v4/suite/client/bookmarks/"+r.id,{method:r.bookmarked?"DELETE":"POST"});setResources(list=>list.map(item=>item.id===r.id?{...item,bookmarked:!r.bookmarked}:item));setError("");}catch(e){setError(e instanceof Error?e.message:"Bookmark update failed.");}finally{setBusy(null);}};
 return <div className="min-h-screen bg-background text-foreground"><main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
  <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Return to my portal</Link>
  <div className="max-w-3xl space-y-4"><Badge variant="outline">AWS 4.0 · Client Library</Badge><h1 className="font-serif text-4xl sm:text-5xl">Your personal wellness library.</h1><p className="text-muted-foreground">Browse published AWS wellness resources, keep your favorites and return to them whenever you like. Bookmarks are private to your account.</p></div>
  {error&&<div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
  <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search wellness resources"/></div><select className="rounded-md border bg-background px-4 py-2 text-sm" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c==="all"?"All categories":c}</option>)}</select><Button variant={savedOnly?"default":"outline"} onClick={()=>setSavedOnly(!savedOnly)}><Bookmark className="mr-2 h-4 w-4"/>{savedOnly?"Saved resources":"Show saved only"}</Button></div>
  {loading?<p className="py-12 text-center text-muted-foreground">Loading wellness resources...</p>:filtered.length?<div className="grid gap-4 md:grid-cols-2">{filtered.map(r=><Card key={r.id} className="rounded-2xl"><CardHeader><div className="flex items-start justify-between gap-2"><Badge variant={r.isEmergency?"destructive":"secondary"}>{r.category}</Badge><Button variant="outline" size="sm" disabled={busy===r.id} aria-label={r.bookmarked?"Remove bookmark":"Save bookmark"} onClick={()=>void toggle(r)}>{r.bookmarked?<BookmarkCheck className="h-4 w-4 text-primary"/>:<Bookmark className="h-4 w-4"/>}{r.bookmarked?"Saved":"Save"}</Button></div><CardTitle>{r.title}</CardTitle><CardDescription>{r.description}</CardDescription></CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap text-sm leading-relaxed">{r.content}</p>{r.url&&/^https:\/\//i.test(r.url)&&<a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-semibold text-primary underline">Visit resource</a>}</CardContent></Card>)}</div>:<Card className="rounded-2xl"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><BookHeart className="h-10 w-10 text-primary"/><h2 className="text-lg font-semibold">No matching resources</h2><p className="text-sm text-muted-foreground">Try another search or category.</p></CardContent></Card>}
  <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>General wellness resources are educational and do not replace professional care or emergency services.</p>
 </main></div>;
}
