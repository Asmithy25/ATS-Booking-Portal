import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { useGetSettings } from '@workspace/api-client-react';
import { getThemeStyle } from '@/lib/theme';

import Home from '@/pages/public/home';
const BookingManage = lazy(() => import('@/pages/public/booking-manage'));
const Login = lazy(() => import('@/pages/staff/login'));
const StaffDashboardLayout = lazy(() => import('@/pages/staff/dashboard/layout'));
const Welcome = lazy(() => import('@/pages/staff/dashboard/welcome'));
const Bookings = lazy(() => import('@/pages/staff/dashboard/bookings'));
const Clients = lazy(() => import('@/pages/staff/dashboard/clients'));
const Wellness = lazy(() => import('@/pages/staff/dashboard/wellness'));
const Settings = lazy(() => import('@/pages/staff/dashboard/settings'));
const Employees = lazy(() => import('@/pages/staff/dashboard/employees'));
const Analytics = lazy(() => import('@/pages/staff/dashboard/analytics'));
const Activity = lazy(() => import('@/pages/staff/dashboard/activity'));
const Announcements = lazy(() => import('@/pages/staff/dashboard/announcements'));
const Support = lazy(() => import('@/pages/staff/dashboard/support'));
const TeamWorkspace = lazy(() => import('@/pages/staff/dashboard/team-workspace'));
const TeamChat = lazy(() => import('@/pages/staff/dashboard/team-chat'));
const MessageTemplates = lazy(() => import('@/pages/staff/dashboard/message-templates'));
const ClientTemplates = lazy(() => import('@/pages/staff/dashboard/client-templates'));
const Rollout = lazy(() => import('@/pages/staff/dashboard/rollout'));
const Notifications = lazy(() => import('@/pages/staff/dashboard/notifications'));
const Feedback = lazy(() => import('@/pages/staff/dashboard/feedback'));
const Security = lazy(() => import('@/pages/staff/dashboard/security'));
const PracticeControl = lazy(() => import('@/pages/staff/dashboard/practice-control'));
const HomepageControls = lazy(() => import('@/pages/staff/dashboard/homepage-controls'));
const StaffDirectory = lazy(() => import('@/pages/staff/dashboard/staff-directory'));
const FounderDashboard = lazy(() => import('@/pages/staff/dashboard/founder-dashboard'));
const GlobalSearch = lazy(() => import('@/pages/staff/dashboard/global-search'));
const SystemHealth = lazy(() => import('@/pages/staff/dashboard/system-health'));
const HomepagePreview = lazy(() => import('@/pages/staff/dashboard/homepage-preview'));
const PublicUpdates = lazy(() => import('@/pages/public/updates'));
const PublicAssistant = lazy(() => import('@/pages/public/assistant'));
const ClientAuth = lazy(() => import('@/pages/client/auth'));
const ClientPortal = lazy(() => import('@/pages/client/portal'));
const ClientTools = lazy(() => import('@/pages/client/tools'));
const UploadPage = lazy(() => import('@/pages/public/upload'));
const AdvancedWorkspace = lazy(() => import('@/pages/staff/dashboard/advanced-workspace'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function ThemeSettingsBridge({ children }: { children: React.ReactNode }) {
  const { data: settings } = useGetSettings();
  return <div style={getThemeStyle(settings)} className="min-h-screen">{children}</div>;
}

function StaffRouter() {
  return (
    <StaffDashboardLayout>
      <Switch>
        <Route path="/staff/dashboard" component={Welcome} />
        <Route path="/staff/welcome" component={Welcome} />
        <Route path="/staff/bookings" component={Bookings} />
        <Route path="/staff/clients" component={Clients} />
        <Route path="/staff/wellness" component={Wellness} />
        <Route path="/staff/analytics" component={Analytics} />
        <Route path="/staff/activity" component={Activity} />
        <Route path="/staff/announcements" component={Announcements} />
        <Route path="/staff/support" component={Support} />
        <Route path="/staff/team" component={TeamWorkspace} />
        <Route path="/staff/team-chat" component={TeamChat} />
        <Route path="/staff/messages" component={MessageTemplates} />
        <Route path="/staff/client-templates" component={ClientTemplates} />
        <Route path="/staff/rollout" component={Rollout} />
        <Route path="/staff/notifications" component={Notifications} />
        <Route path="/staff/feedback" component={Feedback} />
        <Route path="/staff/security" component={Security} />
        <Route path="/staff/homepage-preview" component={HomepagePreview} />
        <Route path="/staff/practice-control" component={PracticeControl} />
        <Route path="/staff/homepage-controls" component={HomepageControls} />
        <Route path="/staff/staff-directory" component={StaffDirectory} />
        <Route path="/staff/founder-dashboard" component={FounderDashboard} />
        <Route path="/staff/search" component={GlobalSearch} />
        <Route path="/staff/system-health" component={SystemHealth} />
        <Route path="/staff/operations" component={AdvancedWorkspace} />
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
      <Route path="/booking" component={BookingManage} />
      <Route path="/updates" component={PublicUpdates} />
      <Route path="/assistant" component={PublicAssistant} />
      <Route path="/staff" component={Login} />
      <Route path="/staff/login" component={Login} />
      <Route path="/portal/login" component={ClientAuth} />
      <Route path="/portal/tools" component={ClientTools} />
      <Route path="/portal" component={ClientPortal} />
      <Route path="/upload/:token" component={UploadPage} />
      <Route path="/staff/*" component={StaffRouter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeSettingsBridge>
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
        </ThemeSettingsBridge>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
