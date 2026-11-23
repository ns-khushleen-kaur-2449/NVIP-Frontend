import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { TopBar } from "@/components/layout/TopBar";
import { ExecSidebar } from "@/components/layout/ExecSidebar";
import { Sidebar } from "@/components/layout/Sidebar";
import SidebarTopBar from "@/components/layout/SidebarTopBar";
import DashboardPage from "@/pages/Dashboard";
import LeadsPage from "@/pages/Leads";
import ResearchPage from "@/pages/Research";
import LegacyReportsPage from "@/pages/Reports";
// import CallsPage from "@/pages/Calls";
import PropertiesPage from "@/pages/Properties";
import SettingsPage from "@/pages/Settings";
import LoginPage from "@/pages/Login";
import InviteAcceptPage from "@/pages/InviteAccept";
import AgentRunsPage from "@/pages/AgentRuns";
import VoiceCampaigns from "@/components/voice/VoiceCampaigns";
import VoiceCampaignDetail from "@/components/voice/VoiceCampaignDetail";
// NVIP public marketplace (the agent cards from predev). The SmartSDR LandingPage is no longer the home page;
// the file is kept (pages/LandingPage.js).
import PublicLayout from "@/layouts/PublicLayout";
import AgentCatalog from "@/pages/public/AgentCatalog";
import AgentDetail from "@/pages/public/AgentDetail";
import PricingPage from "@/pages/public/Pricing";
import HowItWorks from "@/pages/public/HowItWorks";
import RequestAccess from "@/pages/public/RequestAccess";
import { NextThemesBridge } from "@/context/ThemeContext";
import MarketplaceListingsPage from "@/pages/MarketplaceListings";
import MarketplaceDetailsPage from "@/pages/MarketplaceDetails";
// import AdminDashboardPage from "@/pages/AdminDashboard";
import AudioUploadPage from "@/pages/AudioUpload";
import CallQualityDashboard from "@/pages/CallQualityDashboard";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ProjectsPage from "@/pages/Projects";
// import AgentPerformancePage from "@/pages/AgentPerformance";
import GoogleSheetsSyncPage from "@/pages/GoogleSheetsSync";
import WeightConfigPage from "@/pages/WeightConfig";
import KnowledgeBasePage from "@/pages/KnowledgeBase";
// import ChatWidget from "@/components/shared/ChatWidget";
import ProspectingPage from "@/pages/Prospecting";
import ConversionWorkspace from "@/pages/ConversionWorkspace";
import BillingPage from "@/pages/Billing";
import StrategistPage from "@/pages/Strategist";
import ForbiddenPage from "@/pages/Forbidden";
import UsersAdminPage from "@/pages/admin/Users";
import TeamsAdminPage from "@/pages/admin/Teams";
import AgentsPage from "@/pages/Agents";
import AgentConfigPage from "@/pages/agentConfig/AgentConfigPage";
import CampaignBuilderPage from "@/pages/campaignBuilder/CampaignBuilderPage";
import { HiringRoute } from "@/pages/hiring/HiringAgent";
import { RealEstateRoute } from "@/pages/realEstate/RealEstateAgent";
import RequirePermission from "@/components/auth/RequirePermission";
import { CAMPAIGN_FEATURES, PERMISSIONS, homePath } from "@/lib/rbac";
import FeatureRoute from "@/components/auth/FeatureRoute";
import FeatureLossWatcher from "@/components/auth/FeatureLossWatcher";
import AuthGate from "@/components/auth/AuthGate";
import StepUpDialog from "@/components/auth/StepUpDialog";
import InboxPage from "@/pages/Inbox";
import CatalogPage from "@/pages/Catalog";
import RoleDashboard from "@/pages/RoleDashboard";
import { ReportsPage } from "@/pages/RoleAnalytics";
import MeetingsPage from "@/pages/Meetings";
import { operationsRoutes } from "@/pages/Operations";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { SuperAdminBoundary, SuperAdminGoesTo } from "@/components/auth/SuperAdminRoute";
import { adminRoutes } from "@/pages/admin/adminRoutes";
import { featureOn } from "@/lib/rbac";
import { ModeRedirect, OldCampaignRouteRedirect, VoiceAgentModeRedirect } from "@/components/auth/ModeRoutes";
import CallLogsList from "@/components/voice/CallLogsList";
import ProspectsHub from "@/pages/ProspectsHub";
import SingleCallPage from "@/pages/SingleCallPage";

// The backend's roles (lib/rbac.js).  Older routes said "admin", a role that never existed.
const ADMINS = ['super_admin', 'tenant_admin'];
const ADMINS_AND_MANAGERS = ['super_admin', 'tenant_admin', 'manager'];

/** The Knowledge Base: legacy mode only; hidden in NEW MODE (sent to the Agents page). */
function KnowledgeBaseRoute() {
  const { user } = useAuth();
  if (featureOn(user, 'agent_instances')) return <Navigate to="/agents" replace />;
  return <ExecAppShell><ProtectedRoute roles={ADMINS}><KnowledgeBasePage /></ProtectedRoute></ExecAppShell>;
}

