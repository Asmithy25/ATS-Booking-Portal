import { useRef, useState } from 'react';
import { useGetAuthMe } from '@workspace/api-client-react';
import { customFetch } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Database, Download, FileCheck2, FileUp, Loader2, RefreshCw, ShieldAlert, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type BackupScope = 'bookings' | 'settings' | 'site-data' | 'everything';
type BackupPayload = {
  format: string;
  version: number;
  scope: BackupScope;
  exportedAt?: string;
  tables: Record<string, unknown[]>;
  counts?: Record<string, number>;
};
type ImportResult = { scope: BackupScope; importedAt: string; imported: Record<string, number>; skipped: Record<string, number>; warnings: string[] };

const SCOPE_OPTIONS: Array<{ value: BackupScope; label: string; detail: string }> = [
  { value: 'bookings', label: 'Bookings only', detail: 'Appointment records and session scheduling details.' },
  { value: 'settings', label: 'Website settings', detail: 'Site identity and saved configuration.' },
  { value: 'site-data', label: 'Site data', detail: 'Bookings, client/staff records, announcements, assignments, feedback and live-session history.' },
  { value: 'everything', label: 'Everything', detail: 'All supported records and settings, including audit history.' },
];

export default function BackupCenter() {
  const { data: auth } = useGetAuthMe();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<BackupScope>('everything');
  const [exporting, setExporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filename, setFilename] = useState('');
  const [backup, setBackup] = useState<BackupPayload | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const exportBackup = async () => {
    setExporting(true);
    setResult(null);
    try {
      const data = await customFetch<BackupPayload>('/api/backup/export?scope=' + encodeURIComponent(scope), { responseType: 'json' });
      if (!data || data.format !== 'ayden-therapy-backup' || !data.tables) throw new Error('The server returned an unexpected backup format.');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'aws-' + scope + '-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Backup downloaded', description: 'Saved a ' + scope + ' backup to your device.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Backup export failed', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setExporting(false);
    }
  };

  const chooseFile = async (file?: File) => {
    setBackup(null);
    setResult(null);
    setFilename('');
    if (!file) return;
    setReading(true);
    try {
      const parsed = JSON.parse(await file.text()) as BackupPayload;
      if (!parsed || parsed.format !== 'ayden-therapy-backup' || parsed.version !== 1 ||
          !['bookings', 'settings', 'site-data', 'everything'].includes(parsed.scope) ||
          !parsed.tables || typeof parsed.tables !== 'object' || Array.isArray(parsed.tables)) {
        throw new Error('This is not a supported AWS backup file.');
      }
      for (const [table, rows] of Object.entries(parsed.tables)) {
        if (!Array.isArray(rows)) throw new Error('The ' + table + ' section is not a valid list.');
      }
      setBackup(parsed);
      setFilename(file.name);
      toast({ title: 'Backup checked', description: 'The file format looks valid. Review the contents before merging it.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not read backup file', description: error instanceof Error ? error.message : 'Choose a valid JSON backup.' });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const importBackup = async () => {
    if (!backup || importing) return;
    setImporting(true);
    try {
      const imported = await customFetch<ImportResult>('/api/backup/import', {
        method: 'POST',
        body: JSON.stringify({ backup, mode: 'merge' }),
        responseType: 'json',
      });
      setResult(imported);
      setImportOpen(false);
      toast({ title: 'Backup merge completed', description: 'Review the imported counts and warnings below.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Backup restore failed', description: error instanceof Error ? error.message : 'No import was confirmed by the server.' });
    } finally {
      setImporting(false);
    }
  };

  if (!auth?.isAdmin) {
    return <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-8"><h1 className="text-2xl font-semibold">Founder access required</h1><p className="mt-2 text-sm text-muted-foreground">Backups contain sensitive business and client records and are only available to the founder account.</p></div>;
  }

  const rowCounts = Object.entries(backup?.counts ?? Object.fromEntries(Object.entries(backup?.tables ?? {}).map(([key, rows]) => [key, rows.length])));
  const importedCounts = Object.entries(result?.imported ?? {});
  const skippedCounts = Object.entries(result?.skipped ?? {});

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 sm:p-8">
        <Badge className="border border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-200">AWS 3.0 · Founder tools</Badge>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold"><Database className="h-7 w-7 text-primary" /> Backup & Recovery Center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Protect AWS records before major releases. Download backups directly to your device, validate a backup file, and merge records through the existing authenticated API.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-primary/15">
          <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Create a backup</CardTitle><CardDescription>Exports are generated by your existing AWS API and downloaded locally. No third-party storage is introduced.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><label htmlFor="backup-scope" className="text-sm font-medium">What should be included?</label>
              <select id="backup-scope" value={scope} onChange={(event) => setScope(event.target.value as BackupScope)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {SCOPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <p className="text-xs leading-5 text-muted-foreground">{SCOPE_OPTIONS.find((item) => item.value === scope)?.detail}</p>
            </div>
            <Button className="w-full" onClick={() => void exportBackup()} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? 'Preparing backup…' : 'Download backup'}
            </Button>
            <p className="text-xs text-muted-foreground">Keep the downloaded file in a secure location. Backups can contain sensitive client and operational information.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-primary/15">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> Validate & restore</CardTitle><CardDescription>Restoring uses merge mode. Existing records may be updated; this is not a one-click database rollback.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Choose AWS backup JSON file" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={reading || importing}>
              {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {reading ? 'Checking file…' : 'Choose backup file'}
            </Button>
            {backup ? (
              <div className="rounded-xl border border-primary/20 bg-primary/[0.045] p-4">
                <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" /><p className="min-w-0 truncate font-medium">{filename}</p></div>
                <p className="mt-1 text-xs text-muted-foreground">Scope: {backup.scope} · Version {backup.version}</p>
                {backup.exportedAt && <p className="mt-1 text-xs text-muted-foreground">Exported {new Date(backup.exportedAt).toLocaleString()}</p>}
                <div className="mt-3 flex flex-wrap gap-2">{rowCounts.map(([name, count]) => <Badge variant="secondary" key={name}>{name}: {count}</Badge>)}</div>
                <Button className="mt-4 w-full" onClick={() => setImportOpen(true)} disabled={importing}><RefreshCw className="mr-2 h-4 w-4" /> Review merge & restore</Button>
              </div>
            ) : <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Choose a backup JSON file to validate its structure before attempting an import.</div>}
          </CardContent>
        </Card>
      </div>

      {result && <Card className="rounded-2xl"><CardHeader><CardTitle>Last restore result</CardTitle><CardDescription>Server-confirmed result from {new Date(result.importedAt).toLocaleString()}.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">{importedCounts.map(([name, count]) => <Badge key={name} variant="secondary">{name}: {count} imported</Badge>)}</div>
        {skippedCounts.length > 0 && <div className="flex flex-wrap gap-2">{skippedCounts.map(([name, count]) => <Badge key={name} variant="outline">{name}: {count} skipped</Badge>)}</div>}
        {result.warnings?.length > 0 && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"><p className="font-medium text-amber-800 dark:text-amber-200">Review these warnings</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
        <p className="text-xs text-muted-foreground">Restores are recorded by the server. Confirm important records in the portal before relying on a restored dataset.</p>
      </CardContent></Card>}

      <div className="flex items-start gap-3 rounded-xl border p-4 text-sm text-muted-foreground"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong className="text-foreground">Safety note:</strong> a downloaded backup is not automatic off-site protection. This center does not claim a backup succeeded until the server returns the backup payload, and it does not claim a restore succeeded until the server confirms the import.</p></div>

      <AlertDialog open={importOpen} onOpenChange={(open) => { if (!importing) setImportOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm backup merge</AlertDialogTitle>
            <AlertDialogDescription>This will send {filename || 'the selected backup'} to the authenticated AWS API. Matching records can be updated and missing records can be inserted. This is not a full rollback and may change existing data. Continue only if you have reviewed the file and have a current backup of the live site.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel — don't restore</AlertDialogCancel>
            <Button variant="destructive" disabled={importing || !backup} onClick={() => void importBackup()}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {importing ? 'Merging…' : 'Confirm merge'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
