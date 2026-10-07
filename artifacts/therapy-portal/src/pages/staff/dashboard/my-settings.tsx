import { useEffect, useState } from "react";
import { customFetch, useGetAuthMe, getGetAuthMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Palette, RotateCcw, Save, Settings2 } from "lucide-react";

const DEFAULTS={layout:"composed",density:"comfortable",navigation:"classic",dashboard:"balanced",accentColor:"#7B4A2F",sidebarColor:"#3F3028",darkBackgroundColor:"#000000",appearance:"system",sidebarLabels:true,sidebarWidth:"standard"};
const PRESETS=[["Earth","#7B4A2F","#3F3028"],["Forest","#3F6B4B","#263D31"],["Plum","#714C76","#33263A"],["Ocean","#3B5F7A","#233545"],["Rose","#9A5B68","#442C31"]];

export default function MySettings(){
 const {data:session}=useGetAuthMe({query:{queryKey:getGetAuthMeQueryKey(),retry:false}});
 const {toast}=useToast();
 const [prefs,setPrefs]=useState(DEFAULTS);
 const [saving,setSaving]=useState(false);
 const load=async()=>{try{const value=await customFetch<any>("/api/settings/staff-preferences",{responseType:"json"});setPrefs({...DEFAULTS,...value});}catch{}};
 useEffect(()=>{void load();},[]);
 const save=async()=>{setSaving(true);try{const value=await customFetch<any>("/api/settings/staff-preferences",{method:"PUT",body:JSON.stringify(prefs),responseType:"json"});setPrefs({...DEFAULTS,...value});window.dispatchEvent(new CustomEvent("ats-staff-preferences-updated",{detail:value}));toast({title:"My Settings saved",description:"Your staff workspace changed for your account only."});}catch(e:any){toast({variant:"destructive",title:"Could not save settings",description:e?.message||"Try again."});}finally{setSaving(false);}};
 return <div className="max-w-6xl space-y-7">
  <div><p className="text-sm text-muted-foreground">Personal staff workspace</p><h1 className="mt-1 font-serif text-4xl">My Settings</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">These controls change only your staff portal. Website branding and practice-management controls live elsewhere.</p></div>
  <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/>Staff workspace customization</CardTitle><CardDescription>Make the staff side feel like yours without touching another employee’s portal.</CardDescription></CardHeader>
   <CardContent className="grid gap-5 sm:grid-cols-2">
    <div><Label>Accent color</Label><div className="mt-2 flex gap-2"><Input type="color" value={prefs.accentColor} onChange={e=>setPrefs(p=>({...p,accentColor:e.target.value}))} className="h-10 w-14 p-1"/><Input value={prefs.accentColor} onChange={e=>setPrefs(p=>({...p,accentColor:e.target.value}))}/></div></div>
    <div><Label>Sidebar color</Label><div className="mt-2 flex gap-2"><Input type="color" value={prefs.sidebarColor} onChange={e=>setPrefs(p=>({...p,sidebarColor:e.target.value}))} className="h-10 w-14 p-1"/><Input value={prefs.sidebarColor} onChange={e=>setPrefs(p=>({...p,sidebarColor:e.target.value}))}/></div></div>
    <div><Label>Dark mode background</Label><div className="mt-2 flex gap-2"><Input type="color" value={prefs.darkBackgroundColor} onChange={e=>setPrefs(p=>({...p,darkBackgroundColor:e.target.value}))} className="h-10 w-14 p-1"/><Input value={prefs.darkBackgroundColor} onChange={e=>setPrefs(p=>({...p,darkBackgroundColor:e.target.value}))} placeholder="#000000"/></div><p className="mt-1 text-xs text-muted-foreground">Only changes your staff portal when dark mode is active.</p></div>
    <div><Label>Appearance</Label><Select value={prefs.appearance} onValueChange={v=>setPrefs(p=>({...p,appearance:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="system">Use device</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></div>
    <div><Label>Workspace feel</Label><Select value={prefs.layout} onValueChange={v=>setPrefs(p=>({...p,layout:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["composed","relaxed","focused","minimal"].map(v=><SelectItem key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>Spacing</Label><Select value={prefs.density} onValueChange={v=>setPrefs(p=>({...p,density:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="compact">Compact</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent></Select></div>
    <div><Label>Navigation style</Label><Select value={prefs.navigation} onValueChange={v=>setPrefs(p=>({...p,navigation:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="classic">Classic sidebar</SelectItem><SelectItem value="compact">Compact sidebar</SelectItem><SelectItem value="rail">Slim rail</SelectItem></SelectContent></Select></div>
    <div><Label>Sidebar width</Label><Select value={prefs.sidebarWidth} onValueChange={v=>setPrefs(p=>({...p,sidebarWidth:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="narrow">Narrow</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="wide">Wide</SelectItem></SelectContent></Select></div>
    <div><Label>Dashboard layout</Label><Select value={prefs.dashboard} onValueChange={v=>setPrefs(p=>({...p,dashboard:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="cards">Card-forward</SelectItem><SelectItem value="flow">Flow-first</SelectItem></SelectContent></Select></div>
    <div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2"><div><p className="text-sm font-medium">Show sidebar labels</p><p className="text-xs text-muted-foreground">Turn this off for an icon-first navigation.</p></div><Switch checked={prefs.sidebarLabels} onCheckedChange={v=>setPrefs(p=>({...p,sidebarLabels:v}))}/></div>
    <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color presets</p><div className="flex flex-wrap gap-2">{PRESETS.map(([name,a,s])=><button key={name} type="button" onClick={()=>setPrefs(p=>({...p,accentColor:a,sidebarColor:s}))} className="rounded-full border px-3 py-1.5 text-xs" style={{borderColor:a}}>{name}</button>)}</div></div>
    <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dark background presets</p><div className="flex flex-wrap gap-2">{[["True Black","#000000"],["Soft Black","#101010"],["Charcoal","#181818"],["Midnight","#101827"],["Deep Plum","#1A101D"]].map(([name,value])=><button key={name} type="button" onClick={()=>setPrefs(p=>({...p,darkBackgroundColor:value}))} className="rounded-full border px-3 py-1.5 text-xs" style={{borderColor:value}}>{name}</button>)}</div></div>
    <div className="flex flex-wrap gap-2 sm:col-span-2"><Button onClick={()=>void save()} disabled={saving}><Save className="mr-2 h-4 w-4"/>{saving?"Saving…":"Save My Settings"}</Button><Button variant="outline" onClick={()=>setPrefs(DEFAULTS)}><RotateCcw className="mr-2 h-4 w-4"/>Reset</Button></div>
   </CardContent>
  </Card>
  <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5"/>My access</CardTitle><CardDescription>Your role and current explicit permissions.</CardDescription></CardHeader><CardContent><Badge>{session?.role||"staff"}</Badge><div className="mt-4 flex flex-wrap gap-2">{Object.entries((session as any)?.permissions||{}).filter(([,v])=>v===true).map(([k])=><Badge key={k} variant="outline">{k}</Badge>)}</div></CardContent></Card>
 </div>;
}