/** Shows the NVIP agent catalog (cards) for guests; redirects logged-in users home (/admin/overview for a Super Admin, else /dashboard) */
function SmartRoot() {
  const { user, token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (user || token) return <Navigate to={homePath(user)} replace />;
  return <AgentCatalog />;
}

// Pages that get the persistent left Sidebar instead of the TopBar. Everything
// else in AppShell keeps the TopBar exactly as before.
const SIDEBAR_SECTION_PATHS = ['/dashboard', '/prospecting', '/conversion', '/strategist', '/inbox', '/catalog', '/meetings', '/settings',
  '/operations', '/leads', '/billing', '/reports', '/agents'];

function AppShell() {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  const useSidebar = SIDEBAR_SECTION_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );
  // An agent's setup (/agents/sdr_outbound) is a full-screen editor with its own steps column: no app sidebar or top bar.
  const fullScreen = /^\/agents\/[^/]+\/?$/.test(location.pathname);

  const routes = (
    <Routes>
      <Route path="/dashboard" element={<RoleDashboard />} />
      <Route path="/welcome" element={<DashboardPage />} />
      <Route path="/leads" element={<ModeRedirect instancesTo="/prospects"><LeadsPage /></ModeRedirect>} />
      <Route path="/research" element={
        <ProtectedRoute roles={ADMINS_AND_MANAGERS}><ResearchPage /></ProtectedRoute>
      } />
      {/* Reports & Analytics for every role; the backend scopes the data. The previous Reports page is kept at /reports/legacy. */}
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/reports/legacy" element={
        <ProtectedRoute roles={ADMINS_AND_MANAGERS}><LegacyReportsPage /></ProtectedRoute>
      } />
      <Route path="/properties" element={<PropertiesPage />} />
      <Route path="/agent-runs" element={
        <ProtectedRoute roles={ADMINS_AND_MANAGERS}><AgentRunsPage /></ProtectedRoute>
      } />
      <Route path="/prospecting" element={<ModeRedirect instancesTo="/prospects"><ProspectingPage /></ModeRedirect>} />
      <Route path="/conversion" element={<ConversionWorkspace />} />
      <Route path="/billing" element={<ProtectedRoute roles={['tenant_admin']}><BillingPage /></ProtectedRoute>} />
      <Route path="/strategist" element={<StrategistPage />} />
      {/* The SDR Campaigns pages are hidden for now; Voice Campaigns is the campaign page. */}
      <Route path="/campaigns/*" element={<OldCampaignRouteRedirect />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/catalog" element={<FeatureRoute features={["product_catalog"]} name="Catalog"><CatalogPage /></FeatureRoute>} />
      <Route path="/meetings" element={<MeetingsPage />} />
      {/* Appointments, callbacks, do-not-call and intent review (old /appointments, /callbacks and /do-not-call redirect). */}
      {operationsRoutes()}
      <Route path="/403" element={<ForbiddenPage />} />
      {/* A Super Admin manages tenants and their users in the platform area (/admin/tenants, /admin/tenant-users). */}
      <Route path="/settings/users" element={
        <SuperAdminGoesTo to="/admin/tenant-users"><RequirePermission perm={PERMISSIONS.USERS_VIEW}><UsersAdminPage /></RequirePermission></SuperAdminGoesTo>
      } />
      <Route path="/settings/teams" element={<RequirePermission perm={PERMISSIONS.TEAMS_MANAGE}><TeamsAdminPage /></RequirePermission>} />
      <Route path="/settings/tenants" element={<Navigate to="/admin/tenants" replace />} />
      {/* The agent catalog moved into the platform area with the rest of the Super Admin's pages. */}
      <Route path="/settings/agents" element={<Navigate to="/admin/agent-catalog" replace />} />
      <Route path="/agents" element={<RequirePermission perm={PERMISSIONS.AGENTS_VIEW}><AgentsPage /></RequirePermission>} />
      {/* An agent type's configuration (agent instances): /agents/sdr_outbound, /agents/sdr_inbound. The page checks the
          agent_instances feature and the role; lib/agents.js AGENT_ROUTES sends Inbound SDR here. */}
      <Route path="/agents/:agentType" element={<RequirePermission perm={PERMISSIONS.AGENTS_VIEW}><AgentConfigPage /></RequirePermission>} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/calendar" element={<SettingsPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );

  if (fullScreen) {
    return <div className="min-h-screen bg-background">{routes}</div>;
  }

  if (useSidebar) {
    return (
      <div className="app-shell-row">
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <SidebarTopBar />
          <div className="page-content">{routes}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="page-content">{routes}</div>
    </div>
  );
}

function ExecAppShell({ children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="flex bg-background" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="p-3 shrink-0">
          <ExecSidebar />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="page-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// The main sidebar shell: TopBar-less, renders <Sidebar /> beside the page.
// Used by Voice Agent and Report Agent alike so following a link between them
// does not swap the chrome out from under the user.
function SidebarShell({ children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell-row bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-y-auto">
        <SidebarTopBar />
        <div className="page-content bg-background">
          {children}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="smartsdr-theme">
    <NextThemesBridge>
    <BrowserRouter>
      <AuthProvider>
        {/* A Super Admin switch change seen by the /me refresh: leave a page that is no longer allowed (F-02). */}
        <FeatureLossWatcher />
        <AuthGate>
        <SuperAdminBoundary>
        <Routes>
          {/* NVIP public pages (predev cards). /marketplace/:slug, not /agents/:slug: /agents/:agentType is an
              agent's configuration in the app. A card's "In your workspace" panel leads signed-in users to /agents. */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<SmartRoot />} />
            <Route path="/marketplace/:slug" element={<AgentDetail />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/request-demo" element={<RequestAccess kind="demo" />} />
            <Route path="/request-quote" element={<RequestAccess kind="quote" />} />
          </Route>
          {/* predev's mock sign-in is replaced by the real one. */}
          <Route path="/signin" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Public: an invite link (no sign-in); the page keeps the token out of any Referer. */}
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/marketplace" element={<Navigate to="/" replace />} />
          <Route path="/marketplace/listings" element={<MarketplaceListingsPage />} />
          <Route path="/marketplace/listings/:id" element={<MarketplaceDetailsPage />} />
          {/* The platform control area (Super Admin only), with its own layout. The old AdminDashboard page stays unmounted. */}
          {adminRoutes()}
          <Route path="/projects" element={<ExecAppShell><ProjectsPage /></ExecAppShell>} />
          <Route path="/audio-upload" element={<SidebarShell><AudioUploadPage /></SidebarShell>} />
          <Route path="/call-quality" element={<SidebarShell><CallQualityDashboard /></SidebarShell>} />
          <Route path="/manager-dashboard" element={<SidebarShell><ManagerDashboard /></SidebarShell>} />
          {/* <Route path="/agent-performance" element={<ExecAppShell><ProtectedRoute roles={ADMINS_AND_MANAGERS}><AgentPerformancePage /></ProtectedRoute></ExecAppShell>} /> */}
          <Route path="/sheets-sync" element={<SidebarShell><ProtectedRoute roles={ADMINS_AND_MANAGERS}><GoogleSheetsSyncPage /></ProtectedRoute></SidebarShell>} />
          <Route path="/weight-config" element={<SidebarShell><ProtectedRoute roles={ADMINS}><WeightConfigPage /></ProtectedRoute></SidebarShell>} />
          <Route path="/knowledge-base" element={<KnowledgeBaseRoute />} />

          <Route path="/voice_agent" element={<SidebarShell><VoiceAgentModeRedirect /></SidebarShell>} />
          {/* The Hiring agent (AGENT_ROUTES.hiring): tenant users with hiring.view; the page checks the agent is available. */}
          <Route path="/hiring_agent/*" element={<SidebarShell><HiringRoute /></SidebarShell>} />
          {/* The Real Estate agent (AGENT_ROUTES.real_estate): tenant users with real_estate.view; the page checks the agent is available. */}
          <Route path="/real_estate_agent/*" element={<SidebarShell><RealEstateRoute /></SidebarShell>} />
          <Route path="/voice-campaigns" element={<SidebarShell><FeatureRoute features={CAMPAIGN_FEATURES} name="Voice campaigns"><VoiceCampaigns /></FeatureRoute></SidebarShell>} />
          <Route path="/voice-campaigns/new" element={<SidebarShell><FeatureRoute features={CAMPAIGN_FEATURES} name="Voice campaigns"><CampaignBuilderPage /></FeatureRoute></SidebarShell>} />
          <Route path="/voice-campaigns/:campaignId" element={<SidebarShell><FeatureRoute features={CAMPAIGN_FEATURES} name="Voice campaigns"><VoiceCampaignDetail /></FeatureRoute></SidebarShell>} />
          <Route path="/prospects" element={<SidebarShell><ModeRedirect legacyTo="/prospecting"><ProspectsHub /></ModeRedirect></SidebarShell>} />
          <Route path="/call-logs" element={<SidebarShell><ModeRedirect legacyTo="/voice_agent?tab=logs"><CallLogsList /></ModeRedirect></SidebarShell>} />
          <Route path="/single-call" element={<SidebarShell><ModeRedirect legacyTo="/voice_agent?tab=single"><SingleCallPage /></ModeRedirect></SidebarShell>} />
          {/* <Route path="/calls" element={<SidebarShell><CallsPage /></SidebarShell>} /> */}
          <Route path="/*" element={<AppShell />} />
        </Routes>
        </SuperAdminBoundary>
        </AuthGate>
        {/* <AuthedChatWidget /> */}
      </AuthProvider>

      <StepUpDialog />
      <Toaster position="bottom-right" />
    </BrowserRouter>
    </NextThemesBridge>
    </ThemeProvider>
  );
}

// Chatbot launcher — hidden for now. Restore this plus the ChatWidget import
// and the <AuthedChatWidget /> render above to bring it back.
// function AuthedChatWidget() {
//   const { user, token } = useAuth();
//   if (!user && !token) return null;
//   return <ChatWidget />;
// }

export default App;
