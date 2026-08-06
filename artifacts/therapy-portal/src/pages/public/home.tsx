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

export default function Home() {
  const { data: settings, isLoading: loadingSettings } = useGetSettings();
  const { toast } = useToast();
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [now, setNow] = useState(() => new Date());

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
       const validTime = holiday
         ? toMinutes(values.preferredTime) >= toMinutes(holiday.open) && toMinutes(values.preferredTime) + 60 <= toMinutes(holiday.close)
         : daySettings
           ? toMinutes(values.preferredTime) >= toMinutes(daySettings.open) && toMinutes(values.preferredTime) + 60 <= toMinutes(daySettings.close)
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
      <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20" style={getThemeStyle(settings)}>
      <PublicNavbar />
      
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-14 pb-24 lg:pt-28 lg:pb-36">
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-10 max-w-2xl rounded-[1.5rem] border border-primary/15 bg-card/75 px-5 py-4 shadow-sm backdrop-blur sm:px-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
                {now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold text-foreground">
                Welcome — this is a space for you.
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
                    Now Accepting New Clients
                  </motion.div>
                )}
                
                <motion.h1 variants={fadeUp} className="text-[3.4rem] sm:text-6xl lg:text-7xl font-serif font-bold text-foreground leading-[.98] mb-6">
                  {settings?.heroTitle ?? 'A safe space for healing and growth.'}
                </motion.h1>
                
                <motion.p variants={fadeUp} className="text-lg lg:text-xl text-muted-foreground mb-8 leading-relaxed max-w-xl">
                  {settings?.heroDescription ?? 'A warm, grounded space to explore your thoughts and feelings without judgment.'}
                  <span className="block mt-2 font-medium text-foreground">Take the first step toward a more centered life — from wherever you feel most at ease.</span>
                </motion.p>
                
                <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4">
                   <Button data-testid="button-book-first-session"
                    size="lg" 
                    className="rounded-full text-lg px-8 h-14"
                    onClick={() => {
                      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                     Begin Your First Session
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-4">
                    <PhoneCall className="w-4 h-4" />
                    100% Phone-Based
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
                  <div className="relative w-full max-w-lg mx-auto rounded-[2.5rem] overflow-hidden border border-primary/15 shadow-2xl bg-[hsl(35_44%_94%)]">
                    <img
                      src={settings?.logoUrl || terracottaLogoUrl}
                      alt="Ayden's Therapy Services botanical logo"
                      className="w-full aspect-square object-cover"
                      fetchPriority="high"
                      decoding="async"
                    />
                    <div className="absolute inset-5 rounded-[2rem] border border-primary/20 pointer-events-none" />
                  </div>
                 <div className="absolute bottom-8 -left-12 transform bg-card p-5 rounded-2xl shadow-xl border border-border/50 max-w-xs animate-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="font-serif font-bold">Phone consultation</p>
                       <p className="text-xs text-muted-foreground">A calm place to begin</p>
                    </div>
                  </div>
                   <p className="text-sm text-muted-foreground">Support that meets you where you are.</p>
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
                    src={settings?.logoUrl || oliveLogoUrl}
                    alt="Ayden's Therapy Services olive botanical logo"
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
                 <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary mb-4">A grounded space for your next chapter</p>
                 <h2 className="text-4xl font-serif font-bold mb-6 text-foreground">Healing begins with being heard.</h2>
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                  <p>
                    Ayden’s Therapy Services offers a warm, judgment-free space to slow down, reflect, and feel supported.
                  </p>
                  <p>
                    With phone-based consultations, you can connect from the place that already feels safe — no commute, no waiting room, and no pressure to have everything figured out before you begin.
                  </p>
                  <p>
                    Whether you’re navigating a life transition, managing anxiety, or looking for a grounded presence to talk through the week, you deserve support that honors your pace. Heal, grow, and thrive on your own terms.
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
                  <p className="font-serif italic text-xl text-primary">“Your story deserves space.”</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* BOOKING SECTION */}
         <section id="book" className="py-24 relative bg-[hsl(35_44%_94%)]">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
               <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary mb-3">Let’s connect</p>
               <h2 className="text-4xl font-serif font-bold mb-4">Make room for your wellbeing.</h2>
              <p className="text-lg text-muted-foreground">Request a brief phone consultation to see if we’re a good fit.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Info Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                 className="col-span-1 lg:col-span-5 bg-[hsl(25_29%_21%)] text-[hsl(38_42%_96%)] p-7 sm:p-8 rounded-[1.75rem] shadow-xl"
              >
                <h3 className="font-serif text-2xl font-bold mb-8">A gentle place to start</h3>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <PhoneCall className="w-6 h-6 mt-1 opacity-80" />
                    <div>
                       <p className="font-bold">Phone consultations</p>
                      <p className="opacity-90 mt-1">+1 (561) 291-8556</p>
                      <Badge variant="outline" className="mt-2 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">No Physical Office</Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <Mail className="w-6 h-6 mt-1 opacity-80" />
                    <div>
                      <p className="font-bold">Email</p>
                      <p className="opacity-90 mt-1 break-all">aydenstherapyservices@gmail.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 pt-8 border-t border-primary-foreground/20">
                    <Clock className="w-6 h-6 mt-1 opacity-80" />
                    <div className="w-full">
                       <p className="font-bold mb-4">Therapist Hours:</p>
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
                                     <span className="text-right">{h.closed ? 'Closed' : `${h.open} - ${h.close}`}</span>
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
                        <p className="font-bold mb-2">Upcoming Holidays</p>
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
                    <h3 className="text-2xl font-serif font-bold text-foreground mb-3">Request Sent!</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                      Your booking request has been received. I'll contact you shortly to confirm your session.
                    </p>
                    {confirmationCode && (
                      <div className="w-full max-w-sm mb-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your Confirmation Code</p>
                        <div className="bg-primary/5 border-2 border-primary/20 rounded-xl px-6 py-4 font-mono text-2xl font-bold tracking-widest text-primary select-all">
                          {confirmationCode}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Save this code — you can use it to reschedule or cancel your appointment.</p>
                        <a
                          href={`/booking/${confirmationCode}`}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          Manage your booking →
                        </a>
                      </div>
                    )}
                    <Button onClick={() => { setBookingSuccess(false); setConfirmationCode(''); }} variant="outline">
                      Book Another Session
                    </Button>
                  </div>
                ) : !settings?.sessionRequestsOpen ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-card z-20">
                    <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mb-6">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-foreground mb-4">Currently Fully Booked</h3>
                    <p className="text-muted-foreground max-w-sm">
                      We are not accepting new session requests at this moment. Please check back later.
                    </p>
                  </div>
                ) : null}

                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <h3 className="font-serif text-2xl font-bold">Request a consultation</h3>
                      <a href="/booking" className="text-sm font-medium text-primary hover:underline">Already booked? Manage with your code →</a>
                    </div>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Jane Doe" {...field} />
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
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" {...field} />
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
                         <FormLabel>What would you like support with?</FormLabel>
                          <FormControl>
                            <Textarea 
                               placeholder="Share a little about what brings you here..."
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
                            <FormLabel>Preferred Date</FormLabel>
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
                            <FormLabel>Preferred Time</FormLabel>
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
                         This first step is simply a request. All consultations are held by phone.
                      </p>
                      <Button 
                        type="submit" 
                        size="lg" 
                         className="px-8 rounded-full w-full sm:w-auto"
                        disabled={createBooking.isPending || !settings?.sessionRequestsOpen}
                      >
                         {createBooking.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending</> : 'Request consultation'}
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
                          : `Choose any start time from ${selectedHours.open} to ${selectedHours.close}, leaving one hour for your phone session.`
                        : 'Choose a date to see available business hours. Sessions are 60 minutes and must fit within the practice hours.'}
                    </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
