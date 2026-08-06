import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useGetAuthMe, getGetAuthMeQueryKey } from '@workspace/api-client-react';
import {
  useListEmployees,
  useCreateEmployee,
  useDeleteEmployee,
  useUpdateEmployee,
  useResetEmployeePassword,
  getListEmployeesQueryKey,
} from '@workspace/api-client-react';
import type { StaffAccount } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, UserPlus, ShieldAlert, Eye, EyeOff, Settings2, KeyRound } from 'lucide-react';
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch as SwitchComponent } from '@/components/ui/switch';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<typeof DAYS[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
type StaffHours = StaffAccount['officeHours'];

export default function Employees() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Guard: redirect non-admins
  const { data: session, isLoading: loadingSession } = useGetAuthMe({
    query: { queryKey: getGetAuthMeQueryKey(), retry: false },
  });

  useEffect(() => {
    if (!loadingSession && session && !session.isAdmin) {
      setLocation('/staff/bookings');
    }
  }, [session, loadingSession, setLocation]);

  const { data: employees, isLoading: loadingEmployees } = useListEmployees();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<StaffAccount | null>(null);
  const [staffDraft, setStaffDraft] = useState<{ name: string; email: string; officeHours: StaffHours } | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const createEmployee = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setForm({ name: '', email: '', password: '' });
        toast({ title: 'Staff account created.' });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to create account.';
        toast({ variant: 'destructive', title: 'Error', description: msg });
      },
    },
  });

  const deleteEmployee = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({ title: 'Staff account removed.' });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to delete account.';
        toast({ variant: 'destructive', title: 'Error', description: msg });
      },
    },
  });

  const updateEmployee = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setSelectedEmployee(null);
        setStaffDraft(null);
        toast({ title: 'Staff member updated.' });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to update staff member.';
        toast({ variant: 'destructive', title: 'Update failed', description: msg });
      },
    },
  });

  const resetEmployeePassword = useResetEmployeePassword({
    mutation: {
      onSuccess: (data) => {
        setResetPassword('');
        toast({ title: 'Password reset successfully', description: data.message });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? 'Failed to reset password.';
        toast({ variant: 'destructive', title: 'Password reset failed', description: msg });
      },
    },
  });

  const openManage = (employee: StaffAccount) => {
    setSelectedEmployee(employee);
    setStaffDraft({
      name: employee.name,
      email: employee.email,
      officeHours: structuredClone(employee.officeHours),
    });
    setResetPassword('');
  };

  const closeManage = () => {
    setSelectedEmployee(null);
    setStaffDraft(null);
    setResetPassword('');
  };

  const saveEmployee = () => {
    if (!selectedEmployee || !staffDraft) return;
    updateEmployee.mutate({ id: selectedEmployee.id, data: staffDraft });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ variant: 'destructive', title: 'All fields are required.' });
      return;
    }
    createEmployee.mutate({
      data: {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      },
    });
  };

  if (loadingSession) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!session?.isAdmin) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Employees</h1>
        <p className="text-muted-foreground mt-2">
          Manage staff portal access. Only you can see this page.
        </p>
      </div>

      <Dialog open={Boolean(selectedEmployee)} onOpenChange={(open) => !open && closeManage()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Update this therapist&apos;s account, public hours, or password. These controls are admin-only.
            </DialogDescription>
          </DialogHeader>
          {staffDraft && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="manage-name">Full Name</Label>
                  <Input
                    id="manage-name"
                    value={staffDraft.name}
                    onChange={(e) => setStaffDraft((draft) => draft ? { ...draft, name: e.target.value } : draft)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manage-email">Email Address</Label>
                  <Input
                    id="manage-email"
                    type="email"
                    value={staffDraft.email}
                    onChange={(e) => setStaffDraft((draft) => draft ? { ...draft, email: e.target.value } : draft)}
                  />
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-4">
                  <h3 className="font-semibold">Public Therapist Hours</h3>
                  <p className="text-sm text-muted-foreground">These appear under this therapist&apos;s name on the public booking page.</p>
                </div>
                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const hours = staffDraft.officeHours[day];
                    return (
                      <div key={day} className="grid grid-cols-1 sm:grid-cols-[7rem_7rem_1fr_1fr] gap-3 items-center rounded-lg bg-muted/30 p-3">
                        <span className="font-medium">{DAY_LABELS[day]}</span>
                        <div className="flex items-center gap-2">
                          <SwitchComponent
                            checked={hours.closed}
                            onCheckedChange={(closed) => setStaffDraft((draft) => draft ? {
                              ...draft,
                              officeHours: { ...draft.officeHours, [day]: { ...draft.officeHours[day], closed } },
                            } : draft)}
                          />
                          <span className="text-sm text-muted-foreground">Closed</span>
                        </div>
                        <Input
                          type="time"
                          disabled={hours.closed}
                          value={hours.open}
                          onChange={(e) => setStaffDraft((draft) => draft ? {
                            ...draft,
                            officeHours: { ...draft.officeHours, [day]: { ...draft.officeHours[day], open: e.target.value } },
                          } : draft)}
                        />
                        <Input
                          type="time"
                          disabled={hours.closed}
                          value={hours.close}
                          onChange={(e) => setStaffDraft((draft) => draft ? {
                            ...draft,
                            officeHours: { ...draft.officeHours, [day]: { ...draft.officeHours[day], close: e.target.value } },
                          } : draft)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <h3 className="font-semibold">Reset Password</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">This immediately replaces the therapist&apos;s current password.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password, at least 8 characters"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={resetPassword.length < 8 || resetEmployeePassword.isPending}
                    onClick={() => resetEmployeePassword.mutate({
                      id: selectedEmployee!.id,
                      data: { password: resetPassword },
                    })}
                  >
                    {resetEmployeePassword.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Reset Password
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeManage}>Cancel</Button>
            <Button type="button" onClick={saveEmployee} disabled={!staffDraft || updateEmployee.isPending}>
              {updateEmployee.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Staff Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Staff Account
          </CardTitle>
          <CardDescription>
            Create a login for a team member. They'll be able to access the staff portal
            but not this Employees section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input
                id="emp-name"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-email">Email Address</Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-password">Temporary Password</Label>
              <div className="relative">
                <Input
                  id="emp-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={createEmployee.isPending}>
                {createEmployee.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Active Staff Accounts</CardTitle>
          <CardDescription>
            These people can log in to the staff portal. They cannot access this Employees page.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingEmployees ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !employees?.length ? (
            <div className="text-center text-muted-foreground p-8">
              No additional staff accounts yet. Add one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Created By</TableHead>
                  <TableHead className="hidden md:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {emp.createdBy}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {format(parseISO(emp.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openManage(emp)}>
                          <Settings2 className="w-4 h-4 mr-1.5" /> Manage
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deleteEmployee.isPending}
                          onClick={() => {
                            if (confirm(`Remove ${emp.name}'s access? They will no longer be able to log in.`)) {
                              deleteEmployee.mutate({ id: emp.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-400">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Access note</p>
          <p>
            Staff accounts can view and manage bookings, clients, and settings.
             Only your admin account can add, manage, reset, or remove staff members.
          </p>
        </div>
      </div>
    </div>
  );
}
