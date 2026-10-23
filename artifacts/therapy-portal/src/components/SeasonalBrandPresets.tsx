import { useEffect, useMemo, useState } from "react";
import { customFetch, getGetSettingsQueryKey, useGetSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Palette, Check, RefreshCw, Undo2, Leaf, Snowflake, Sun, Flower2, Sparkles } from "lucide-react";

type LogoAsset = {
  id: number;
  name: string;
  category: string;
  tags?: string[];
  notes?: string;
  assetUrl: string;
};

type PalettePreset = {
  id: string;
  name: string;
  season: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  logoBehavior: "keep" | "fall-default" | "auto-match";
  icon: typeof Palette;
};

const PRESETS: PalettePreset[] = [
  {
    id: "halloween",
    name: "Halloween",
    season: "Current palette",
    description: "The existing burnt-orange, copper, and amber identity. This preserves the colors AWS is using for its current seasonal theme.",
    primary: "#C85E09",
    secondary: "#F3A444",
    accent: "#F2C078",
    logoBehavior: "auto-match",
    icon: Sparkles,
  },
  {
    id: "fall",
    name: "Fall Signature",
    season: "Autumn",
    description: "Matches the attached Fall logo: toasted cream, chestnut brown, pumpkin copper, and warm gold. Uses the built-in Fall logo unless a seasonal logo is selected below.",
    primary: "#6B2A0A",
    secondary: "#C76A25",
    accent: "#E7B66F",
    logoBehavior: "fall-default",
    icon: Leaf,
  },
  {
    id: "christmas",
    name: "Christmas",
    season: "Holiday",
    description: "Evergreen, cranberry, and champagne gold.",
    primary: "#176344",
    secondary: "#B72D38",
    accent: "#D9B86C",
    logoBehavior: "auto-match",
    icon: Sparkles,
  },
  {
    id: "winter",
    name: "Winter Calm",
    season: "Winter",
    description: "Deep blue, glacial blue, and soft snow.",
    primary: "#244A73",
    secondary: "#88B9D9",
    accent: "#E6EFF6",
    logoBehavior: "auto-match",
    icon: Snowflake,
  },
  {
    id: "spring",
    name: "Spring Bloom",
    season: "Spring",
    description: "Garden green, soft blossom, and butter yellow.",
    primary: "#4F8060",
    secondary: "#E9AFC2",
    accent: "#E7D17A",
    logoBehavior: "auto-match",
    icon: Flower2,
  },
  {
    id: "summer",
    name: "Summer Glow",
    season: "Summer",
    description: "Ocean teal, sunshine, and coral.",
    primary: "#087E8B",
    secondary: "#FFD166",
    accent: "#FF8C69",
    logoBehavior: "auto-match",
    icon: Sun,
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    season: "Occasion",
    description: "Berry, rose, and soft blush.",
    primary: "#9E2348",
    secondary: "#E46C89",
    accent: "#F6C9D3",
    logoBehavior: "auto-match",
    icon: Flower2,
  },
  {
    id: "new-year",
    name: "New Year",
    season: "Occasion",
    description: "Midnight navy, silver, and celebratory gold.",
    primary: "#182847",
    secondary: "#9BAFC7",
    accent: "#D8B56A",
    logoBehavior: "auto-match",
    icon: Sparkles,
  },
  {
    id: "everyday",
    name: "Everyday AWS",
    season: "Core brand",
    description: "Warm terracotta, harvest orange, and soft amber.",
    primary: "#8F4A34",
    secondary: "#C98549",
    accent: "#E9C18A",
    logoBehavior: "auto-match",
    icon: Palette,
  },
];

const MAPPING_KEY = "aws-seasonal-brand-logo-map-v1";
const UNDO_KEY = "aws-seasonal-brand-undo-v1";
type PreviousBranding = { primaryColor: string; secondaryColor: string; accentColor: string; logoUrl: string };

