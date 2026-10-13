import { useState } from "react";
import Settings from "./settings";
import { customFetch, useGetAuthMe, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WebsiteSettings(){
 const {data:session}=useGetAuthMe({query:{retry:false}});
 const queryClient=useQueryClient();
 const {toast}=useToast();
 const [reverting,setReverting]=useState(false);
 const revert=async()=>{
  if(!window.confirm("Revert the public website to the normal Aydens Wellness Services design? This resets website text, logo override, and colors, but keeps bookings, clients, hours, announcements, and practice status.")) return;
  setReverting(true);
  try{
   await customFetch("/api/settings/revert-website-customization",{method:"POST",responseType:"json"});
   await queryClient.invalidateQueries({queryKey:getGetSettingsQueryKey()});
   toast({title:"Website customization reverted",description:"The public site is back to its normal Aydens Wellness Services design."});
  }catch(error){
   toast({variant:"destructive",title:"Could not revert website customization",description:error instanceof Error?error.message:"Please try again."});
  }finally{setReverting(false);}
 };
 return <div className="space-y-5">
  <Card className="rounded-2xl border-primary/15">
   <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary"/>Website Settings</CardTitle><CardDescription>Public website content, branding, booking presentation, hours, and site controls live here. Personal staff customization is intentionally separate under My Settings.</CardDescription></CardHeader>
   {session?.isAdmin && <CardContent className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Restore the standard website design</p><p className="text-sm text-muted-foreground">Reset the public website's custom colors, branding overrides, and editable homepage copy to the Aydens Wellness Services defaults. Bookings and practice operations are preserved.</p></div><Button type="button" variant="outline" onClick={()=>void revert()} disabled={reverting} className="shrink-0"><RotateCcw className="mr-2 h-4 w-4"/>{reverting?"Reverting…":"Revert Website Customization"}</Button></CardContent>}
  </Card>
  <Settings/>
 </div>;
}