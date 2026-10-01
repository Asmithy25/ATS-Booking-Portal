import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { format, parseISO, isBefore, isAfter, getDay } from 'date-fns';
import { useGetSettings, useCreateBooking } from '@workspace/api-client-react';

import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, Calendar, Mail, Clock, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { getThemeStyle } from '@/lib/theme';
import { getDailyQuote } from '@/lib/motivationalQuotes';
import { WellnessLookup } from '@/components/WellnessLookup';
import { getHomepageContent } from '@/lib/homepageContent';

import terracottaLogoUrl from '@assets/ATS_FALL_1786003864019.png';
import oliveLogoUrl from '@assets/ATS_FALL_1786003864019.png';

const bookingSchema = z.object({
  clientName: z.string().min(2, 'Name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  reason: z.string().min(10, 'Please provide a brief reason'),
  preferredDate: z.string().min(1, 'Date is required'),
  preferredTime: z.string().min(1, 'Time is required'),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

function formatOfficeTime(value: string) {
  const [hourString, minuteString = '00'] = value.split(':');
  const hour = Number(hourString);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteString} ${suffix}`;
}

function formatHoursRange(hours?: { open: string; close: string; closed: boolean }) {
  if (!hours || hours.closed) return 'Closed';
  return `${formatOfficeTime(hours.open)} - ${formatOfficeTime(hours.close)}`;
}

export default function Home() {
  const { data: settings, isLoading: loadingSettings } = useGetSettings();
  const content = getHomepageContent(settings);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const { toast } = useToast();
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (content.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = String(content.faviconUrl);
    }
    if (settings?.siteName) document.title = settings.siteName;
  }, [content.faviconUrl, settings?.siteName]);

  useEffect(() => {
    fetch('/api/portal/announcements?audience=client')
      .then((response) => response.ok ? response.json() : [])
      .then((items) => setAnnouncements(Array.isArray(items) ? items : []))
      .catch(() => setAnnouncements([]));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      clientName: '',
      phone: '',
      reason: '',
      preferredDate: '',
      preferredTime: '',
    },
  });
  const selectedDate = form.watch('preferredDate');
  const selectedDayKey = selectedDate ? (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[getDay(parseISO(selectedDate))] : null;
  const selectedHoliday = selectedDate ? settings?.holidayHours.find((holiday) => holiday.date === selectedDate.slice(5)) : undefined;
  const selectedHours = selectedHoliday
    ? (selectedHoliday.closed ? null : selectedHoliday)
    : selectedDayKey
      ? settings?.officeHours[selectedDayKey]
      : undefined;

  const createBooking = useCreateBooking({
    mutation: {
      onSuccess: (data) => {
        // data.confirmationCode comes from the API response
        const code = (data as unknown as { confirmationCode?: string })?.confirmationCode ?? '';
        setConfirmationCode(code);
        setBookingSuccess(true);
        form.reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        toast({
          variant: 'destructive',
          title: 'Booking failed',
          description: msg || 'Please try again later.',
        });
      }
    }
  });

  const onSubmit = (values: BookingFormValues) => {
    // Validate against office hours
    if (settings) {
      const selectedDate = parseISO(values.preferredDate);
      const dayIndex = getDay(selectedDate); // 0 = Sunday, 1 = Monday...
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
      const dayKey = days[dayIndex];
      const daySettings = settings.officeHours[dayKey];

      if (daySettings?.closed) {
        form.setError('preferredDate', { message: 'We are closed on this day of the week.' });
        return;
      }

      // Check holidays
      const dateStr = format(selectedDate, 'MM-dd');
      const holiday = settings.holidayHours.find(h => h.date === dateStr);
      if (holiday?.closed) {
        form.setError('preferredDate', { message: `We are closed on ${holiday.name}.` });
        return;
      }

      // Check closed dates
      const fullDateStr = format(selectedDate, 'yyyy-MM-dd');
      const closedDate = settings.closedDates.find(d => d.date === fullDateStr);
      if (closedDate) {
        form.setError('preferredDate', { message: `We are closed on this date: ${closedDate.reason}` });
        return;
      }

      const checkTime = (openStr: string, closeStr: string, selectedStr: string) => {
        return selectedStr >= openStr && selectedStr <= closeStr;
      };

       const toMinutes = (time: string) => {
         const [hours, minutes] = time.split(':').map(Number);
         return hours * 60 + minutes;
       };
       const toClosingMinutes = (time: string) => time === '00:00' ? 24 * 60 : toMinutes(time);
       const validTime = holiday
         ? toMinutes(values.preferredTime) >= toMinutes(holiday.open) && toMinutes(values.preferredTime) + 60 <= toClosingMinutes(holiday.close)
         : daySettings
           ? toMinutes(values.preferredTime) >= toMinutes(daySettings.open) && toMinutes(values.preferredTime) + 60 <= toClosingMinutes(daySettings.close)
           : false;

      if (!validTime) {
        form.setError('preferredTime', { message: 'Selected time is outside of office hours for this date.' });
        return;
      }
    }

    createBooking.mutate({ data: values });
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
  } as const;

  if (loadingSettings) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
      <div className="ats-public-home min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20" style={getThemeStyle(settings)}>
      <PublicNavbar />
      {announcements.length > 0 && <section className="border-b border-primary/10 bg-card"><div className="container mx-auto px-4 py-5">{announcements.map((announcement) => <article key={announcement.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex-1"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{announcement.metadata?.subheading ?? content.announcementSubheading}</p><h2 className="font-serif text-xl font-bold">{announcement.title}</h2><p className="text-sm text-muted-foreground">{announcement.body}</p></div>{announcement.metadata?.buttonText && announcement.metadata?.buttonUrl && <a href={announcement.metadata.buttonUrl} className="inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">{announcement.metadata.buttonText}</a>}</article>)}</div></section>}
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-14 pb-24 lg:pt-28 lg:pb-36">
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
               className="mb-10 max-w-2xl border-l-4 border-primary bg-card/75 px-5 py-4 shadow-sm backdrop-blur sm:px-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
                {now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold text-foreground">
                {content.heroWelcome}
              </p>
              <p className="mt-1 text-sm italic text-muted-foreground">
                “{getDailyQuote(now).quote}”
              </p>
            </motion.div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                 <motion.div
                initial="hidden" 
                animate="show" 
                variants={staggerContainer}
                className="max-w-2xl ats-rise"
              >
                {settings?.acceptingClients && (
                  <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 text-secondary-foreground text-sm font-medium border border-secondary/30">
                    <Sparkles className="w-4 h-4" />
                    {content.heroAcceptingText}
                  </motion.div>
                )}
                
                <motion.h1 variants={fadeUp} className="text-[3.4rem] sm:text-6xl lg:text-7xl font-serif font-bold text-foreground leading-[.98] mb-6">
                  {settings?.heroTitle ?? 'A safe space for healing and growth.'}
                </motion.h1>
                
                <motion.p variants={fadeUp} className="text-lg lg:text-xl text-muted-foreground mb-8 leading-relaxed max-w-xl">
                  {settings?.heroDescription ?? 'A warm, grounded space to explore your thoughts and feelings without judgment.'}
                  <span className="block mt-2 font-medium text-foreground">{content.heroSecondaryText}</span>
                </motion.p>
                
                <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4">
                   <Button data-testid="button-book-first-session"
                    size="lg" 
                    className="rounded-full text-lg px-8 h-14"
                    onClick={() => {
                      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                     {content.heroPrimaryButton}
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-4">
                    <PhoneCall className="w-4 h-4" />
                    {content.heroPhoneBadge}
                  </div>
                </motion.div>
              </motion.div>
              
               <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  className="relative hidden lg:block"
              >
                  <div className="absolute -inset-8 rounded-[3rem] bg-secondary/20 blur-3xl" />
                  <div className="relative w-full max-w-lg mx-auto overflow-hidden border border-primary/15 shadow-2xl bg-[hsl(43_33%_94%)]">
                    <img
                      src={content.heroImageUrl || settings?.logoUrl || terracottaLogoUrl}
                      alt={content.logoAlt}
                      className="w-full aspect-square object-cover"
                      fetchPriority="high"
                      decoding="async"
                    />
                    <div className="absolute inset-5 border border-primary/20 pointer-events-none" />
                  </div>
                 <div className="absolute bottom-8 -left-12 transform bg-card p-5 rounded-2xl shadow-xl border border-border/50 max-w-xs animate-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="font-serif font-bold">{content.heroCardTitle}</p>
                       <p className="text-xs text-muted-foreground">{content.heroCardSubtitle}</p>
                    </div>
                  </div>
                   <p className="text-sm text-muted-foreground">{content.heroCardDescription}</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section id="about" className="py-24 bg-card border-y border-border/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative order-2 lg:order-1"
              >
                <div className="aspect-square rounded-[2rem] overflow-hidden bg-muted relative shadow-lg">
                  <img
                    src={content.aboutImageUrl || settings?.logoUrl || oliveLogoUrl}
                    alt={content.logoAlt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-[2rem] m-4 pointer-events-none" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="order-1 lg:order-2"
              >
                 <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary mb-4">{content.aboutEyebrow}</p>
                 <h2 className="text-4xl font-serif font-bold mb-6 text-foreground">{content.aboutTitle}</h2>
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                  <p>
                    {content.aboutParagraph1}
                  </p>
                  <p>
                    {content.aboutParagraph2}
                  </p>
                  <p>
                    {content.aboutParagraph3}
                  </p>
                </div>
                
                <div className="mt-8 pt-8 border-t border-border flex items-center gap-4">
                  <img
                    src={settings?.logoUrl || oliveLogoUrl}
                    className="w-12 h-12 rounded-full object-cover opacity-70"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <p className="font-serif italic text-xl text-primary">“{content.aboutQuote}”</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <WellnessLookup />

        {/* BOOKING SECTION */}
         <section id="book" className="py-24 relative bg-[hsl(35_44%_94%)]">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
               <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary mb-3">{content.bookingEyebrow}</p>
               <h2 className="text-4xl font-serif font-bold mb-4">{content.bookingTitle}</h2>
              <p className="text-lg text-muted-foreground">{content.bookingDescription}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Info Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                 className="col-span-1 lg:col-span-5 bg-[hsl(25_29%_21%)] text-[hsl(38_42%_96%)] p-7 sm:p-8 rounded-[1.75rem] shadow-xl"
              >
                <h3 className="font-serif text-2xl font-bold mb-8">{content.bookingInfoTitle}</h3>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <PhoneCall className="w-6 h-6 mt-1 opacity-80" />
                    <div>
                       <p className="font-bold">{content.heroCardTitle}s</p>
                      <p className="opacity-90 mt-1">{content.bookingPhone}</p>
                      <Badge variant="outline" className="mt-2 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">{content.bookingOfficeBadge}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <Mail className="w-6 h-6 mt-1 opacity-80" />
                    <div>
                      <p className="font-bold">{content.bookingEmailLabel}</p>
                      <p className="opacity-90 mt-1 break-all">{content.bookingEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 pt-8 border-t border-primary-foreground/20">
                    <Clock className="w-6 h-6 mt-1 opacity-80" />
                    <div className="w-full">
                       <p className="font-bold mb-4">{content.bookingHoursTitle}</p>
                       <div className="space-y-1.5 text-sm opacity-90">
                         {[
                           { label: 'M-F', hours: settings?.officeHours?.mon },
                           { label: 'Sat', hours: settings?.officeHours?.sat },
                           { label: 'Sun', hours: settings?.officeHours?.sun },
                         ].map(({ label, hours }) => (
                           <div key={label} className="flex justify-between gap-3">
                             <span>{label}</span>
                             <span className="text-right">{formatHoursRange(hours)}</span>
                           </div>
                         ))}
                       </div>
                       <p className="mt-6 border-t border-primary-foreground/20 pt-6 font-bold mb-4">{content.bookingTherapistHoursTitle}</p>
                       <div className="space-y-5 text-sm opacity-90">
                         {(settings?.therapistHours ?? []).map((therapist) => (
                           <div key={therapist.name} className="space-y-2">
                             <p className="font-semibold text-primary-foreground">{therapist.name}&apos;s Hours:</p>
                             <div className="space-y-1.5 pl-2 border-l border-primary-foreground/20">
                               {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                                 const h = therapist.officeHours?.[day as keyof typeof therapist.officeHours];
                                 if (!h) return null;
                                 return (
                                   <div key={day} className="flex justify-between w-full gap-3">
                                     <span className="capitalize w-12">{day.substring(0,3)}</span>
                                     <span className="text-right">{formatHoursRange(h)}</span>
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  </div>

                  {settings?.holidayHours && settings.holidayHours.length > 0 && (
                    <div className="flex items-start gap-4 pt-8 border-t border-primary-foreground/20">
                      <Calendar className="w-6 h-6 mt-1 opacity-80" />
                      <div className="w-full">
                        <p className="font-bold mb-2">{content.bookingHolidaysTitle}</p>
                        <div className="space-y-2 text-sm opacity-90">
                          {settings.holidayHours.map((h, i) => (
                            <div key={i} className="flex flex-col mb-2">
                              <span className="font-medium">{h.name} ({h.date})</span>
                              <span>{h.closed ? 'Closed' : `${h.open} - ${h.close}`}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Form Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                 className="col-span-1 lg:col-span-7 bg-card p-6 sm:p-8 rounded-[1.75rem] shadow-xl border border-border relative overflow-hidden"
              >
                {bookingSuccess ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-card z-20 overflow-y-auto">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-foreground mb-3">{content.bookingSuccessTitle}</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                      {content.bookingSuccessDescription}
                    </p>
                    {confirmationCode && (
                      <div className="w-full max-w-sm mb-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{content.bookingCodeLabel}</p>
                        <div className="bg-primary/5 border-2 border-primary/20 rounded-xl px-6 py-4 font-mono text-2xl font-bold tracking-widest text-primary select-all">
                          {confirmationCode}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{content.bookingCodeDescription}</p>
                        <a
                          href={`/booking/${confirmationCode}`}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          Manage your booking →
                        </a>
                      </div>
                    )}
                    <Button onClick={() => { setBookingSuccess(false); setConfirmationCode(''); }} variant="outline">
                      {content.bookingAnotherButton}
                    </Button>
                  </div>
                ) : !settings?.sessionRequestsOpen ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-card z-20">
                    <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mb-6">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-foreground mb-4">{content.bookingClosedTitle}</h3>
                    <p className="text-muted-foreground max-w-sm">
                      {content.bookingClosedDescription}
                    </p>
                  </div>
                ) : null}

                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <h3 className="font-serif text-2xl font-bold">{content.bookingFormTitle}</h3>
                      <a href="/booking" className="text-sm font-medium text-primary hover:underline">{content.bookingManageLink}</a>
                    </div>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{content.bookingNameLabel}</FormLabel>
                            <FormControl>
                              <Input placeholder="{content.bookingNamePlaceholder}" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{content.bookingPhoneFieldLabel}</FormLabel>
                            <FormControl>
                              <Input placeholder="{content.bookingPhonePlaceholder}" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                         <FormLabel>{content.bookingReasonLabel}</FormLabel>
                          <FormControl>
                            <Textarea 
                               placeholder="{content.bookingReasonPlaceholder}"
                              className="resize-none h-24"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="preferredDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{content.bookingDateLabel}</FormLabel>
                            <FormControl>
                              <Input type="date" min={format(new Date(), 'yyyy-MM-dd')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="preferredTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{content.bookingTimeLabel}</FormLabel>
                             <FormControl>
                               <Input type="time" step="900" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                     <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                      <p className="text-xs text-muted-foreground max-w-xs">
                         {content.bookingDisclaimer}
                      </p>
                      <Button 
                        type="submit" 
                        size="lg" 
                         className="px-8 rounded-full w-full sm:w-auto"
                        disabled={createBooking.isPending || !settings?.sessionRequestsOpen}
                      >
                         {createBooking.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {content.bookingSendingText}</> : content.bookingSubmitText}
                      </Button>
                    </div>
                  </form>
                </Form>
              </motion.div>
                    </div>
                    <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                      <Clock className="mr-2 inline h-4 w-4 text-primary" />
                      {selectedHours
                        ? selectedHours.closed
                          ? 'The practice is closed on this date.'
                          : `Choose any start time from ${formatOfficeTime(selectedHours.open)} to ${formatOfficeTime(selectedHours.close)}, leaving one hour for your phone session.`
                        : 'Choose a date to see available business hours. Sessions are 60 minutes and must fit within the practice hours.'}
                    </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