function readMappings(): Record<string, string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MAPPING_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export default function SeasonalBrandPresets() {
  const { data: currentSettings } = useGetSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assets, setAssets] = useState<LogoAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [busyPreset, setBusyPreset] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<Record<string, string>>(() => readMappings());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [previousBranding, setPreviousBranding] = useState<PreviousBranding | null>(() => {
    try { const raw = window.localStorage.getItem(UNDO_KEY); return raw ? JSON.parse(raw) as PreviousBranding : null; } catch { return null; }
  });
  const [undoBusy, setUndoBusy] = useState(false);

  useEffect(() => {
    if (!currentSettings) return;
    const matches = PRESETS.find((preset) =>
      String(currentSettings.primaryColor || "").toLowerCase() === preset.primary.toLowerCase()
      && String(currentSettings.secondaryColor || "").toLowerCase() === preset.secondary.toLowerCase()
      && String(currentSettings.accentColor || "").toLowerCase() === preset.accent.toLowerCase()
    );
    setActivePreset(matches?.id ?? null);
  }, [currentSettings]);

  const seasonalAssets = useMemo(
    () => assets.filter((asset) => asset.category === "seasonal" || /fall|autumn|halloween|christmas|winter|spring|summer|holiday|valentine|new year/i.test([asset.name, asset.notes, ...(asset.tags || [])].join(" "))),
    [assets],
  );

  useEffect(() => {
    let cancelled = false;
    customFetch<LogoAsset[]>("/api/logo-library", { responseType: "json" })
      .then((result) => { if (!cancelled) setAssets(Array.isArray(result) ? result : []); })
      .catch(() => { if (!cancelled) setAssets([]); })
      .finally(() => { if (!cancelled) setLoadingAssets(false); });
    return () => { cancelled = true; };
  }, []);

  const matchingAssetForPreset = (preset: PalettePreset) => {
    const keywords: Record<string, string[]> = {
      halloween: ["halloween", "spooky", "october"],
      fall: ["fall", "autumn"],
      christmas: ["christmas", "xmas", "holiday"],
      winter: ["winter", "snow", "ice"],
      spring: ["spring", "bloom", "blossom"],
      summer: ["summer", "sunshine", "sun"],
      valentines: ["valentine", "valentines", "valentine's", "love"],
      "new-year": ["new year", "new-year", "newyear"],
      everyday: ["everyday", "primary", "standard brand"],
    };
    const terms = keywords[preset.id] || [preset.id];
    return seasonalAssets.find((asset) => {
      const haystack = [asset.name, asset.notes, ...(asset.tags || [])].join(" ").toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });
  };

  const resolveLogoId = (preset: PalettePreset) => {
    if (Object.prototype.hasOwnProperty.call(selectedLogo, preset.id)) return selectedLogo[preset.id];
    return preset.logoBehavior === "auto-match" ? String(matchingAssetForPreset(preset)?.id || "") : "";
  };

  const saveLogoMapping = (presetId: string, assetId: string) => {
    const next = { ...selectedLogo, [presetId]: assetId };
    setSelectedLogo(next);
    try {
      window.localStorage.setItem(MAPPING_KEY, JSON.stringify(next));
      toast({ title: "Seasonal logo preference saved", description: "This browser will remember which logo belongs to that seasonal palette." });
    } catch {
      toast({ variant: "destructive", title: "Preference not saved", description: "Browser storage is unavailable. You can still select a logo for this session." });
    }
  };

  const undoLastPalette = async () => {
    if (!previousBranding || undoBusy) return;
    setUndoBusy(true);
    try {
      await customFetch("/api/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previousBranding),
        responseType: "json",
      });
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      setActivePreset(null);
      setPreviousBranding(null);
      try { window.localStorage.removeItem(UNDO_KEY); } catch { /* No-op. */ }
      toast({ title: "Previous website palette restored", description: "The last palette change was undone." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not undo palette", description: error instanceof Error ? error.message : "Try again." });
    } finally { setUndoBusy(false); }
  };

  const applyPreset = async (preset: PalettePreset) => {
    setBusyPreset(preset.id);
    try {
      const assetId = resolveLogoId(preset);
      const current = await customFetch<any>("/api/settings", { responseType: "json" });
      const prior: PreviousBranding = {
        primaryColor: /^#[0-9a-f]{6}$/i.test(current?.primaryColor || "") ? current.primaryColor : "#C85E09",
        secondaryColor: /^#[0-9a-f]{6}$/i.test(current?.secondaryColor || "") ? current.secondaryColor : "#F3A444",
        accentColor: /^#[0-9a-f]{6}$/i.test(current?.accentColor || "") ? current.accentColor : "#F2C078",
        logoUrl: typeof current?.logoUrl === "string" ? current.logoUrl : "",
      };
      setPreviousBranding(prior);
      try { window.localStorage.setItem(UNDO_KEY, JSON.stringify(prior)); } catch { /* Undo remains available until this page closes. */ }
      // Save the palette first. This changes only website branding; appointments and client data are untouched.
      await customFetch("/api/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: preset.primary,
          secondaryColor: preset.secondary,
          accentColor: preset.accent,
          ...(preset.id === "fall" && !assetId ? { logoUrl: new URL("/seasonal/aws-fall-logo.png", window.location.origin).toString() } : {}),
        }),
        responseType: "json",
      });

      if (assetId) {
        await customFetch("/api/logo-library/" + encodeURIComponent(assetId) + "/apply", {
          method: "POST",
          body: JSON.stringify({ target: "siteLogo" }),
          responseType: "json",
        });
      }

      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      setActivePreset(preset.id);
      const logoNote = assetId
        ? " Your selected seasonal logo was applied too."
        : preset.id === "fall"
          ? " The bundled Fall logo matching your uploaded brand asset was applied."
          : preset.logoBehavior === "auto-match"
            ? " No matching seasonal logo was found in Logo Library, so the current logo was kept. Upload or tag the matching logo to pair it automatically."
            : " Your current logo was kept; choose a seasonal logo below to pair one with this palette.";
      toast({ title: preset.name + " palette applied", description: "The public website colors have been updated." + logoNote });
    } catch (error) {
      toast({ variant: "destructive", title: "Seasonal palette could not be applied", description: error instanceof Error ? error.message : "Check founder access and try again." });
    } finally {
      setBusyPreset(null);
    }
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/[0.08] via-card to-secondary/[0.14]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Palette className="h-5 w-5" /></span>
          <div>
            <CardTitle className="text-xl">Seasonal Brand Presets</CardTitle>
            <CardDescription>Switch the public website palette in one move. Staff personal themes stay untouched.</CardDescription>
          </div>
          <Badge className="ml-auto" variant="outline">AWS 3.2</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="rounded-xl border border-primary/15 bg-background/60 p-3 text-sm leading-6 text-muted-foreground">
          Halloween starts with the current AWS orange-and-amber colors. Fall Signature uses the warm brown, copper, and gold palette inspired by the attached Fall logo. Seasonal logo selections are made from Logo Library; the chosen logo is applied together with the colors.
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const hasExplicitPairing = Object.prototype.hasOwnProperty.call(selectedLogo, preset.id);
            const suggested = !hasExplicitPairing && preset.logoBehavior === "auto-match" ? matchingAssetForPreset(preset) : undefined;
            const logoId = hasExplicitPairing ? selectedLogo[preset.id] : String(suggested?.id || "");
            const matched = seasonalAssets.find((asset) => String(asset.id) === logoId);
            const previewLogoUrl = matched?.assetUrl || (preset.id === "fall" ? "/seasonal/aws-fall-logo.png" : "");
            const busy = busyPreset === preset.id;
            return (
              <article key={preset.id} className={`flex flex-col rounded-2xl border p-4 transition-colors ${activePreset === preset.id ? "border-primary bg-primary/[0.045] ring-1 ring-primary/20" : "border-border bg-card"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{preset.name}</h3>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{preset.season}</p>
                  </div>
                  {activePreset === preset.id && <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Selected</Badge>}
                </div>
                <p className="mt-3 min-h-[3rem] text-sm leading-5 text-muted-foreground">{preset.description}</p>
                <div className="mt-4 flex items-center gap-2" aria-label={preset.name + " colors"}>
                  {[preset.primary, preset.secondary, preset.accent].map((color) => <span key={color} title={color} className="h-9 flex-1 rounded-lg border border-black/10 shadow-inner" style={{ backgroundColor: color }} />)}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground">
                  <span>{preset.primary}</span><span className="text-center">{preset.secondary}</span><span className="text-right">{preset.accent}</span>
                </div>
                <label className="mt-4 block space-y-1.5">
                  <span className="text-xs font-medium">Logo paired with this preset</span>
                  <select
                    value={logoId}
                    onChange={(event) => saveLogoMapping(preset.id, event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    aria-label={"Logo for " + preset.name}
                    disabled={loadingAssets}
                  >
                    <option value="">{preset.logoBehavior === "fall-default" ? "Built-in Fall logo" : "Keep currently applied logo"}</option>
                    {seasonalAssets.map((asset) => <option key={asset.id} value={String(asset.id)}>{asset.name}</option>)}
                  </select>
                  {previewLogoUrl && <div className="mt-3 flex h-20 items-center justify-center rounded-xl border bg-background/70 p-2"><img src={previewLogoUrl} alt={matched?.name || "AWS Fall seasonal logo"} className="max-h-full max-w-full object-contain" /></div>}
                  {matched && <span className="block break-all text-[11px] text-muted-foreground">{!hasExplicitPairing && suggested ? "Suggested pairing: " : "Selected asset: "}{matched.name}</span>}
                  {!matched && preset.logoBehavior === "auto-match" && <span className="block text-[11px] text-muted-foreground">No matching seasonal logo found yet. The current website logo stays in place.</span>}
                </label>
                <Button type="button" className="mt-4 w-full rounded-xl" onClick={() => void applyPreset(preset)} disabled={busyPreset !== null}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {busy ? "Applying palette…" : "Apply preset"}
                </Button>
              </article>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">Need a Christmas or campaign logo? Upload it once in Logo Library and select it above. The preset remembers your chosen pairing in this browser; the applied website palette and logo are stored by AWS.</p>
          <div className="flex flex-wrap gap-2">
            {previousBranding && <Button type="button" variant="outline" onClick={() => void undoLastPalette()} disabled={undoBusy}>{undoBusy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Undo2 className="mr-2 h-4 w-4"/>}Undo last palette</Button>}
            <Button type="button" variant="outline" onClick={() => { setSelectedLogo(readMappings()); setActivePreset(null); }}><RefreshCw className="mr-2 h-4 w-4" />Refresh saved pairings</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
