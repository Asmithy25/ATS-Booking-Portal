import { useMemo, useState } from "react";
import { useGetAuthMe, useListBookings, type Booking } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartNoAxesCombined, Clock3, Download, Lightbulb, RefreshCw, ShieldCheck } from "lucide-react";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const HOURS = Array.from({length:13},(_,index)=>index+9);
const ACTIVE_DEMAND_STATUSES = new Set(["pending","claimed","completed","no_show","waitlisted"]);
const hourLabel=(hour:number)=>hour===0?"12 AM":hour<12?hour+" AM":hour===12?"12 PM":(hour-12)+" PM";

export default function ForecastLab() {
 const {data:auth}=useGetAuthMe();
 const {data:rawBookings=[],isLoading,error,refetch}=useListBookings();
 const bookings=(Array.isArray(rawBookings)?rawBookings:[]) as Booking[];
 const [targetDay,setTargetDay]=useState("Saturday");
 const [addedHours,setAddedHours]=useState("2");
 const [bufferMinutes,setBufferMinutes]=useState("15");
 const demand=useMemo(()=>{
   const weekdays=Array.from({length:7},()=>0);
   const hourCounts=Array.from({length:24},()=>0);
   const heat=Array.from({length:7},()=>Array.from({length:24},()=>0));
   const eligible=bookings.filter((booking)=>ACTIVE_DEMAND_STATUSES.has(String(booking.status||"")));
   for(const booking of eligible){
     const date=String(booking.preferredDate||"").slice(0,10);
     if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
     const parsed=new Date(date+"T12:00:00");
     const weekday=parsed.getDay();
     const match=String(booking.preferredTime||"").match(/^(\d{1,2}):(\d{2})/);
     const hour=match?Number(match[1]):-1;
     weekdays[weekday]+=1;
     if(hour>=0&&hour<24){hourCounts[hour]+=1;heat[weekday][hour]+=1;}
   }
   const observedWeeks=Math.max(1,Math.ceil((Date.now()-Math.min(...eligible.map((b:any)=>new Date(String(b.preferredDate||"2000-01-01")+"T12:00:00").getTime()).filter(Number.isFinite),Date.now()))/(7*86400000)));
   return {weekdays,hourCounts,heat,total:eligible.length,observedWeeks};
 },[bookings]);
 const busiestDay=DAYS[demand.weekdays.indexOf(Math.max(...demand.weekdays))]||"—";
 const busiestHour=hourLabel(demand.hourCounts.indexOf(Math.max(...demand.hourCounts)));
 const maxCell=Math.max(1,...demand.heat.flat());
 const extraHours=Number(addedHours);
 const buffer=Number(bufferMinutes);
 const maxSessionsPerHour=Math.max(0,Math.floor(60/(60+buffer)));
 const weeklyCapacity=extraHours*maxSessionsPerHour;
 const selectedIndex=DAYS.indexOf(targetDay);
 const dayCount=demand.weekdays[selectedIndex]||0;
 const dailyAverage=dayCount/demand.observedWeeks;
 const exportCsv=()=>{
   const rows=[["Weekday","Requested appointment count",...HOURS.map(hourLabel)],...DAYS.map((day,index)=>[day,demand.weekdays[index],...HOURS.map((hour)=>demand.heat[index][hour])])];
   const csv=rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="aws-booking-demand-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 };

 if(!(auth as any)?.isAdmin) return <Card className="rounded-2xl"><CardHeader><CardTitle>Founder access required</CardTitle><CardDescription>Booking demand reports are limited to founder accounts.</CardDescription></CardHeader></Card>;

 return <div className="mx-auto max-w-7xl space-y-6">
  <section className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-br from-primary/[.12] via-card to-secondary/[.12] p-6 sm:p-8">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><ChartNoAxesCombined className="h-4 w-4"/> AWS / Planning lab</div><h1 className="mt-3 font-serif text-4xl font-medium sm:text-5xl">Booking Demand Forecast Lab<span className="text-primary">.</span></h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Explore requested appointment patterns by weekday and time, then model the maximum additional appointment capacity that new opening hours could create. This is operational planning—not a promise of future demand.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>void refetch()} disabled={isLoading}><RefreshCw className={"mr-2 h-4 w-4 "+(isLoading?"animate-spin":"")}/>Refresh</Button><Button onClick={exportCsv}><Download className="mr-2 h-4 w-4"/>Export</Button></div></div>
  </section>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observed requests</p><p className="mt-2 font-serif text-3xl">{isLoading?"—":demand.total}</p><p className="mt-1 text-xs text-muted-foreground">Statuses counted as demand</p></CardContent></Card>
   <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Busiest weekday</p><p className="mt-2 font-serif text-3xl">{isLoading?"—":busiestDay}</p><p className="mt-1 text-xs text-muted-foreground">By preferred appointment date</p></CardContent></Card>
   <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peak requested hour</p><p className="mt-2 font-serif text-3xl">{isLoading?"—":busiestHour}</p><p className="mt-1 text-xs text-muted-foreground">Across recorded requests</p></CardContent></Card>
   <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario capacity</p><p className="mt-2 font-serif text-3xl">{isLoading?"—":weeklyCapacity}</p><p className="mt-1 text-xs text-muted-foreground">Maximum extra slots / week in your scenario</p></CardContent></Card>
  </div>
  {error?<Card className="rounded-2xl"><CardContent className="p-6 text-destructive">Demand data could not load. Refresh or check staff booking permissions.</CardContent></Card>:<div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
   <Card className="rounded-2xl"><CardHeader><CardTitle>Demand by weekday and hour</CardTitle><CardDescription>Every square shows the count of eligible booking requests by preferred local weekday/hour. Stronger cells indicate more recorded demand.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="min-w-[670px] w-full border-separate border-spacing-1"><thead><tr><th className="w-20 text-left text-[10px] text-muted-foreground">Day</th>{HOURS.map(hour=><th key={hour} className="text-center text-[10px] font-normal text-muted-foreground">{hourLabel(hour).replace(" AM","a").replace(" PM","p")}</th>)}</tr></thead><tbody>{DAYS.map((day,index)=><tr key={day}><th className="pr-2 text-left text-xs font-medium">{day.slice(0,3)}</th>{HOURS.map(hour=>{const count=demand.heat[index][hour];const opacity=count?0.12+0.78*count/maxCell:0;return <td key={hour} title={day+" "+hourLabel(hour)+": "+count+" requests"} className="h-8 rounded-md text-center text-[10px]" style={{backgroundColor:count?"color-mix(in srgb, hsl(var(--primary)) "+Math.round(opacity*100)+"%, transparent)":"hsl(var(--muted))",color:count?"hsl(var(--foreground))":"hsl(var(--muted-foreground))"}}>{count||""}</td>})}</tr>)}</tbody></table></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-medium">Lower demand</span><span className="h-3 w-6 rounded bg-muted"/><span className="h-3 w-6 rounded" style={{backgroundColor:"color-mix(in srgb, hsl(var(--primary)) 35%, transparent)"}}/><span className="h-3 w-6 rounded" style={{backgroundColor:"color-mix(in srgb, hsl(var(--primary)) 85%, transparent)"}}/><span className="font-medium">Higher demand</span></div></CardContent></Card>
   <Card className="rounded-2xl"><CardHeader><CardTitle>What-if capacity simulator</CardTitle><CardDescription>Model additional opening time without changing live practice hours.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="space-y-1.5"><label className="text-sm font-medium">Add hours on</label><Select value={targetDay} onValueChange={setTargetDay}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{DAYS.map(day=><SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1.5"><label className="text-sm font-medium">Extra opening time per week</label><Select value={addedHours} onValueChange={setAddedHours}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["1","2","3","4","5","6","7","8"].map(value=><SelectItem key={value} value={value}>{value} hour{value==="1"?"":"s"}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1.5"><label className="text-sm font-medium">Between-session buffer</label><Select value={bufferMinutes} onValueChange={setBufferMinutes}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["0","15","30","45"].map(value=><SelectItem key={value} value={value}>{value} minutes</SelectItem>)}</SelectContent></Select></div>
    <div className="rounded-xl border border-primary/20 bg-primary/[.05] p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><Lightbulb className="h-4 w-4"/> Scenario output</div><p className="mt-3 text-3xl font-semibold">{weeklyCapacity} maximum extra slots per week</p><p className="mt-2 text-sm leading-6 text-muted-foreground">With {extraHours} extra hour{extraHours===1?"":"s"} on {targetDay} and a {buffer}-minute buffer, AWS estimates up to {weeklyCapacity} complete 60-minute appointment slot{weeklyCapacity===1?"":"s"} per week. The model uses no assumed client demand.</p><p className="mt-3 border-t pt-3 text-xs text-muted-foreground">Recorded volume for {targetDay}: {dayCount} appointment requests in the available data (roughly {dailyAverage.toFixed(1)} per observed week). Past demand is context, not a guarantee.</p></div>
    <div className="flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>This simulator never saves settings or opens real booking availability. Apply schedule changes separately in Practice Settings after reviewing them.</div>
   </CardContent></Card>
  </div>}
 </div>;
}
