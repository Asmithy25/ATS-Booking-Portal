import { useEffect, useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Users, Settings2, KeyRound, Eye } from "lucide-react";
export default function ManagementSettings(){
 const {toast}=useToast();const [pinLength,setPinLength]=useState<4|6|8>(6);const [saving,setSaving]=useState(false);
 useEffect(()=>{customFetch<any>("/api/final/security/policy",{responseType:"json"}).then(v=>setPinLength(v.pinLength)).catch(()=>undefined);},[]);
 const save=async()=>{setSaving(true);try{await customFetch("/api/final/security/policy",{method:"PUT",body:JSON.stringify({pinLength}),responseType:"json"});toast({title:"PIN policy updated",description:"New or changed staff PINs now use "+pinLength+" digits."});}catch(e:any){toast({variant:"destructive",title:"Could not update PIN policy",description:e?.message||"Founder access is required."});}finally{setSaving(false);}};
 const cards=[["Roles & permissions","/staff/roles",ShieldCheck],["Employees","/staff/employees",Users],["Practice Control","/staff/practice-control",Settings2],["Homepage Controls","/staff/homepage-controls",Eye]];
 return <div className="max-w-6xl space-y-7"><div><p className="text-sm text-muted-foreground">Practice-wide controls</p><h1 className="mt-1 font-serif text-4xl">Management Settings</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Employee access, roles, practice controls, security policy, and operational configuration.</p></div>
 <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label,href,Icon]:any)=><Card key={label} className="rounded-2xl"><CardHeader><CardTitle className="text-lg"><Icon className="mr-2 inline h-4 w-4 text-primary"/>{label}</CardTitle><CardDescription>Manage {String(label).toLowerCase()}.</CardDescription></CardHeader><CardContent><Link href={href}><Button variant="outline">Open</Button></Link></CardContent></Card>)}</div>
 <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/>Staff PIN policy</CardTitle><CardDescription>Choose 4, 6, or 8 digits for new and changed PINs. Existing PINs are not invalidated simply because the policy changes.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-4"><div className="w-48"><Select value={String(pinLength)} onValueChange={v=>setPinLength(Number(v) as 4|6|8)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="4">4 digits</SelectItem><SelectItem value="6">6 digits</SelectItem><SelectItem value="8">8 digits</SelectItem></SelectContent></Select></div><Button onClick={()=>void save()} disabled={saving}>Save policy</Button><Badge variant="secondary">Current: {pinLength} digits</Badge></CardContent></Card>
 <Card className="rounded-2xl"><CardHeader><CardTitle>Management workspace</CardTitle><CardDescription>Keep staff systems and practice systems together without mixing them into personal preferences.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Link href="/staff/security"><Button variant="outline">Security Center</Button></Link><Link href="/staff/system-health"><Button variant="outline">System Health</Button></Link><Link href="/staff/activity"><Button variant="outline">Activity History</Button></Link></CardContent></Card>
 </div>;
}