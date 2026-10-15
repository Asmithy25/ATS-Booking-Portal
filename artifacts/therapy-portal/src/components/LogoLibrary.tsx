import { useEffect, useState, type ChangeEvent } from "react";
import { customFetch, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, UploadCloud, Trash2, PencilLine, RefreshCw, Loader2, Sparkles, Smartphone, Globe, Star } from "lucide-react";

type LogoAsset = {
  id: number;
  name: string;
  altText: string;
  category: string;
  tags: string[];
  notes: string;
  mimeType: string;
  sizeBytes: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  assetUrl: string;
};

const CATEGORY_OPTIONS = [
  { value: "primary", label: "Primary brand" },
  { value: "seasonal", label: "Seasonal" },
  { value: "favicon", label: "Favicon / app icon" },
  { value: "social", label: "Social / marketing" },
  { value: "other", label: "Other" },
];

const PLACEMENT_OPTIONS = [
  { value: "siteLogo", label: "Main website & portal logo", icon: Globe, hint: "Shows throughout AWS where the primary brand mark is used." },
  { value: "favicon", label: "Browser favicon", icon: Star, hint: "The tiny mark shown on browser tabs and bookmarks." },
  { value: "appleTouchIcon", label: "Apple touch icon", icon: Smartphone, hint: "The icon used when someone adds AWS to an iPhone or iPad Home Screen." },
  { value: "pwaIcon", label: "Installable app icon", icon: Sparkles, hint: "The icon declared in AWS's installable web-app manifest." },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("That image could not be read."));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function humanDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently uploaded" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LogoLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assets, setAssets] = useState<LogoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [name, setName] = useState("");
  const [altText, setAltText] = useState("");
  const [category, setCategory] = useState("seasonal");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [placement, setPlacement] = useState("siteLogo");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busyAssetId, setBusyAssetId] = useState<number | null>(null);

  const reload = async (quiet = false) => {
    if (quiet) setReloading(true); else setLoading(true);
    try {
      const result = await customFetch<LogoAsset[]>("/api/logo-library", { responseType: "json" });
      setAssets(Array.isArray(result) ? result : []);
    } catch (error) {
      toast({ variant: "destructive", title: "Logo Library unavailable", description: error instanceof Error ? error.message : "Could not load your brand assets." });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !/\.ico$/i.test(file.name)) {
      toast({ variant: "destructive", title: "Unsupported image format", description: "Use PNG, JPG, WebP, or ICO. SVG files are not accepted." });
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: "destructive", title: "Image is too large", description: "Each image must be 5 MB or smaller." });
      event.target.value = "";
      return;
    }
    try {
      const result = await readImage(file);
      // Some browsers report an empty MIME type for .ico files.
      const normalized = file.type ? result : result.replace(/^data:;base64,/, "data:image/x-icon;base64,");
      setDataUrl(normalized);
      setFileName(file.name);
      setName((current) => current || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
      setAltText((current) => current || "Aydens Wellness Services logo");
    } catch (error) {
      toast({ variant: "destructive", title: "Could not read image", description: error instanceof Error ? error.message : "Choose the file again." });
    }
    event.target.value = "";
  };

  const upload = async () => {
    if (!dataUrl || !name.trim()) {
      toast({ variant: "destructive", title: "Finish the upload details", description: "Choose an image and give it a name first." });
      return;
    }
    setUploading(true);
    try {
      await customFetch<LogoAsset>("/api/logo-library", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), altText: altText.trim(), category, notes: notes.trim(), tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), dataUrl }),
        responseType: "json",
      });
      setName("");
      setAltText("");
      setCategory("seasonal");
      setNotes("");
      setTags("");
      setDataUrl("");
      setFileName("");
      await reload(true);
      toast({ title: "Logo saved to your library", description: "The original image is stored with AWS's database, so it survives deployments." });
    } catch (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error instanceof Error ? error.message : "The logo could not be saved." });
    } finally {
      setUploading(false);
    }
  };

  const apply = async (asset: LogoAsset) => {
    setBusyAssetId(asset.id);
    try {
      const result = await customFetch<{ message?: string }>(`/api/logo-library/${asset.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ target: placement }),
        responseType: "json",
      });
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Branding updated", description: result?.message || asset.name + " was applied." });
      await reload(true);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not apply logo", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBusyAssetId(null);
    }
  };

  const rename = async (asset: LogoAsset) => {
    const nextName = window.prompt("Name this logo", asset.name);
    if (nextName === null || !nextName.trim() || nextName.trim() === asset.name) return;
    setBusyAssetId(asset.id);
    try {
      await customFetch(`/api/logo-library/${asset.id}`, { method: "PATCH", body: JSON.stringify({ name: nextName.trim() }), responseType: "json" });
      await reload(true);
      toast({ title: "Logo renamed", description: "Your library has been updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Rename failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally { setBusyAssetId(null); }
  };

  const updateNotes = async (asset: LogoAsset) => {
    const nextNotes = window.prompt("Add a note or seasonal label (optional)", asset.notes || "");
    if (nextNotes === null || nextNotes === asset.notes) return;
    setBusyAssetId(asset.id);
    try {
      await customFetch(`/api/logo-library/${asset.id}`, { method: "PATCH", body: JSON.stringify({ notes: nextNotes }), responseType: "json" });
      await reload(true);
      toast({ title: "Logo details updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not update notes", description: error instanceof Error ? error.message : "Please try again." });
    } finally { setBusyAssetId(null); }
  };

  const replace = async (asset: LogoAsset, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if ((!ACCEPTED_TYPES.includes(file.type) && !/\.ico$/i.test(file.name)) || file.size > MAX_FILE_SIZE) {
      toast({ variant: "destructive", title: "Choose a supported image", description: "Use PNG, JPG, WebP, or ICO up to 5 MB." });
      return;
    }
    setBusyAssetId(asset.id);
    try {
      const nextData = await readImage(file);
      const normalized = file.type ? nextData : nextData.replace(/^data:;base64,/, "data:image/x-icon;base64,");
      await customFetch(`/api/logo-library/${asset.id}`, { method: "PATCH", body: JSON.stringify({ dataUrl: normalized }), responseType: "json" });
      await reload(true);
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Logo image replaced", description: "The library entry is unchanged; any placement using it will show the new image." });
    } catch (error) {
      toast({ variant: "destructive", title: "Replace failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally { setBusyAssetId(null); }
  };

  const remove = async (asset: LogoAsset) => {
    if (!window.confirm(`Delete “${asset.name}” from the Logo Library? This cannot be undone.`)) return;
    setBusyAssetId(asset.id);
    try {
      await customFetch(`/api/logo-library/${asset.id}`, { method: "DELETE", responseType: "json" });
      await reload(true);
      toast({ title: "Logo deleted", description: "The asset has been removed from your library." });
    } catch (error) {
      toast({ variant: "destructive", title: "Logo not deleted", description: error instanceof Error ? error.message : "If it is currently in use, apply another logo first." });
    } finally { setBusyAssetId(null); }
  };

  const visibleAssets = assets.filter((asset) => {
    const matchesCategory = categoryFilter === "all" || asset.category === categoryFilter;
    const haystack = [asset.name, asset.altText, asset.category, asset.notes, ...(asset.tags || [])].join(" ").toLowerCase();
    return matchesCategory && haystack.includes(search.toLowerCase().trim());
  });

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/15 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-gradient-to-r from-primary/[0.06] via-card to-secondary/[0.1]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl"><ImagePlus className="h-5 w-5 text-primary" /> Logo Library</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">One home for every AWS logo — primary, seasonal, campaign, favicon, and app icons. Choose an asset once and apply it wherever the brand appears.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void reload(true)} disabled={reloading || loading} className="shrink-0">
            {reloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh library
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-background/70 px-3 py-1.5">PNG · JPG · WebP · ICO</span>
          <span className="rounded-full border bg-background/70 px-3 py-1.5">5 MB per file</span>
          <span className="rounded-full border bg-background/70 px-3 py-1.5">Database-backed storage</span>
          <span className="rounded-full border bg-background/70 px-3 py-1.5">Founder-only controls</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-7 p-4 sm:p-6">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4 rounded-xl border border-border/80 bg-background/60 p-4 sm:p-5">
            <div className="flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary" /><h3 className="font-semibold">Add a brand asset</h3></div>
            <p className="text-sm leading-5 text-muted-foreground">Original images are stored in the AWS database, not a temporary upload folder or just your browser.</p>
            <label className="block cursor-pointer rounded-xl border border-dashed border-primary/35 bg-primary/[0.035] p-4 transition-colors hover:bg-primary/[0.07]">
              <input type="file" accept=".png,.jpg,.jpeg,.webp,.ico,image/png,image/jpeg,image/webp,image/x-icon" className="sr-only" onChange={(event) => void selectFile(event)} />
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImagePlus className="h-5 w-5" /></span>
                <span><strong className="block text-sm">{fileName || "Choose a logo image"}</strong><span className="mt-1 block text-xs text-muted-foreground">Click to browse · maximum 5 MB</span></span>
              </span>
            </label>
            {dataUrl && <div className="flex items-center gap-4 rounded-xl border bg-card p-3">
              <div className="grid h-16 w-20 shrink-0 place-items-center rounded-lg bg-muted p-2"><img src={dataUrl} alt="Selected logo preview" className="max-h-full max-w-full object-contain" /></div>
              <div className="min-w-0"><p className="text-sm font-medium">Ready to upload</p><p className="text-xs text-muted-foreground">Review the details, then save it to the library.</p></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setDataUrl(""); setFileName(""); }}>Clear</Button>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm"><span className="font-medium">Asset name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="AWS Fall Primary" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <label className="block space-y-1.5 text-sm"><span className="font-medium">Alt text</span><input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={180} placeholder="Aydens Wellness Services fall logo" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label className="block space-y-1.5 text-sm"><span className="font-medium">Tags <span className="font-normal text-muted-foreground">(comma-separated)</span></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="fall, primary, 2026" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label className="block space-y-1.5 text-sm"><span className="font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} placeholder="Best used for the fall brand season." className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <Button type="button" onClick={() => void upload()} disabled={uploading || !dataUrl || !name.trim()} className="w-full rounded-xl">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}{uploading ? "Saving to Logo Library…" : "Save to Logo Library"}
            </Button>
          </div>

          <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
            <div><div className="text-sm font-semibold">Brand placement</div><p className="mt-1 text-sm leading-5 text-muted-foreground">Choose where a selected logo should appear. You can use the same image for multiple placements.</p></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLACEMENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = placement === option.value;
                return <button type="button" key={option.value} onClick={() => setPlacement(option.value)} className={`rounded-xl border p-3 text-left transition-all ${selected ? "border-primary bg-primary/[0.07] shadow-sm ring-1 ring-primary/20" : "border-border bg-background/60 hover:border-primary/30"}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{option.label}</span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{option.hint}</span>
                </button>;
              })}
            </div>
            <div className="rounded-xl border border-secondary/30 bg-secondary/[0.09] p-4">
              <p className="text-sm font-semibold">Selected placement</p>
              <p className="mt-1 text-sm text-muted-foreground">{PLACEMENT_OPTIONS.find((option) => option.value === placement)?.hint}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Applying branding enables the founder-managed public branding settings. Unused uploads stay private; assets become public only when applied.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h3 className="font-semibold">Your brand assets <span className="ml-1 rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{assets.length}</span></h3><p className="mt-1 text-sm text-muted-foreground">Search, organize, replace, and apply any uploaded logo.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets or tags…" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">All categories</option>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            </div>
          </div>
          {loading ? <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading your logo library…</div> : visibleAssets.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><ImagePlus className="h-5 w-5" /></div><p className="mt-3 font-semibold">{assets.length ? "No matching logos" : "Your library starts here"}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{assets.length ? "Try a different search or category." : "Upload your primary, fall, Halloween, holiday, and social logos once. Choose the right variant whenever the brand needs a refresh."}</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAssets.map((asset) => <article key={asset.id} className="group overflow-hidden rounded-xl border border-border/80 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
              <div className="relative grid h-40 place-items-center overflow-hidden border-b border-border/70 bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%)] [background-position:0_0,8px_8px] [background-size:16px_16px] p-5">
                <img src={asset.assetUrl} alt={asset.altText || asset.name} className="max-h-full max-w-full object-contain drop-shadow-sm" />
                {asset.isPublic && <span className="absolute right-3 top-3 rounded-full border border-border bg-background/90 px-2.5 py-1 text-[10px] font-semibold">In use / public</span>}
              </div>
              <div className="space-y-3 p-4">
                <div><div className="flex items-start justify-between gap-2"><h4 className="font-semibold leading-5">{asset.name}</h4><span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{CATEGORY_OPTIONS.find((item) => item.value === asset.category)?.label || asset.category}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatSize(asset.sizeBytes)} · Added {humanDate(asset.createdAt)}</p></div>
                {asset.notes && <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{asset.notes}</p>}
                {asset.tags?.length > 0 && <div className="flex flex-wrap gap-1.5">{asset.tags.map((tag) => <span key={tag} className="rounded-full border bg-background px-2 py-1 text-[10px] text-muted-foreground">{tag}</span>)}</div>}
                <Button type="button" className="w-full rounded-lg" onClick={() => void apply(asset)} disabled={busyAssetId === asset.id}>
                  {busyAssetId === asset.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Use this logo
                </Button>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => void rename(asset)} disabled={busyAssetId === asset.id}><PencilLine className="mr-1 h-3.5 w-3.5" />Rename</Button>
                  <label htmlFor={`replace-logo-${asset.id}`} className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${busyAssetId === asset.id ? "pointer-events-none opacity-50" : ""}`}>Replace<input id={`replace-logo-${asset.id}`} type="file" accept=".png,.jpg,.jpeg,.webp,.ico,image/png,image/jpeg,image/webp,image/x-icon" className="sr-only" onChange={(event) => void replace(asset, event)} /></label>
                  <Button type="button" variant="outline" size="sm" onClick={() => void updateNotes(asset)} disabled={busyAssetId === asset.id}><PencilLine className="mr-1 h-3.5 w-3.5" />Notes</Button>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => void remove(asset)} disabled={busyAssetId === asset.id} className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete asset</Button>
              </div>
            </article>)}
          </div>}
        </section>
        <p className="text-xs leading-5 text-muted-foreground">Safety note: the library accepts raster images and ICO only (not SVG). Unused library images stay private. Deleting a logo that is currently assigned to site branding is blocked until you switch that placement to another asset.</p>
      </CardContent>
    </Card>
  );
}
