import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch as SwitchComponent } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Save, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";

type BrandingConfigKey = "staffLoginLogoUrl" | "founderDeckLogoUrl" | "executiveDeckLogoUrl" | "publicLogoUrl";

type BrandingConfig = {
  staffLoginLogoUrl: string;
  founderDeckLogoUrl: string;
  executiveDeckLogoUrl: string;
  publicAttributionEnabled: boolean;
  attributionText: string;
  publicLogoUrl: string;
};
type LogoAsset = { id: number; name: string; assetUrl: string; category?: string; sizeBytes?: number };

const DEFAULTS: BrandingConfig = {
  staffLoginLogoUrl: "/ash-aws-crossover.webp",
  founderDeckLogoUrl: "/ash-aws-crossover.webp",
  executiveDeckLogoUrl: "/ash-corporate.webp",
  publicAttributionEnabled: false,
  attributionText: "An Ayden Smith Holdings company",
  publicLogoUrl: "/ash-corporate.webp",
};
const SLOTS: Array<{ key: keyof Pick<BrandingConfig, "staffLoginLogoUrl" | "founderDeckLogoUrl" | "executiveDeckLogoUrl" | "publicLogoUrl">; title: string; note: string; fallback: string }> = [
  { key: "staffLoginLogoUrl", title: "Staff sign-in", note: "The first impression across the staff login and PIN setup screens.", fallback: "ASH × AWS crossover" },
  { key: "founderDeckLogoUrl", title: "Founder Command Deck", note: "The combined identity for your founder-level AWS workspace.", fallback: "ASH × AWS crossover" },
  { key: "executiveDeckLogoUrl", title: "ASH Executive Command Deck", note: "The ASH-only identity for the corporate executive workspace.", fallback: "ASH corporate emblem" },
  { key: "publicLogoUrl", title: "Public corporate attribution", note: "Used only when public attribution is enabled below.", fallback: "ASH corporate emblem" },
];
const DEFAULT_URLS = ["/ash-aws-crossover.webp", "/ash-corporate.webp"];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("That image could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function CorporateIdentityStudio() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULTS);
  const [assets, setAssets] = useState<LogoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<BrandingConfigKey>("staffLoginLogoUrl");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      customFetch<Partial<BrandingConfig>>("/api/corporate/branding", { responseType: "json" }).catch(() => null),
      customFetch<LogoAsset[]>("/api/logo-library", { responseType: "json" }).catch(() => []),
    ]).then(([saved, library]) => {
      if (!alive) return;
      if (saved) {
        setBranding({ ...DEFAULTS, ...saved });
        setConfigured(true);
      }
      setAssets(Array.isArray(library) ? library : []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await customFetch<BrandingConfig>("/api/corporate/branding", {
        method: "PUT",
        body: JSON.stringify(branding),
        responseType: "json",
      });
      setBranding({ ...DEFAULTS, ...saved });
      setConfigured(true);
      toast({ title: "Corporate identity saved", description: "Shared logo assignments are saved for the staff workspace." });
    } catch (error) {
      toast({ variant: "destructive", title: "Brand settings could not be saved", description: error instanceof Error ? error.message : "Check corporate access and try again." });
    } finally {
      setSaving(false);
    }
  };

  const chooseUpload = (key: BrandingConfigKey) => {
    setUploadTarget(key);
    fileRef.current?.click();
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast({ variant: "destructive", title: "Unsupported image", description: "Choose a PNG, JPG, or WebP image." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Image is too large", description: "Brand assets must be 5 MB or smaller." });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readImage(file);
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80) || "Corporate logo";
      const asset = await customFetch<LogoAsset>("/api/logo-library", {
        method: "POST",
        body: JSON.stringify({ name, altText: "Corporate identity asset", category: "primary", notes: "Uploaded from Corporate Identity Studio", tags: ["ash", "aws", "corporate"], dataUrl }),
        responseType: "json",
      });
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setBranding((current) => ({
        ...current,
        [uploadTarget]: asset.assetUrl,
        ...(uploadTarget === "publicLogoUrl" ? {} : {}),
      }));
      toast({ title: "Logo uploaded", description: "The file is stored in the database logo library and assigned to the selected brand surface. Save settings to publish it." });
    } catch (error) {
      toast({ variant: "destructive", title: "Logo upload failed", description: error instanceof Error ? error.message : "The image could not be stored." });
    } finally {
      setUploading(false);
    }
  };

  const options = (current: string) => {
    const urls = [...new Set([...DEFAULT_URLS, current, ...assets.map((asset) => asset.assetUrl)].filter(Boolean))];
    return urls.map((url) => {
      const asset = assets.find((item) => item.assetUrl === url);
      const label = asset ? asset.name : url === "/ash-aws-crossover.webp" ? "ASH × AWS crossover logo" : url === "/ash-corporate.webp" ? "ASH-only corporate logo" : "Current assigned image";
      return { url, label };
    });
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/15 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-primary/[0.08] via-card to-secondary/[0.14]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-primary" /> Corporate Identity Studio</CardTitle>
            <CardDescription className="mt-2 max-w-3xl leading-6">Choose which logo appears across the combined AWS × ASH and ASH-only areas. Uploads use the existing persistent Logo Library, and these assignments can be changed later without a code edit.</CardDescription>
          </div>
          <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" /> {configured ? "Settings loaded" : "Default identity"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5 sm:p-6">
        {loading ? <p className="text-sm text-muted-foreground">Loading corporate identity settings…</p> : <div className="grid gap-4 xl:grid-cols-2">
          {SLOTS.map((slot) => (
            <div key={slot.key} className="rounded-2xl border p-4">
              <div className="flex items-start gap-4">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/30 p-1">
                  <img src={branding[slot.key]} alt={slot.title + " logo preview"} className="h-full w-full rounded-lg object-contain" onError={(event) => { (event.currentTarget as HTMLImageElement).style.opacity = "0.25"; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{slot.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{slot.note}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Recommended: {slot.fallback}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Assigned logo</Label>
                <Select value={branding[slot.key]} onValueChange={(value) => setBranding((current) => ({ ...current, [slot.key]: value }))}>
                  <SelectTrigger><SelectValue placeholder="Choose a logo" /></SelectTrigger>
                  <SelectContent>{options(branding[slot.key]).map((option) => <SelectItem key={option.url} value={option.url}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" className="w-full" onClick={() => chooseUpload(slot.key)} disabled={uploading}>
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload / replace this logo
                </Button>
              </div>
            </div>
          ))}
        </div>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void upload(event)} />
        <div className="rounded-2xl border p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="font-semibold">Public corporate attribution</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Optional footer-level attribution on the public AWS website. It stays off until you enable it, so the wellness homepage remains focused on clients.</p>
            </div>
            <SwitchComponent checked={branding.publicAttributionEnabled} onCheckedChange={(checked) => setBranding((current) => ({ ...current, publicAttributionEnabled: checked }))} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2"><Label htmlFor="ash-attribution">Attribution text</Label><Input id="ash-attribution" value={branding.attributionText} maxLength={140} onChange={(event) => setBranding((current) => ({ ...current, attributionText: event.target.value }))} placeholder="An Ayden Smith Holdings company" /></div>
            <Badge variant="secondary" className="w-fit">Public: {branding.publicAttributionEnabled ? "Enabled" : "Disabled"}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-muted-foreground"><ImagePlus className="mr-1 inline h-3.5 w-3.5" />Logo uploads are saved in PostgreSQL; assigning a logo and saving is separate from applying a deployment.</p>
          <Button onClick={() => void save()} disabled={saving || loading || uploading}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save corporate identity"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
