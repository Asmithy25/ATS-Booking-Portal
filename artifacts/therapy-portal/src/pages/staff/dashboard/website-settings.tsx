import { useState } from "react";
import Settings from "./settings";
import LogoLibrary from "@/components/LogoLibrary";
import SeasonalBrandPresets from "@/components/SeasonalBrandPresets";
import { customFetch, useGetAuthMe, getGetAuthMeQueryKey, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, RotateCcw, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WebsiteSettings() {
  const { data: session } = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), retry: false } });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reverting, setReverting] = useState(false);

  const revert = async () => {
    if (!window.confirm("Revert the public website to the standard Aydens Wellness Services design? This resets website text, the main logo assignment, favicon, icon placements, and colors, but keeps bookings, clients, hours, announcements, and practice status.")) return;
    setReverting(true);
    try {
      await customFetch("/api/settings/revert-website-customization", { method: "POST", responseType: "json" });
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Website customization reverted", description: "The public site is back to its standard Aydens Wellness Services design." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not revert website customization", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setReverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border-primary/15 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-primary/[0.07] via-card to-secondary/[0.12]">
          <CardTitle className="flex items-center gap-2 text-xl"><Eye className="h-5 w-5 text-primary" /> Website & Brand Studio</CardTitle>
          <CardDescription className="max-w-3xl leading-6">Manage the public AWS identity, seasonal brand assets, website copy, palette, and booking presentation in one place. Staff personal appearance settings remain separate under My Settings.</CardDescription>
        </CardHeader>
        {session?.isAdmin && <CardContent className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><RotateCcw className="h-4 w-4" /></span>
            <div><p className="font-medium">Restore the standard website design</p><p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">Reset public branding overrides and editable homepage copy to AWS defaults. Bookings, client records, hours, announcements, and practice operations are preserved.</p></div>
          </div>
          <Button type="button" variant="outline" onClick={() => void revert()} disabled={reverting} className="shrink-0 rounded-xl">
            <RotateCcw className="mr-2 h-4 w-4" />{reverting ? "Reverting…" : "Revert website"}
          </Button>
        </CardContent>}
      </Card>

      {session?.isAdmin && <SeasonalBrandPresets />}

      {session?.isAdmin && <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-2xl">Brand assets</h2>
          <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Founder tools</span>
        </div>
        <LogoLibrary />
      </div>}

      <Settings />
    </div>
  );
}
