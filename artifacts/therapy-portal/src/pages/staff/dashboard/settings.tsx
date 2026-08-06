import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
  useGetAuthMe,
  getGetAuthMeQueryKey,
  useGetMyHours,
  useUpdateMyHours,
  getGetMyHoursQueryKey,
} from '@workspace/api-client-react';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch as SwitchComponent } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import defaultLogoUrl from '@assets/ATS_FALL_1785938831030.png';

// Using the same structure as the API
const daySchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean(),
});

const settingsSchema = z.object({
  acceptingClients: z.boolean(),
  sessionRequestsOpen: z.boolean(),
  siteName: z.string().min(1).max(100),
  siteTagline: z.string().min(1).max(120),
  logoUrl: z.string().max(2048).refine((value) => {
    if (value === '') return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use a valid HTTP or HTTPS image URL, or clear the field to use the default logo.'),
  heroTitle: z.string().min(1).max(180),
  heroDescription: z.string().min(1).max(300),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  officeHours: z.object({
    mon: daySchema,
    tue: daySchema,
    wed: daySchema,
    thu: daySchema,
    fri: daySchema,
    sat: daySchema,
    sun: daySchema,
  }),
  holidayHours: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    date: z.string().regex(/^\d{2}-\d{2}$/, 'Must be MM-DD format'),
    closed: z.boolean(),
    open: z.string(),
    close: z.string(),
  })),
  closedDates: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
    reason: z.string().min(1, 'Reason is required'),
  })),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function Settings() {
  const { data: session } = useGetAuthMe({
    query: { queryKey: getGetAuthMeQueryKey(), retry: false },
  });
  const { data: settings, isLoading } = useGetSettings();
  const { data: myHours, isLoading: isLoadingMyHours } = useGetMyHours({
    query: { queryKey: getGetMyHoursQueryKey(), retry: false },
  });
  const updateSettings = useUpdateSettings();
  const updateMyHours = useUpdateMyHours();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hoursForm = useForm<{ officeHours: SettingsFormValues['officeHours'] }>({
    resolver: zodResolver(z.object({
      officeHours: settingsSchema.shape.officeHours,
    })),
    defaultValues: {
      officeHours: {
        mon: { open: '12:00', close: '23:00', closed: false },
        tue: { open: '12:00', close: '23:00', closed: false },
        wed: { open: '12:00', close: '23:00', closed: false },
        thu: { open: '12:00', close: '23:00', closed: false },
        fri: { open: '12:00', close: '23:00', closed: false },
        sat: { open: '13:00', close: '20:00', closed: false },
        sun: { open: '13:00', close: '20:00', closed: false },
      },
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      acceptingClients: true,
      sessionRequestsOpen: true,
      siteName: "Ayden's Therapy Services",
      siteTagline: 'Heal. Grow. Thrive.',
      logoUrl: '',
      heroTitle: 'A safe space on the line.',
      heroDescription: 'Compassionate, judgment-free mental wellness support delivered directly to you.',
      primaryColor: '#7B4A2F',
      secondaryColor: '#C38A4A',
      accentColor: '#D9B7A2',
      officeHours: {
        mon: { open: '12:00', close: '23:00', closed: false },
        tue: { open: '12:00', close: '23:00', closed: false },
        wed: { open: '12:00', close: '23:00', closed: false },
        thu: { open: '12:00', close: '23:00', closed: false },
        fri: { open: '12:00', close: '23:00', closed: false },
        sat: { open: '13:00', close: '20:00', closed: false },
        sun: { open: '13:00', close: '20:00', closed: false },
      },
      holidayHours: [],
      closedDates: [],
    }
  });

  const { fields: holidayFields, append: appendHoliday, remove: removeHoliday } = useFieldArray({
    control: form.control,
    name: "holidayHours",
  });

  const { fields: closedDateFields, append: appendClosedDate, remove: removeClosedDate } = useFieldArray({
    control: form.control,
    name: "closedDates",
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  useEffect(() => {
    if (myHours) {
      hoursForm.reset({ officeHours: myHours.officeHours });
    }
  }, [myHours, hoursForm]);

  const onSubmit = (values: SettingsFormValues) => {
    const { officeHours: _officeHours, ...siteSettings } = values;
    updateSettings.mutate(
      { data: siteSettings },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: 'Settings saved successfully' });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ variant: 'destructive', title: 'Failed to save', description: msg });
        }
      }
    );
  };

  const onHoursSubmit = (values: { officeHours: SettingsFormValues['officeHours'] }) => {
    updateMyHours.mutate(
      { data: { officeHours: values.officeHours } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMyHoursQueryKey() });
          toast({ title: `${myHours?.name ?? 'Your'} hours saved successfully` });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } })?.data?.error;
          toast({ variant: 'destructive', title: 'Failed to save hours', description: msg });
        },
      },
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Portal Settings</h1>
          <p className="text-muted-foreground mt-2">Manage availability, hours, and public site toggles.</p>
        </div>
         <Button onClick={form.handleSubmit(onSubmit)} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Settings
        </Button>
      </div>

      <Form {...form}>
        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          <Form {...hoursForm}>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>My Therapist Hours</CardTitle>
                  <CardDescription>
                    These are the hours shown publicly under {myHours?.name ? `${myHours.name}'s Hours` : 'your name'}.
                    Only your own schedule is changed here.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  onClick={hoursForm.handleSubmit(onHoursSubmit)}
                  disabled={isLoadingMyHours || updateMyHours.isPending}
                >
                  {updateMyHours.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save My Hours
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingMyHours ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="space-y-4">
                    {DAYS.map((day) => (
                      <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-background">
                        <div className="w-24 font-medium capitalize">{day}</div>
                        <FormField
                          control={hoursForm.control}
                          name={`officeHours.${day}.closed`}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <SwitchComponent checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="font-normal text-sm w-16">Closed</FormLabel>
                            </FormItem>
                          )}
                        />
                        {!hoursForm.watch(`officeHours.${day}.closed`) && (
                          <>
                            <FormField
                              control={hoursForm.control}
                              name={`officeHours.${day}.open`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl><Input type="time" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <span className="text-muted-foreground">to</span>
                            <FormField
                              control={hoursForm.control}
                              name={`officeHours.${day}.close`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl><Input type="time" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Form>
          
          {/* General Toggles */}
          <Card>
            <CardHeader>
              <CardTitle>Public Site Toggles</CardTitle>
              <CardDescription>Control what visitors see on the public booking page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="acceptingClients"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">Accepting New Clients Badge</FormLabel>
                      <FormDescription>
                        Shows a "Now Accepting New Clients" badge in the hero section.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <SwitchComponent
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sessionRequestsOpen"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">Session Requests Open</FormLabel>
                      <FormDescription>
                        If disabled, the booking form is replaced with a "Currently Fully Booked" message.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <SwitchComponent
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Public Branding and Copy */}
          <Card>
            <CardHeader>
              <CardTitle>Website Branding & Copy</CardTitle>
              <CardDescription>Update the words and colors clients see on the public site.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {([
                ['siteName', 'Site name', "Ayden's Therapy Services"],
                ['siteTagline', 'Tagline', 'Heal. Grow. Thrive.'],
                ['heroTitle', 'Homepage headline', 'A safe space on the line.'],
                ['heroDescription', 'Homepage description', 'A short welcoming description for the homepage.'],
              ] as const).map(([name, label, placeholder]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className={name === 'heroDescription' ? 'md:col-span-2' : ''}>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        {name === 'heroDescription' ? (
                          <Input placeholder={placeholder} {...field} />
                        ) : (
                          <Input placeholder={placeholder} {...field} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logo image URL</FormLabel>
                    <FormDescription>
                      Paste a direct HTTP or HTTPS link to the image you want to use. Leave it blank to use the built-in Ayden&apos;s Therapy Services logo.
                    </FormDescription>
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                      <div className="h-20 w-20 shrink-0 rounded-full border border-border bg-muted p-1 overflow-hidden">
                        <img
                          src={field.value || defaultLogoUrl}
                          alt="Logo preview"
                          className="h-full w-full rounded-full object-cover object-top"
                          onError={(event) => {
                            event.currentTarget.src = defaultLogoUrl;
                          }}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://example.com/your-logo.png"
                            {...field}
                          />
                        </FormControl>
                        <div className="flex items-center justify-between gap-3">
                          <FormMessage />
                          {field.value && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => form.setValue('logoUrl', '')}
                            >
                              Use built-in logo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  ['primaryColor', 'Primary color'],
                  ['secondaryColor', 'Secondary color'],
                  ['accentColor', 'Accent color'],
                ] as const).map(([name, label]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <div className="flex gap-2">
                          <FormControl><Input type="color" className="w-12 p-1" {...field} /></FormControl>
                          <Input value={field.value} onChange={field.onChange} className="font-mono uppercase" />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

           {/* Ayden's booking schedule is retained for the primary public schedule. */}
           {session?.isAdmin && <Card>
            <CardHeader>
               <CardTitle>Ayden&apos;s Hours / Booking Schedule</CardTitle>
               <CardDescription>Ayden&apos;s public schedule and the schedule used to validate new booking requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-4 p-3 rounded-lg border bg-background">
                    <div className="w-24 font-medium capitalize">{day}</div>
                    
                    <FormField
                      control={form.control}
                      name={`officeHours.${day}.closed`}
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <SwitchComponent checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="font-normal text-sm w-16">Closed</FormLabel>
                        </FormItem>
                      )}
                    />

                    {!form.watch(`officeHours.${day}.closed`) && (
                      <>
                        <FormField
                          control={form.control}
                          name={`officeHours.${day}.open`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-muted-foreground">to</span>
                        <FormField
                          control={form.control}
                          name={`officeHours.${day}.close`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
           </Card>}

          {/* Special Holidays */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Annual Holidays</CardTitle>
                <CardDescription>Recurring yearly holidays (MM-DD).</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => appendHoliday({ name: '', date: '', closed: true, open: '12:00', close: '23:00' })}>
                <Plus className="w-4 h-4 mr-2" /> Add Holiday
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {holidayFields.map((field, index) => {
                  const isClosed = form.watch(`holidayHours.${index}.closed`);
                  return (
                    <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                      <FormField
                        control={form.control}
                        name={`holidayHours.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-[2]">
                            <FormControl><Input placeholder="Name (e.g. Christmas)" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`holidayHours.${index}.date`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl><Input placeholder="MM-DD" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`holidayHours.${index}.closed`}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0 px-2">
                            <FormControl>
                              <SwitchComponent checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal text-sm whitespace-nowrap">Closed</FormLabel>
                          </FormItem>
                        )}
                      />
                      {!isClosed && (
                        <>
                          <FormField
                            control={form.control}
                            name={`holidayHours.${index}.open`}
                            render={({ field }) => (
                              <FormItem className="w-24">
                                <FormControl><Input type="time" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`holidayHours.${index}.close`}
                            render={({ field }) => (
                              <FormItem className="w-24">
                                <FormControl><Input type="time" {...field} /></FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeHoliday(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                {holidayFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No annual holidays defined.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Specific Closed Dates */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Specific Closed Dates</CardTitle>
                <CardDescription>One-off days when the practice is closed (YYYY-MM-DD).</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => appendClosedDate({ date: format(new Date(), 'yyyy-MM-dd'), reason: 'Vacation' })}>
                <Plus className="w-4 h-4 mr-2" /> Add Date
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {closedDateFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                    <FormField
                      control={form.control}
                      name={`closedDates.${index}.date`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl><Input type="date" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`closedDates.${index}.reason`}
                      render={({ field }) => (
                        <FormItem className="flex-[2]">
                          <FormControl><Input placeholder="Reason (e.g. Vacation, Sick leave)" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeClosedDate(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {closedDateFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No specific closed dates defined.</p>
                )}
              </div>
            </CardContent>
          </Card>

        </form>
      </Form>
    </div>
  );
}
