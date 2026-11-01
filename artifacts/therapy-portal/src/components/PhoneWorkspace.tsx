import { useEffect, useMemo, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCopy, Headphones, Loader2, Phone, Plus, RefreshCcw, Save, Search, ShieldCheck, Trash2, Users } from "lucide-react";

type Division = { id: string; name: string; extension: string; notes: string };
type StaffEntry = { id: string; name: string; division: string; extension: string; notes: string };
type CallScript = { id: string; title: string; category: string; body: string };
type PhoneBook = { divisions: Division[]; staff: StaffEntry[]; scripts: CallScript[]; canManage?: boolean; updatedAt?: string | null; updatedBy?: string };
const empty: PhoneBook = { divisions: [], staff: [], scripts: [] };
const freshId = () => "entry-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

export default function PhoneWorkspace({ manage = false }: { manage?: boolean }) {
  const { toast } = useToast();
  const [book, setBook] = useState<PhoneBook>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const canEdit = manage && book.canManage === true;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const value = await customFetch<PhoneBook>("/api/phone", { responseType: "json" });
      setBook({ ...empty, ...value, divisions: value.divisions || [], staff: value.staff || [], scripts: value.scripts || [] });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The directory could not be loaded.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const change = (section: "divisions" | "staff" | "scripts", id: string, field: string, value: string) => {
    setDirty(true);
    setBook((previous) => ({
      ...previous,
      [section]: (previous[section] as any[]).map((item) =>
        item.id === id ? { ...item, [field]: value } : item),
    }));
  };
  const remove = (section: "divisions" | "staff" | "scripts", id: string) => {
    setDirty(true);
    setBook((previous) => ({ ...previous, [section]: previous[section].filter((item) => item.id !== id) }));
  };
  const add = (section: "divisions" | "staff" | "scripts") => {
    setDirty(true);
    const item = section === "divisions"
      ? { id: freshId(), name: "", extension: "", notes: "" }
      : section === "staff"
        ? { id: freshId(), name: "", division: "", extension: "", notes: "" }
        : { id: freshId(), title: "", category: "Call handling", body: "" };
    setBook((previous) => ({ ...previous, [section]: [...previous[section], item] }));
  };
  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const result = await customFetch<PhoneBook>("/api/phone", {
        method: "PUT", responseType: "json",
        body: JSON.stringify({ divisions: book.divisions, staff: book.staff, scripts: book.scripts }),
      });
      setBook(result);
      setDirty(false);
      toast({ title: "Phone reference saved", description: "Directory and scripts are updated for all signed-in staff." });
    } catch (err) {
      toast({ variant: "destructive", title: "Could not save phone reference", description: err instanceof Error ? err.message : "Try again." });
    } finally { setSaving(false); }
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ variant: "destructive", title: "Clipboard unavailable", description: "Select the text and copy it manually." });
    }
  };
  const term = search.trim().toLowerCase();
  const matches = (values: string[]) => !term || values.some((value) => value.toLowerCase().includes(term));
  const divisions = useMemo(() => book.divisions.filter((item) => matches([item.name, item.extension, item.notes])), [book.divisions, term]);
  const staff = useMemo(() => book.staff.filter((item) => matches([item.name, item.division, item.extension, item.notes])), [book.staff, term]);
  const scripts = useMemo(() => book.scripts.filter((item) => matches([item.title, item.category, item.body])), [book.scripts, term]);

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading phone reference…</CardContent></Card>;
  if (error) return <Card><CardContent className="space-y-3 p-6"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}><RefreshCcw className="mr-2 h-4 w-4" />Retry</Button></CardContent></Card>;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-card to-secondary/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl"><Phone className="h-5 w-5 text-primary" />AWS Phone Center</CardTitle>
              <CardDescription className="mt-1">Internal divisions, staff extensions, and professional call scripts. Extensions are reference entries, not an active phone or dialer.</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />Staff only</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search phone center" placeholder="Search divisions, people, extensions, or scripts…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{book.divisions.length} divisions · {book.staff.length} staff entries · {book.scripts.length} scripts</span>
            <span>{book.updatedAt ? "Last updated " + new Date(book.updatedAt).toLocaleString() + (book.updatedBy ? " by " + book.updatedBy : "") : "Starter scripts • extensions not yet configured"}</span>
          </div>
          {manage && !book.canManage && <p className="text-sm text-muted-foreground">Only Ayden (Founder) and ASH Corporate can edit these shared entries. You can view them here.</p>}
        </CardContent>
      </Card>
      <Tabs defaultValue="divisions" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="divisions" className="gap-2"><Headphones className="h-4 w-4" />Divisions</TabsTrigger>
          <TabsTrigger value="staff" className="gap-2"><Users className="h-4 w-4" />Staff members</TabsTrigger>
          <TabsTrigger value="scripts" className="gap-2"><ClipboardCopy className="h-4 w-4" />Call scripts</TabsTrigger>
        </TabsList>
        <TabsContent value="divisions" className="space-y-3">
          {divisions.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{term ? "No divisions match your search." : "No division extensions have been assigned yet. Corporate can add them below."}</p>}
          {divisions.map((item) => <Card key={item.id}><CardContent className="space-y-3 p-4">
            {canEdit ? <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <label className="space-y-1 text-xs font-semibold">Division<Input aria-label="Division name" value={item.name} onChange={(event) => change("divisions", item.id, "name", event.target.value)} placeholder="e.g. Client Services" /></label>
              <label className="space-y-1 text-xs font-semibold">Extension<Input aria-label="Division extension" value={item.extension} onChange={(event) => change("divisions", item.id, "extension", event.target.value)} placeholder="Not assigned" /></label>
              <Button variant="ghost" size="icon" aria-label={"Remove " + (item.name || "division")} className="self-end text-destructive" onClick={() => remove("divisions", item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div> : <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{item.name}</h3><Badge variant="secondary" className="font-mono">{item.extension || "Not assigned"}</Badge></div>}
            {canEdit ? <Input aria-label={"Notes for " + (item.name || "division")} placeholder="Division notes (optional)" value={item.notes} onChange={(event) => change("divisions", item.id, "notes", event.target.value)} /> : item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
          </CardContent></Card>)}
          {canEdit && <Button variant="outline" onClick={() => add("divisions")}><Plus className="mr-2 h-4 w-4" />Add division</Button>}
        </TabsContent>
        <TabsContent value="staff" className="space-y-3">
          {staff.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{term ? "No staff match your search." : "No staff extensions have been added yet. Corporate can assign them below."}</p>}
          {staff.map((item) => <Card key={item.id}><CardContent className="space-y-3 p-4">
            {canEdit ? <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
              <label className="space-y-1 text-xs font-semibold">Staff member<Input aria-label="Staff member name" value={item.name} placeholder="Name" onChange={(event) => change("staff", item.id, "name", event.target.value)} /></label>
              <label className="space-y-1 text-xs font-semibold">Division<Input aria-label="Staff division" value={item.division} placeholder="Team / department" onChange={(event) => change("staff", item.id, "division", event.target.value)} /></label>
              <label className="space-y-1 text-xs font-semibold">Extension<Input aria-label="Staff extension" value={item.extension} placeholder="Not assigned" onChange={(event) => change("staff", item.id, "extension", event.target.value)} /></label>
              <Button variant="ghost" size="icon" className="self-end text-destructive" aria-label={"Remove " + (item.name || "staff member")} onClick={() => remove("staff", item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div> : <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="text-xs text-muted-foreground">{item.division || "No division listed"}</p></div><Badge variant="secondary" className="font-mono">{item.extension || "Not assigned"}</Badge></div>}
            {canEdit ? <Input aria-label={"Notes for " + (item.name || "staff member")} placeholder="Internal notes (optional; no client information)" value={item.notes} onChange={(event) => change("staff", item.id, "notes", event.target.value)} /> : item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
          </CardContent></Card>)}
          {canEdit && <Button variant="outline" onClick={() => add("staff")}><Plus className="mr-2 h-4 w-4" />Add staff member</Button>}
        </TabsContent>
        <TabsContent value="scripts" className="space-y-3">
          {scripts.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No scripts match. Try another search or ask Corporate to add one.</p>}
          {scripts.map((item) => <Card key={item.id}><CardHeader className="pb-2">
            {canEdit ? <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Script title" className="sm:flex-1" value={item.title} placeholder="Script title" onChange={(event) => change("scripts", item.id, "title", event.target.value)} />
              <Input aria-label="Script category" className="sm:w-44" value={item.category} placeholder="Category" onChange={(event) => change("scripts", item.id, "category", event.target.value)} />
              <Button variant="ghost" size="icon" className="text-destructive" aria-label={"Remove script " + item.title} onClick={() => remove("scripts", item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div> : <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">{item.title}</CardTitle><Badge variant="outline">{item.category}</Badge></div>}
          </CardHeader><CardContent className="space-y-3">
            {canEdit ? <Textarea aria-label={"Script text for " + item.title} rows={5} value={item.body} onChange={(event) => change("scripts", item.id, "body", event.target.value)} placeholder="Enter exactly what staff should say…" /> : <p className="whitespace-pre-wrap text-sm leading-7">{item.body}</p>}
            <Button variant="outline" size="sm" onClick={() => void copy(item.body)}><ClipboardCopy className="mr-2 h-4 w-4" />Copy script</Button>
          </CardContent></Card>)}
          {canEdit && <Button variant="outline" onClick={() => add("scripts")}><Plus className="mr-2 h-4 w-4" />Add call script</Button>}
        </TabsContent>
      </Tabs>
      {canEdit && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">{dirty ? "Unsaved changes — save to publish these entries to the staff phone center." : "All entries are shared across the staff portal. Changes are saved on the server."}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => void load()}><RefreshCcw className="mr-2 h-4 w-4" />Discard / refresh</Button>
          <Button disabled={!dirty || saving} onClick={() => void save()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "Saving…" : "Save phone center"}</Button></div>
      </div>}
    </div>
  );
}
