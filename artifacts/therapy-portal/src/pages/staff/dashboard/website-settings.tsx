import Settings from "./settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
export default function WebsiteSettings(){
 return <div className="space-y-5"><Card className="rounded-2xl border-primary/15"><CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary"/>Website Settings</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Public website content, branding, booking presentation, hours, and site controls live here. Personal staff customization is intentionally separate under My Settings.</CardContent></Card><Settings/></div>;
}