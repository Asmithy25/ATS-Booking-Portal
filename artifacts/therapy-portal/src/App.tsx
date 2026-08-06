import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from '@/pages/public/home';
const BookingManage = lazy(() => import('@/pages/public/booking-manage'));
const Login = lazy(() => import('@/pages/staff/login'));
const StaffDashboardLayout = lazy(() => import('@/pages/staff/dashboard/layout'));
const Bookings = lazy(() => import('@/pages/staff/dashboard/bookings'));
const Clients = lazy(() => import('@/pages/staff/dashboard/clients'));
const Settings = lazy(() => import('@/pages/staff/dashboard/settings'));
const Employees = lazy(() => import('@/pages/staff/dashboard/employees'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function StaffRouter() {
  return (
    <StaffDashboardLayout>
      <Switch>
        <Route path="/staff/dashboard" component={Bookings} />
        <Route path="/staff/bookings" component={Bookings} />
        <Route path="/staff/clients" component={Clients} />
        <Route path="/staff/settings" component={Settings} />
        <Route path="/staff/employees" component={Employees} />
        <Route component={NotFound} />
      </Switch>
    </StaffDashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/booking/:code" component={BookingManage} />
      <Route path="/staff" component={Login} />
      <Route path="/staff/login" component={Login} />
      <Route path="/staff/*" component={StaffRouter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-background text-primary">
                <div className="h-8 w-8 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
              </div>
            }
          >
            <Router />
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
