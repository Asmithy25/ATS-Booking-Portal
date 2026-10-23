import { useMemo, useState } from "react";
import { useGetAuthMe, useListBookings, type Booking } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CalendarClock, CheckCircle2, CircleAlert, CircleDashed, Clock3, RefreshCw, XCircle } from "lucide-react";

const STAGES=[
 {key:"pending",title:"Needs review",description:"New requests awaiting staff action.",icon:CircleDashed},
 {key:"claimed",title:"Scheduled / active",description:"Assigned bookings and current session work.",icon:CalendarClock},
 {key:"waitlisted",title:"Waitlist",description:"Requests waiting for a slot to open.",icon:Clock3},
 {key:"completed",title:"Completed",description:"Appointments marked complete.",icon:CheckCircle2},
 {key:"cancelled",title:"Cancelled",description:"Appointments cancelled by a client or staff.",icon:XCircle},
 {key:"no_show",title:"No-show",description:"Appointments marked as missed.",icon:CircleAlert},
] as const;

export default function BookingLifecycleExplorer(){
 const {data:auth}=useGetAuthMe();
 const {data:rawBookings=[],isLoading,error,refetch}=useListBookings({query:{enabled:Boolean((auth as any)?.authenticated&&(auth as any)?.isAdmin)}});
 const bookings=(Array.isArray(rawBookings)?rawBookings:[]) as Booking[];
 const [stage,setStage]=useState<string>("pending");
 const counts=useMemo(()=>Object.fromEntries(STAGES.map((item)=>[item.key,bookings.filter((booking)=>String(booking.status)===item.key).length])),[bookings]);
 const selected=useMemo(()=>bookings.filter((booking)=>String(booking.status)===stage).sort((a,b)=>String(a.preferredDate||"").localeCompare(String(b.preferredDate||""))),[bookings,stage]);
 if(!(auth as any)?.isAdmin) return <Card className="rounded-2xl"><CardHeader><CardTitle>Founder access required</CardTitle><CardDescription>The lifecycle explorer summarizes operational booking records and is limited to founder accounts.</CardDescription></CardHeader></Card>;
 const stageMeta=STAGES.find((item)=>item.key===stage)||STAGES[0];
 return <div className="mx-auto max-w-7xl space-y-6">
  <section className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[.13] via-card to-secondary/[.12] p-6 sm:p-8">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><ArrowRight className="h-4 w-4"/> AWS / Booking lifecycle</div><h1 className="mt-3 font-serif text-4xl font-medium sm:text-5xl">Lifecycle Explorer<span className="text-primary">.</span></h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Inspect where booking requests sit across their lifecycle. Select any stage to see the corresponding records and continue in the existing booking-management screen.</p></div><Button variant="outline" onClick={()=>void refetch()} disabled={isLoading}><RefreshCw className={"mr-2 h-4 w-4 "+(isLoading?"animate-spin":"")}/>Refresh</Button></div>
  </section>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   {STAGES.map((item)=>{const Icon=item.icon;const active=item.key===stage;return <button key={item.key} type="button" onClick={()=>setStage(item.key)} className={"rounded-2xl border p-4 text-left transition "+(active?"border-primary bg-primary/[.06] ring-1 ring-primary/30":"bg-card hover:border-primary/30 hover:bg-muted/30")}><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div><span className="font-serif text-2xl">{isLoading?"—":counts[item.key]}</span></div></button>})}
  </div>
  <Card className="rounded-2xl"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>{stageMeta.title}</CardTitle><CardDescription>{stageMeta.description} {selected.length} records match.</CardDescription></div><Link href="/staff/bookings"><Button>Open booking management<ArrowRight className="ml-2 h-4 w-4"/></Button></Link></CardHeader>
   <CardContent className="space-y-3">{error?<p className="py-5 text-sm text-destructive">Lifecycle data could not load. Check staff booking permissions and refresh.</p>:isLoading?<p className="py-5 text-sm text-muted-foreground">Loading booking lifecycle…</p>:selected.length?selected.slice(0,60).map((booking)=> <article key={booking.id} className="flex flex-col gap-3 rounded-xl border bg-background/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{booking.clientName}</p><Badge variant="outline">{booking.confirmationCode}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{booking.preferredDate} · {booking.preferredTime} · {booking.claimedBy||"Unassigned"}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{booking.reason}</p></div><Badge variant="secondary" className="self-start capitalize sm:self-center">{String(booking.status).replaceAll("_"," ")}</Badge></article>):<div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No bookings are currently in this stage.</div>}
    {selected.length>60&&<p className="text-xs text-muted-foreground">Showing the first 60 records. Open booking management for the complete list.</p>}
   </CardContent>
  </Card>
  <p className="text-xs leading-5 text-muted-foreground">This page is a read-only operational map. Appointment changes, session controls, and validation remain centralized in Bookings and the server API.</p>
 </div>;
}
