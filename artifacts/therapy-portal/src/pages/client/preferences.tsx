import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientMe, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, HeartHandshake, Save, Accessibility, ShieldCheck } from "lucide-react";

type Preferences={
 preferredStaff:string; preferredTimeWindow:string; remindersEnabled:boolean;
 onboardingCompleted:boolean; largeText:boolean; reducedMotion:boolean; highContrast:boolean; simplifiedNavigation:boolean;
};
const defaults:Preferences={preferredStaff:"",preferredTimeWindow:"any",remindersEnabled:true,onboardingCompleted:false,largeText:false,reducedMotion:false,highContrast:false,simplifiedNavigation:false};
const api=<T,>(url:string,options?:RequestInit)=>customFetch<T>(url,{...options,responseType:"json"});
export default function ClientPreferences(){
 const [,navigate]=useLocation();
 const {data:session,isLoading}=useClientMe({query:{retry:false}});
 const [prefs,setPrefs]=useState<Preferences>(defaults);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(isLoading)return;if(!session?.authenticated){navigate("/portal/login");return;}api<Preferences>("/api/v4/client/preferences").then(data=>setPrefs({...defaults,...data})).catch(e=>setError(e instanceof Error?e.message:"Preferences could not be loaded.")).finally(()=>setLoading(false));},[isLoading,session?.authenticated,navigate]);
 const change=(field:keyof Preferences,value:string|boolean)=>{setPrefs(current=>({...current,[field]:value}));setSaved(false);};
 const save=async()=>{setSaving(true);setError("");try{const result=await api<Preferences>("/api/v4/client/preferences",{method:"PUT",body:JSON.stringify(prefs)});setPrefs(result);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Preferences could not be saved.");}finally{setSaving(false);}};
 return <div className={"min-h-screen bg-background px-4 py-10 text-foreground "+(prefs.largeText?"text-lg ":"")+(prefs.highContrast?"contrast-125 ":"")+(prefs.reducedMotion?"motion-reduce ":"")}>
  <main className={"mx-auto space-y-8 "+(prefs.simplifiedNavigation?"max-w-2xl":"max-w-4xl")}>
   <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to my client portal</Link>
   <div className="space-y-3"><Badge variant="outline">AWS 4.0 · Client Experience</Badge><h1 className="font-serif text-4xl">Your experience, your way.</h1><p className="text-muted-foreground">Customize your appointment preferences, comfort settings, and onboarding experience. These choices belong to your account.</p></div>
   {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
   {saved&&<p role="status" className="rounded-xl border border-primary/30 p-4 text-sm text-primary">Your preferences have been saved.</p>}
   {loading?<p className="text-sm text-muted-foreground">Loading your preferences...</p>:<>
    <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-primary"/>Appointment preferences</CardTitle><CardDescription>Preferences help staff understand your availability but do not guarantee appointment times or staff assignment.</CardDescription></CardHeader><CardContent className="space-y-5">
      <label className="block space-y-2 text-sm font-medium">Preferred Wellness Staff (optional)<Input maxLength={100} value={prefs.preferredStaff} onChange={e=>change("preferredStaff",e.target.value)} placeholder="Enter the name of a preferred team member"/></label>
      <label className="block space-y-2 text-sm font-medium">Preferred time of day<select value={prefs.preferredTimeWindow} onChange={e=>change("preferredTimeWindow",e.target.value)} className="w-full rounded-md border bg-background p-3 text-sm"><option value="any">No preference</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label>
      <label className="flex items-center gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={prefs.remindersEnabled} onChange={e=>change("remindersEnabled",e.target.checked)}/><span>My reminder preference is enabled (subject to service notification availability).</span></label>
    </CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Accessibility className="h-5 w-5 text-primary"/>Accessibility & comfort</CardTitle><CardDescription>Adjust presentation settings here. Portal-wide application of these preferences may depend on your browser and device.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{([
      ["largeText","Larger text","Increase text size on this screen."],
      ["reducedMotion","Reduce motion","Minimize decorative movement."],
      ["highContrast","High contrast","Increase visual contrast."],
      ["simplifiedNavigation","Simplified layout","Use a narrower, simpler layout."]
     ] as const).map(([key,title,description])=><label key={key} className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" className="mt-1" checked={prefs[key]} onChange={e=>change(key,e.target.checked)}/><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span></label>)}</CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Welcome & onboarding</CardTitle><CardDescription>Review the service information and acknowledgments in your welcome package.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.onboardingCompleted} onChange={e=>change("onboardingCompleted",e.target.checked)}/>I've reviewed the welcome steps</label><Link href="/portal/welcome-package" className="text-sm font-semibold text-primary underline">View welcome package</Link></CardContent></Card>
    <div className="flex flex-wrap items-center justify-between gap-4"><p className="flex max-w-md items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0"/>Do not enter confidential health or appointment notes in preference fields.</p><Button onClick={()=>void save()} disabled={saving}><Save className="mr-2 h-4 w-4"/>{saving?"Saving...":"Save preferences"}</Button></div>
   </>}
  </main>
 </div>;
}
