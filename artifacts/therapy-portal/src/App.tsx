import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import BrandingRuntime from '@/components/BrandingRuntime';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from '@/pages/public/home';
const BookingManage = lazy(() => import('@/pages/public/booking-manage'));
const Login = lazy(() => import('@/pages/staff/login'));
const StaffDashboardLayout = lazy(() => import('@/pages/staff/dashboard/layout'));
const Welcome = lazy(() => import('@/pages/staff/dashboard/welcome'));
const Bookings = lazy(() => import('@/pages/staff/dashboard/bookings'));
const CommandCalendar = lazy(() => import('@/pages/staff/dashboard/command-calendar'));
const ForecastLab = lazy(() => import('@/pages/staff/dashboard/forecast-lab'));
const BookingLifecycle = lazy(() => import('@/pages/staff/dashboard/booking-lifecycle'));
const ReleaseControlTower = lazy(() => import('@/pages/staff/dashboard/release-control-tower'));
const AutomationStudio = lazy(() => import('@/pages/staff/dashboard/automation-studio'));
const NotificationMissionControl = lazy(() => import('@/pages/staff/dashboard/notification-mission-control'));
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
const DeliverySettings = lazy(() => import('@/pages/staff/dashboard/delivery-settings'));
const Feedback = lazy(() => import('@/pages/staff/dashboard/feedback'));
const Security = lazy(() => import('@/pages/staff/dashboard/security'));
const PracticeControl = lazy(() => import('@/pages/staff/dashboard/practice-control'));
const HomepageControls = lazy(() => import('@/pages/staff/dashboard/homepage-controls'));
const StaffDirectory = lazy(() => import('@/pages/staff/dashboard/staff-directory'));
const FounderDashboard = lazy(() => import('@/pages/staff/dashboard/founder-dashboard'));
const GlobalSearch = lazy(() => import('@/pages/staff/dashboard/global-search'));
const SystemHealth = lazy(() => import('@/pages/staff/dashboard/system-health'));
const BackupCenter = lazy(() => import('@/pages/staff/dashboard/backup-center'));
const CommandCenter = lazy(() => import('@/pages/staff/dashboard/command-center'));
const HomepagePreview = lazy(() => import('@/pages/staff/dashboard/homepage-preview'));
const PublicUpdates = lazy(() => import('@/pages/public/updates'));
const PublicAssistant = lazy(() => import('@/pages/public/assistant'));
const PublicSupport = lazy(() => import('@/pages/public/support'));
const ClientAuth = lazy(() => import('@/pages/client/auth'));
const ClientPortal = lazy(() => import('@/pages/client/portal'));
const ClientTools = lazy(() => import('@/pages/client/tools'));
const ClientWelcomePackage = lazy(() => import('@/pages/client/welcome-package'));
const UploadPage = lazy(() => import('@/pages/public/upload'));
const AdvancedWorkspace = lazy(() => import('@/pages/staff/dashboard/advanced-workspace'));
const MySettings = lazy(() => import('@/pages/staff/dashboard/my-settings'));
const WebsiteSettings = lazy(() => import('@/pages/staff/dashboard/website-settings'));
const ManagementSettings = lazy(() => import('@/pages/staff/dashboard/management-settings'));
const StaffRequests = lazy(() => import('@/pages/staff/dashboard/staff-requests'));
const Aurora = lazy(() => import('@/pages/staff/dashboard/aurora'));
const StaffPublicSupport = lazy(() => import('@/pages/staff/dashboard/public-support'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function StaffRouter() {
  return (
    <StaffDashboardLayout>
      <Switch>
        <Route path="/staff/dashboard" component={Welcome} />
        <Route path="/staff/welcome" component={Welcome} />
        <Route path="/staff/bookings" component={Bookings} />
        <Route path="/staff/calendar" component={CommandCalendar} />
        <Route path="/staff/forecast" component={ForecastLab} />
        <Route path="/staff/booking-lifecycle" component={BookingLifecycle} />
        <Route path="/staff/release-control" component={ReleaseControlTower} />
        <Route path="/staff/automation-studio" component={AutomationStudio} />
        <Route path="/staff/notification-mission-control" component={NotificationMissionControl} />
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
        <Route path="/staff/delivery-settings" component={DeliverySettings} />
        <Route path="/staff/feedback" component={Feedback} />
        <Route path="/staff/security" component={Security} />
        <Route path="/staff/homepage-preview" component={HomepagePreview} />
        <Route path="/staff/practice-control" component={PracticeControl} />
        <Route path="/staff/homepage-controls" component={HomepageControls} />
        <Route path="/staff/staff-directory" component={StaffDirectory} />
        <Route path="/staff/founder-dashboard" component={FounderDashboard} />
        <Route path="/staff/command-center" component={CommandCenter} />
        <Route path="/staff/search" component={GlobalSearch} />
        <Route path="/staff/system-health" component={SystemHealth} />
        <Route path="/staff/backup" component={BackupCenter} />
        <Route path="/staff/operations" component={AdvancedWorkspace} />
        <Route path="/staff/my-settings" component={MySettings} />
        <Route path="/staff/website-settings" component={WebsiteSettings} />
        <Route path="/staff/management-settings" component={ManagementSettings} />
        <Route path="/staff/requests" component={StaffRequests} />
        <Route path="/staff/aurora" component={Aurora} />
        <Route path="/staff/public-support" component={StaffPublicSupport} />
        <Route path="/staff/settings" component={MySettings} />
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
      <Route path="/support/:token" component={PublicSupport} />
      <Route path="/support" component={PublicSupport} />
      <Route path="/staff" component={Login} />
      <Route path="/staff/login" component={Login} />
      <Route path="/portal/login" component={ClientAuth} />
      <Route path="/portal/tools" component={ClientTools} />
      <Route path="/portal/welcome-package" component={ClientWelcomePackage} />
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
      <BrandingRuntime />
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
