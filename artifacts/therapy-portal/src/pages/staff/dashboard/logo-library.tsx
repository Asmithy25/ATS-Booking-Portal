import { useCallback, useEffect, useState } from "react";
import { customFetch, useGetAuthMe } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, Image as ImageIcon, Trash2, Save, RefreshCw, Sparkles, Globe, Smartphone, Monitor, CheckCircle2, Loader2 } from "lucide-react";
import { resolveBrandAssetUrl } from "@/components/brand-runtime";

type BrandAsset = {
  id: number;
  name: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  fileUrl: string;
  usedIn: string[];
  createdAt: string;
};
type SlotKey = "siteLogoId" | "staffLogoId" | "clientLogoId" | "faviconId" | "appleTouchIconId" | "pwaIconId";
type SlotValues = Record<SlotKey, string>;
type BrandPayload = Partial<Record<SlotKey, number | string | null>> & { [key: string]: unknown };

const SLOT_LIST: Array<{ key: SlotKey; label: string; description: string; icon: typeof ImageIcon }> = [
  { key: "siteLogoId", label: "Public website logo", description: "Used in the public website navigation and brand touchpoints.", icon: Globe },
  { key: "staffLogoId", label: "Staff workspace logo", description: "Used in the internal staff workspace header.", icon: Monitor },
  { key: "clientLogoId", label: "Client portal logo", description: "Reserved for client-facing portal branding.", icon: ImageIcon },
  { key: "faviconId", label: "Browser favicon", description: "The tiny brand icon in browser tabs and bookmarks.", icon: Sparkles },
  { key: "appleTouchIconId", label: "Apple touch icon", description: "The saved-to-home-screen icon on iPhone and iPad.", icon: Smartphone },
  { key: "pwaIconId", label: "Installable app icon", description: "The icon used by the installable AWS web app.", icon: ImageIcon },
];

const emptySlots: SlotValues = {
  siteLogoId: "", staffLogoId: "", clientLogoId: "", faviconId: "", appleTouchIconId: "", pwaIconId: "",
};
const humanSize = (bytes: number) => bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";

