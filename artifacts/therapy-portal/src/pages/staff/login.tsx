import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { useStaffLogin } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowUpRight, Loader2, ShieldCheck } from 'lucide-react';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';
import { Link } from 'wouter';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  keepSignedIn: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      keepSignedIn: false,
    },
  });

  const loginMutation = useStaffLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.success) {
          toast({
            title: 'Welcome back',
            description: `Successfully logged in as ${data.staffName}.`,
          });
          setLocation('/staff/dashboard');
        } else {
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Invalid credentials. Please try again.',
          });
        }
      },
      onError: (error) => {
        const msg = (error as { data?: { error?: string } })?.data?.error;
        toast({
          variant: 'destructive',
          title: 'Login Error',
          description: msg || 'An unexpected error occurred.',
        });
      }
    }
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen bg-[#edf0eb] p-4 text-foreground dark:bg-background sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-stretch overflow-hidden border border-border bg-card shadow-xl lg:grid-cols-[1fr_420px]">
        <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center bg-secondary p-1">
                <img src={logoUrl} alt="Ayden's Therapy Services" className="h-full w-full object-cover mix-blend-multiply" />
              </span>
              <span className="max-w-[150px] text-[11px] font-extrabold uppercase leading-[1.15] tracking-[.1em]">Ayden's Therapy Services</span>
            </div>
            <p className="mt-24 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-secondary">Care workspace</p>
            <h1 className="mt-5 max-w-md font-serif text-7xl font-normal leading-[.87]">Clarity for the work that matters.</h1>
            <p className="mt-7 max-w-sm text-sm leading-7 text-primary-foreground/70">A private operational space for appointments, client care, and the small details that help the practice move well.</p>
          </div>
          <div className="border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground/60">
            <div className="flex items-center gap-2 text-primary-foreground"><ShieldCheck className="h-4 w-4 text-secondary" /> Private staff access</div>
            <p className="mt-2">Use the account provided by the practice team.</p>
          </div>
        </section>

        <section className="flex items-center p-7 sm:p-12">
          <div className="w-full">
            <Link href="/" className="mb-12 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive">
              <ArrowLeft className="h-4 w-4" /> Practice home
            </Link>
            <div className="mb-9">
              <span className="flex h-12 w-12 items-center justify-center bg-secondary p-1 lg:hidden">
                <img src={logoUrl} alt="Ayden's Therapy Services" className="h-full w-full object-cover mix-blend-multiply" />
              </span>
              <p className="mt-7 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-destructive">Staff access</p>
              <h2 className="mt-3 font-serif text-5xl font-normal leading-none">Welcome back.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Sign in to manage bookings and settings.</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                        <Input autoComplete="username" placeholder="ayden@aydenstherapyservices.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <Input autoComplete="current-password" type="password" placeholder="Enter your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keepSignedIn"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md py-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Keep me signed in</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

                <Button
                type="submit" 
                  className="h-12 w-full text-base"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing in...</>
                ) : (
                  <>Sign in securely <ArrowUpRight className="h-4 w-4" /></>
                )}
              </Button>
              </form>
            </Form>
          </div>
        </section>
      </div>
    </div>
  );
}
