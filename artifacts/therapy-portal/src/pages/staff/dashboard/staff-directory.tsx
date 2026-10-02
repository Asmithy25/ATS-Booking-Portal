import { useEffect, useState } from 'react';
import { customFetch, useGetAuthMe } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Save, UsersRound } from 'lucide-react';

type Staff = { id: string | number; email: string; name: string; role: string; bio: string; photoUrl: string; focus: string; displayTitle: string; isVisible: boolean };

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

export default function StaffDirectory() {
  const { data: session } = useGetAuthMe();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ bio: '', photoUrl: '', focus: '', displayTitle: '' });

  const load = () => customFetch<Staff[]>('/api/workspace/staff').then(setStaff).catch(() => setStaff([]));
  useEffect(() => { load(); }, []);

  const begin = (person: Staff) => { setEditing(person.email); setDraft({ bio: person.bio ?? '', photoUrl: person.photoUrl ?? '', focus: person.focus ?? '', displayTitle: person.displayTitle ?? '' }); };

  const uploadPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setDraft((value) => ({ ...value, photoUrl: String(reader.result ?? '') }));
    reader.readAsDataURL(file);
  };

  const save = async (email: string) => {
    try {
      await customFetch('/api/workspace/staff/' + encodeURIComponent(email) + '/profile', { method: 'PATCH', body: JSON.stringify(draft) });
      setEditing(null);
      toast({ title: 'Staff profile saved', description: 'Your team directory is up to date.' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Profile could not be saved', description: err instanceof Error ? err.message : 'Please try again.' });
    }
  };

  return (
    <div className="space-y-7">
      <div><p className="text-sm text-muted-foreground">Staff-only profiles for the people who keep Aydens moving.</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><UsersRound className="h-6 w-6 text-primary" /> Staff directory</h1><p className="mt-2 max-w-2xl text-muted-foreground">Update your own profile from here. The founder can maintain everyone’s profile.</p></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((person) => {
          const canEdit = session?.email === person.email || session?.role === 'founder' || session?.isAdmin;
          const isEditing = editing === person.email;
          return (
            <Card key={person.email} className="overflow-hidden rounded-[1.75rem]">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 border-b bg-muted/25 p-5">
                  {person.photoUrl ? <img src={person.photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">{initials(person.name)}</div>}
                  <div className="min-w-0"><p className="truncate font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.displayTitle}</p><Badge className="mt-2" variant="secondary">{person.role.replaceAll('_', ' ')}</Badge></div>
                </div>
                {!isEditing ? <div className="space-y-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Focus</p><p className="mt-1 text-sm">{person.focus || 'Add a focus area'}</p></div><p className="text-sm leading-6 text-muted-foreground">{person.bio || 'No profile bio yet.'}</p>{canEdit && <Button variant="outline" size="sm" onClick={() => begin(person)}><Pencil className="mr-2 h-4 w-4" />Edit profile</Button>}</div> : <div className="space-y-4 p-5"><div className="space-y-2"><Label>Display title</Label><Input value={draft.displayTitle} onChange={(e) => setDraft((d) => ({ ...d, displayTitle: e.target.value }))} /></div><div className="space-y-2"><Label>Focus area</Label><Input value={draft.focus} onChange={(e) => setDraft((d) => ({ ...d, focus: e.target.value }))} /></div><div className="space-y-2"><Label>Bio</Label><Textarea value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} className="min-h-28" /></div><div className="space-y-2"><Label>Photo</Label><Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />{draft.photoUrl && <img src={draft.photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />}</div><div className="flex gap-2"><Button onClick={() => save(person.email)}><Save className="mr-2 h-4 w-4" />Save</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div></div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