function assetTags(tags: unknown): string[] {
  return Array.isArray(tags) ? tags.map((tag) => String(tag)) : [];
}
function previewData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("This image could not be read."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      if (comma < 0) reject(new Error("This image could not be read."));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoLibrary() {
  const { data: session } = useGetAuthMe({ query: { retry: false } });
  const { toast } = useToast();
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [slots, setSlots] = useState<SlotValues>(emptySlots);
  const [drafts, setDrafts] = useState<Record<number, { name: string; tags: string }>>({});
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [tagsForUpload, setTagsForUpload] = useState("primary, fall");
  const [uploading, setUploading] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [busyAsset, setBusyAsset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [assetRows, publicBrand] = await Promise.all([
        customFetch<BrandAsset[]>("/api/brand/assets", { responseType: "json" }),
        customFetch<BrandPayload>("/api/brand/public-settings", { responseType: "json" }),
      ]);
      const nextAssets = Array.isArray(assetRows) ? assetRows : [];
      setAssets(nextAssets.map((asset) => ({ ...asset, tags: assetTags(asset.tags), usedIn: Array.isArray(asset.usedIn) ? asset.usedIn : [] })));
      setDrafts(Object.fromEntries(nextAssets.map((asset) => [asset.id, { name: asset.name, tags: assetTags(asset.tags).join(", ") }])));
      setSlots({
        siteLogoId: publicBrand.siteLogoId ? String(publicBrand.siteLogoId) : "",
        staffLogoId: publicBrand.staffLogoId ? String(publicBrand.staffLogoId) : "",
        clientLogoId: publicBrand.clientLogoId ? String(publicBrand.clientLogoId) : "",
        faviconId: publicBrand.faviconId ? String(publicBrand.faviconId) : "",
        appleTouchIconId: publicBrand.appleTouchIconId ? String(publicBrand.appleTouchIconId) : "",
        pwaIconId: publicBrand.pwaIconId ? String(publicBrand.pwaIconId) : "",
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the logo library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isAdmin) void load();
    else if (session) setLoading(false);
  }, [session?.isAdmin, load]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    if (!assets.length) { setPreviews({}); return; }
    Promise.all(assets.map(async (asset) => {
      try {
        const response = await fetch(resolveBrandAssetUrl(asset.fileUrl), { credentials: "include" });
        if (!response.ok) return [asset.id, ""] as const;
        const url = URL.createObjectURL(await response.blob());
        objectUrls.push(url);
        return [asset.id, url] as const;
      } catch {
        return [asset.id, ""] as const;
      }
    })).then((items) => {
      if (!cancelled) setPreviews(Object.fromEntries(items.filter((item) => item[1])));
    });
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assets]);

  if (!session?.isAdmin) return null;

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    let completed = 0;
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
          errors.push(file.name + ": use PNG, JPG, WebP, or GIF.");
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          errors.push(file.name + ": larger than 5 MB.");
          continue;
        }
        try {
          const data = await previewData(file);
          const name = files.length === 1 ? drafts[0]?.name || "" : "";
          await customFetch("/api/brand/assets", {
            method: "POST",
            responseType: "json",
            body: JSON.stringify({
              fileName: file.name,
              name: name.trim(),
              mimeType: file.type,
              data,
              tags: tagsForUpload.split(",").map((tag) => tag.trim()).filter(Boolean),
            }),
          });
          completed += 1;
        } catch (error) {
          errors.push(file.name + ": " + (error instanceof Error ? error.message : "upload failed"));
        }
      }
      await load();
      if (completed) toast({ title: completed === 1 ? "Logo added to the library" : completed + " assets added", description: "Your uploads are saved in persistent storage and will remain available across deployments." });
      if (errors.length) toast({ variant: "destructive", title: "Some files were skipped", description: errors.slice(0, 3).join(" ") });
    } finally {
      setUploading(false);
    }
  };

  const saveSlots = async () => {
    setSavingSlots(true);
    try {
      await customFetch("/api/brand/settings", {
        method: "PUT",
        responseType: "json",
        body: JSON.stringify(Object.fromEntries(SLOT_LIST.map(({ key }) => [key, slots[key] ? Number(slots[key]) : null]))),
      });
      window.dispatchEvent(new Event("aws-branding-updated"));
      toast({ title: "Branding published", description: "Your logo, favicon, and app icon assignments are saved." });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Branding could not be saved", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSavingSlots(false);
    }
  };

  const saveAsset = async (asset: BrandAsset) => {
    const draft = drafts[asset.id];
    if (!draft?.name.trim()) { toast({ variant: "destructive", title: "Give this asset a name first" }); return; }
    setBusyAsset(asset.id);
    try {
      await customFetch("/api/brand/assets/" + asset.id, {
        method: "PATCH",
        responseType: "json",
        body: JSON.stringify({ name: draft.name.trim(), tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
      });
      await load();
      toast({ title: "Asset details saved" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save asset", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBusyAsset(null);
    }
  };

  const deleteAsset = async (asset: BrandAsset) => {
    if (!window.confirm('Delete "' + asset.name + '" from the Logo Library? This cannot be undone.')) return;
    setBusyAsset(asset.id);
    try {
      await customFetch("/api/brand/assets/" + asset.id, { method: "DELETE", responseType: "json" });
      await load();
      toast({ title: "Brand asset deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Asset was not deleted", description: error instanceof Error ? error.message : "Replace any active branding assignment first." });
    } finally {
      setBusyAsset(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 shadow-lg shadow-black/5">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-secondary/10 to-emerald-900/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-background/70">FOUNDER ONLY</Badge><Badge className="bg-emerald-900 text-emerald-50">Persistent library</Badge></div>
              <CardTitle className="flex items-center gap-2 text-2xl"><ImageIcon className="h-6 w-6 text-primary" /> Logo Library</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">One home for every AWS logo: main brand, seasonal marks, browser icons, and app artwork. Upload once, then assign the exact asset to each brand surface.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="brand-files">Upload brand assets</label><Input id="brand-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={uploading} onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} /><p className="text-xs text-muted-foreground">PNG, JPG, WebP, or GIF · up to 5 MB each. SVG and executable formats are blocked for safety.</p></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="brand-tags">Tags for uploaded files</label><Input id="brand-tags" value={tagsForUpload} onChange={(event) => setTagsForUpload(event.target.value)} placeholder="primary, fall, holiday, wordmark" /><p className="text-xs text-muted-foreground">Separate tags with commas, e.g. fall, Christmas, monochrome.</p></div>
            <Button className="h-10" disabled={uploading} onClick={() => document.getElementById("brand-files")?.click()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{uploading ? "Uploading…" : "Choose files"}</Button>
          </div>
          {loadError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loadError}</div>}
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-md shadow-black/5">
        <CardHeader>
          <CardTitle>Brand controls</CardTitle>
          <CardDescription>Select which library asset controls each surface. Assignments are global and do not affect personal staff theme preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {assets.length === 0 && !loading && <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Your library is empty. Upload the main AWS logo, then add the fall and seasonal variations.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {SLOT_LIST.map(({ key, label, description, icon: Icon }) => {
              const selected = assets.find((asset) => String(asset.id) === slots[key]);
              return <div key={key} className="rounded-xl border bg-background/70 p-4">
                <div className="flex items-start gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{label}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div></div>
                <select aria-label={label} value={slots[key]} onChange={(event) => setSlots((current) => ({ ...current, [key]: event.target.value }))} className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Use AWS default / clear override</option>
                  {assets.map((asset) => <option key={asset.id} value={String(asset.id)}>{asset.name} · {asset.mimeType.replace("image/", "").toUpperCase()}</option>)}
                </select>
                {selected && <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 p-2"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border bg-card p-1">{previews[selected.id] ? <img src={previews[selected.id]} alt={selected.name} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{selected.name}</p><p className="text-xs text-muted-foreground">{humanSize(selected.sizeBytes)}</p></div><CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-700" /></div>}
              </div>;
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">Selected logos become public brand assets. Unassigned originals remain restricted to the founder.</p>
            <Button onClick={() => void saveSlots()} disabled={savingSlots || loading}>{savingSlots ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Publish branding</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-serif text-2xl">Your assets</h2><p className="text-sm text-muted-foreground">Rename, tag, preview, and manage every version.</p></div><Badge variant="outline">{assets.length} {assets.length === 1 ? "asset" : "assets"}</Badge></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your library…</div> : assets.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => {
          const draft = drafts[asset.id] ?? { name: asset.name, tags: assetTags(asset.tags).join(", ") };
          return <Card key={asset.id} className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex h-44 items-center justify-center border-b bg-[linear-gradient(135deg,rgba(192,132,75,.10),rgba(49,83,71,.08))] p-4">
              {previews[asset.id] ? <img src={previews[asset.id]} alt={asset.name} className="max-h-full max-w-full object-contain drop-shadow-sm" /> : <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-8 w-8" /><span className="text-xs">Preview unavailable</span></div>}
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2"><Badge variant="outline">{asset.mimeType.replace("image/", "").toUpperCase()}</Badge><span className="text-xs text-muted-foreground">{humanSize(asset.sizeBytes)}</span></div>
              <div className="space-y-1"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asset name</label><Input value={draft.name} maxLength={100} onChange={(event) => setDrafts((current) => ({ ...current, [asset.id]: { ...draft, name: event.target.value } }))} /></div>
              <div className="space-y-1"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</label><Input value={draft.tags} maxLength={300} placeholder="fall, wordmark, primary" onChange={(event) => setDrafts((current) => ({ ...current, [asset.id]: { ...draft, tags: event.target.value } }))} /></div>
              {!!asset.usedIn.length && <div className="flex flex-wrap gap-1">{asset.usedIn.map((slot) => <Badge key={slot} variant="secondary">{slot}</Badge>)}</div>}
              <div className="flex gap-2 pt-1"><Button variant="outline" className="flex-1" onClick={() => void saveAsset(asset)} disabled={busyAsset === asset.id}><Save className="mr-2 h-4 w-4" />Save details</Button><Button variant="outline" size="icon" aria-label={"Delete " + asset.name} onClick={() => void deleteAsset(asset)} disabled={busyAsset === asset.id || asset.usedIn.length > 0}><Trash2 className="h-4 w-4" /></Button></div>
              {asset.usedIn.length > 0 && <p className="text-xs text-muted-foreground">In use — replace its assignments before deleting.</p>}
            </CardContent>
          </Card>;
        })}
      </div> : !loadError ? <div className="rounded-xl border border-dashed p-10 text-center"><ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No brand assets yet</p><p className="mt-1 text-sm text-muted-foreground">Start with the primary logo, then add your fall and holiday variants.</p></div> : null}
      <p className="text-xs leading-relaxed text-muted-foreground">Brand assets are stored in the AWS database so deploys won’t erase them. Only assets selected for a public branding slot can be viewed without founder sign-in. Client records and private documents are never stored in this library.</p>
    </div>
  );
}
