import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Sparkles,  PhoneCall, Inbox as InboxIcon, CalendarClock, Package,
  Layers, Phone, Mic, UploadCloud, Megaphone, ClipboardCheck, Bot,
  ChevronDown, ChevronLeft, ChevronRight, Settings, LogOut, GitCompareArrows, ShieldCheck, Crown, BarChart3,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getBillingSubscription } from '@/lib/api';
import { BILLING_CHANGED } from '@/components/billing/billingUi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandLockup, { NetsmartzMark } from '@/components/shared/BrandLockup';
import {
  canManageBilling, canUseAdmin, canViewAssistants, canViewOperations, featureEnabled, featureOn, hasPermission,
  isSharedMode, PERMISSIONS, voiceTabEnabled,
} from '@/lib/rbac';

const APP_NAV = [
  { path: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  // The agents this organisation may use (the backend filters the list). Shown only with agents.view, the
  // permission the /agents route requires; otherwise the link would lead straight to the 403 page.
  { path: '/agents',      label: 'Agents',       icon: Bot,
    requires: (user) => hasPermission(user, PERMISSIONS.AGENTS_VIEW) },
];

// Secondary surfaces, listed below Voice Agent.
const PENDING_NAV = [
  // Operations: appointments for everyone; callbacks, do-not-call and intent review only for
  // Tenant Admins and Managers (pages/Operations.jsx gates each tab).
  { path: '/operations',  label: 'Operations',   icon: ClipboardCheck,
    requires: (user) => canViewOperations(user) || featureEnabled(user, 'appointment_booking') },
  { path: '/prospecting', label: 'Prospecting',  icon: Users },
  { path: '/conversion',  label: 'Conversion',   icon: GitCompareArrows },
  // Hidden from the menu for now; the /strategist page and route still work.
  // { path: '/strategist',  label: 'AI Strategist', icon: Sparkles },
  { path: '/inbox',       label: 'Inbox',        icon: InboxIcon },
  { path: '/catalog',     label: 'Catalog',      icon: Package, requires: (user) => featureEnabled(user, 'product_catalog') },
  { path: '/meetings',    label: 'Meetings',     icon: CalendarClock },
  { path: '/reports',     label: 'Reports & Analytics', icon: BarChart3 },
];

// Voice Agent's own internal views — reached as /voice_agent?tab=<id>, read by
// VoiceAgent.js's existing searchParams-sync effect.
const VOICE_TABS = [
  { id: 'builder',  label: 'Lead-to-Campaign Builder', icon: Layers },
  { id: 'logs',      label: 'Call Logs',                icon: Phone },
  { id: 'csv',       label: 'CSV Call Campaign',        icon: UploadCloud },
  // Its own route rather than a ?tab= view, so it carries `path`. The render
  // below falls back to the ?tab= form for every entry without one.
  { id: 'campaigns', label: 'Voice Campaigns',          icon: Megaphone, path: '/voice-campaigns' },
  { id: 'single',    label: 'Single Call',              icon: PhoneCall },
  // Assistant Requests — hidden from the nav for now (the page and its links from notifications still work).
  // Sales Reps propose assistant changes there; Managers and Tenant Admins review them. Restore this line and
  // the canUseAssistantRequests import from '@/lib/rbac' to bring it back.
  // { id: 'requests',  label: 'Assistant Requests',       icon: ClipboardCheck, requires: canUseAssistantRequests },
];

// Report Agent views — hidden from the nav for now. Restore this array, the
// reportOpen state, onReportAgent, the JSX group below, and the
// ClipboardList/BarChart2/Table2/Sliders icon imports to bring the section back.
// const REPORT_TABS = [
//   { path: '/manager-dashboard',            label: 'Team Overview', icon: LayoutDashboard, roles: ['agent', 'manager', 'admin'] },
//   { path: '/call-quality',                 label: 'Call Quality',  icon: BarChart2,       roles: ['agent', 'manager', 'admin'] },
//   { path: '/call-quality?view=analytics',  label: 'Analytics',     icon: Activity,        roles: ['agent', 'manager', 'admin'] },
//   { path: '/audio-upload',                 label: 'Audio Upload',  icon: Mic,             roles: ['agent', 'manager', 'admin'] },
//   { path: '/sheets-sync',                  label: 'Sheets Sync',   icon: Table2,          roles: ['manager', 'admin'] },
//   { path: '/weight-config',                label: 'Score Weights', icon: Sliders,         roles: ['admin'] },
// ];

// Colours live in index.css (.nvw-item): the active item is an orange pill with a navy label, as on the
// public NVIP site. NavLinks are styled active through aria-current, plain Links through data-active.
const itemClass = (_isActive, collapsed) => cn(
  'nvw-item group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] font-medium transition-all duration-200',
  collapsed && 'justify-center px-2'
);

const iconClass = () => 'nvw-icon h-[18px] w-[18px] shrink-0';

const activeAttr = (isActive) => (isActive ? 'true' : undefined);

/** Up to two initials from the signed-in user's name or email, for the avatar. */
function initialsOf(user) {
  const source = (user?.name || user?.full_name || user?.email || '').split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

const ROLE_LABELS = {
  tenant_admin: 'Tenant Admin', super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager',
  agent: 'Sales Rep', sales_rep: 'Sales Rep',
};

// Phone width: start collapsed (icons only) so the page keeps the screen.
const startCollapsed = () => Boolean(window.matchMedia?.('(max-width: 767px)').matches);

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  // Voice Agent is the primary surface, so its sub-list starts expanded.
  const [voiceOpen, setVoiceOpen] = useState(true);
  // const [reportOpen, setReportOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const agentInstancesMode = featureOn(user, 'agent_instances');

  // The organisation's current plan, shown above Logout for its Tenant Admin. Re-read when they leave the
  // billing page, so a plan they just bought shows without a reload. A failure only hides the label.
  const [plan, setPlan] = useState(null);
  const billingAdmin = canManageBilling(user);
  const onBilling = location.pathname.startsWith('/billing');
  useEffect(() => {
    if (!billingAdmin) return undefined;
    let stopped = false;
    Promise.resolve(getBillingSubscription())
      .then(({ data }) => { if (!stopped) setPlan({ key: data.plan, name: data.plan_name }); })
      .catch(() => { if (!stopped) setPlan(null); });
    return () => { stopped = true; };
  }, [billingAdmin, onBilling]);
  useEffect(() => {
    if (!billingAdmin) return undefined;
    const update = (e) => setPlan(e.detail);
    window.addEventListener(BILLING_CHANGED, update);
    return () => window.removeEventListener(BILLING_CHANGED, update);
  }, [billingAdmin]);

  // On a short window the menu scrolls; keep the current page's item in view instead of half cut off at the edge.
  const asideRef = useRef(null);
  useEffect(() => {
    const viewport = asideRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return undefined;
    const reveal = () => {
      const active = viewport.querySelector('[data-active="true"], [aria-current="page"]');
      if (!active) return;
      const box = viewport.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      if (item.bottom > box.bottom) viewport.scrollTop += item.bottom - box.bottom + 12;
      else if (item.top < box.top) viewport.scrollTop -= box.top - item.top + 12;
    };
    reveal();
    // Things load after the first paint: groups (Voice Agent) open and push items down, and the plan line under the menu
    // shrinks the scroll box. Check again whenever either resizes, for the first few seconds after a navigation only,
    // so it never fights the user's own scrolling.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reveal) : null;
    if (observer) {
      observer.observe(viewport);
      if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    }
    const stop = setTimeout(() => observer?.disconnect(), 3000);
    return () => { clearTimeout(stop); observer?.disconnect(); };
  }, [location.pathname, location.search, user]);
  const topPlan = plan?.key === 'pro_plus';

  const params = new URLSearchParams(location.search);
  const onVoiceAgent = location.pathname.startsWith('/voice_agent');
  // const onReportAgent = REPORT_TABS.some(
  //   (t) => location.pathname === t.path.split('?')[0]
  // );
  // With no ?tab=, VoiceAgent shows the campaign builder.
  const currentTab = onVoiceAgent ? (params.get('tab') || (params.get('view') === 'logs' ? 'logs' : 'builder')) : null;
  const newModeNav = [
    ...APP_NAV,
    { path: '/voice-campaigns', label: 'Campaigns', icon: Megaphone },
    { path: '/prospects', label: 'Prospects', icon: Users },
    { path: '/catalog', label: 'Product catalog', icon: Package, requires: () => featureEnabled(user, 'product_catalog') },
    // While shared assistants are off, calls still use the Assistant builder's configuration.
    { path: '/voice_agent?tab=create', label: 'Assistant builder', icon: Mic,
      requires: () => canViewAssistants(user) && !isSharedMode(user) },
    { path: '/call-logs', label: 'Call logs', icon: Phone },
    { path: '/single-call', label: 'Single call', icon: PhoneCall },
    { path: '/inbox', label: 'Inbox', icon: InboxIcon },
    { path: '/meetings', label: 'Meetings', icon: CalendarClock },
    ...PENDING_NAV.filter((item) => item.path === '/operations' && (!item.requires || item.requires(user))),
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        ref={asideRef}
        className={cn(
          'mk nvw-sidebar flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200',
          collapsed ? 'w-[76px]' : 'w-[272px]'
        )}
      >
        <div className={cn('nvw-divider flex h-16 shrink-0 items-center border-b', collapsed ? 'justify-center px-2' : 'px-5')}>
          {/* The logo is only a brand mark: it does not navigate anywhere. */}
          <div role="img" aria-label="NVIP by Netsmartz" className={cn('flex items-center', !collapsed && 'w-full')}>
            {collapsed
              ? <NetsmartzMark size={30} />
              : <BrandLockup size="side" className="text-[var(--nvw-side-ink)]" />}
          </div>
        </div>

        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="flex flex-col gap-1">
            {!collapsed && <p className="nvw-label pb-1.5 pt-1">Workspace</p>}
            {(agentInstancesMode ? newModeNav : APP_NAV).filter((item) => !item.requires || item.requires(user)).map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              const link = (
                <Link key={item.path} to={item.path} aria-label={collapsed ? item.label : undefined} data-active={activeAttr(isActive)} className={itemClass(isActive, collapsed)}>
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}

            {!agentInstancesMode && <>{/* Voice Agent — expandable group, part of the same list (no separator).
                Purely a toggle: it does not navigate anywhere by itself, it just
                opens/closes the sub-list below. */}
            {!collapsed && <p className="nvw-label pb-1.5 pt-4">Voice</p>}
            <button
              type="button"
              onClick={() => setVoiceOpen((v) => !v)}
              data-parent-active={activeAttr(onVoiceAgent)}
              className={cn(itemClass(onVoiceAgent, collapsed), 'w-full')}
              title="Voice Agent"
              aria-label="Voice Agent"
              aria-expanded={voiceOpen}
            >
              <PhoneCall className={iconClass(onVoiceAgent)} />
              {!collapsed && <span className="flex-1 text-left">Voice Agent</span>}
              {!collapsed && (
                <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', voiceOpen ? 'rotate-180' : '')} />
              )}
            </button>

            {(voiceOpen || collapsed) && (
              <div className={collapsed ? 'flex flex-col gap-1' : 'nvw-rail pl-6 flex flex-col gap-0.5'}>
                {VOICE_TABS.filter((tab) => (!tab.requires || tab.requires(user)) && voiceTabEnabled(user, tab.id)).map((tab) => {
                  const isActive = tab.path
                    ? location.pathname.startsWith(tab.path)
                    : onVoiceAgent && currentTab === tab.id;
                  const Icon = tab.icon;
                  const link = (
                    <Link key={tab.id} to={tab.path || `/voice_agent?tab=${tab.id}`} aria-label={collapsed ? tab.label : undefined} data-active={activeAttr(isActive)} className={cn(itemClass(isActive, collapsed), !collapsed && 'py-2 text-[0.86rem]')}>
                      <Icon className={iconClass(isActive)} />
                      {!collapsed && <span>{tab.label}</span>}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            )}

            {/* Report Agent — hidden for now; same expandable pattern as Voice Agent above.
            <button
              onClick={() => setReportOpen((v) => !v)}
              className={cn(itemClass(onReportAgent, collapsed), 'w-full')}
              title="Report Agent"
            >
              <ClipboardList className={iconClass(onReportAgent)} />
              {!collapsed && <span className="flex-1 text-left">Report Agent</span>}
              {!collapsed && (
                <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-200', reportOpen ? 'rotate-180' : '')} />
              )}
            </button>

            {(reportOpen || collapsed) && (
              <div className={collapsed ? 'flex flex-col gap-1' : 'nvw-rail pl-6 flex flex-col gap-0.5'}>
                {REPORT_TABS.filter((tab) => !user || tab.roles.includes(user.role)).map((tab) => {
                  const [tabPath, tabQuery] = tab.path.split('?');
                  const isActive = tabQuery
                    ? location.pathname === tabPath && location.search.includes(tabQuery)
                    : location.pathname === tabPath && !location.search.includes('view=');
                  const Icon = tab.icon;
                  const link = (
                    <Link key={tab.path} to={tab.path} className={itemClass(isActive, collapsed)}>
                      <Icon className={iconClass(isActive)} />
                      {!collapsed && <span>{tab.label}</span>}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={tab.path}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            )}
            */}

            {!collapsed && PENDING_NAV.some((item) => !item.requires || item.requires(user)) && <p className="nvw-label pb-1.5 pt-4">Pipeline</p>}
            {PENDING_NAV.filter((item) => !item.requires || item.requires(user)).map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              const Icon = item.icon;
              const link = (
                <Link key={item.path} to={item.path} aria-label={collapsed ? item.label : undefined} data-active={activeAttr(isActive)} className={itemClass(isActive, collapsed)}>
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}</>}
          </nav>
        </ScrollArea>

        <div className="nvw-divider border-t px-3 py-3 space-y-1.5 shrink-0">
          {/* Admin — hidden for now.
          {hasRole('admin', 'manager') && (
            <Link to="/admin" className={itemClass(false, collapsed)}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--mist)] group-hover:text-[var(--pine)]" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
          */}
          {/* Users, Teams and Tenants open from Settings → General → Administration (lib/adminNav.js), not from here. */}
          <NavLink to="/settings" aria-label={collapsed ? 'Settings' : undefined} className={({ isActive }) => itemClass(isActive, collapsed)}>
            <Settings className={iconClass()} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          {/* Who is signed in, with the theme switch. */}
          <div className={cn('nvw-user flex items-center gap-2.5 rounded-2xl', collapsed ? 'flex-col p-1.5' : 'p-2.5')}>
            <span aria-hidden="true" className="nvw-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.78rem] font-bold">
              {initialsOf(user)}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.8rem] font-semibold text-[var(--nvw-side-ink)]" title={user?.email}>
                  {user?.name || user?.full_name || user?.email?.split('@')[0] || 'Signed in'}
                </span>
                {user?.email && <span className="block truncate text-[0.7rem] text-[var(--nvw-side-muted)]">{ROLE_LABELS[user?.role] || user.email}</span>}
              </span>
            )}
            <ThemeToggle className="h-8 w-8 shrink-0 border-[var(--nvw-side-line)] bg-[var(--nvw-raised)]" />
          </div>
          {/* Upgrade Plan — the organisation's subscription; only its Tenant Admin sees it. Sits just above Logout. */}
          {billingAdmin && plan && !collapsed && (
            <p data-testid="current-plan" className="px-3 pt-1.5 text-xs text-[var(--nvw-side-muted)]">
              You are on the <span className="font-semibold text-[var(--nvw-orange-text)]">{plan.name}</span> plan
            </p>
          )}
          {billingAdmin && (
            <NavLink
              to="/billing"
              aria-label={collapsed ? (topPlan ? 'Manage Plan' : 'Upgrade Plan') : undefined}
              title={collapsed ? (topPlan ? `${plan.name} plan` : plan ? `${plan.name} plan - upgrade` : 'Upgrade Plan') : undefined}
              className={cn(
                'nvw-upgrade group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                collapsed && 'justify-center px-2'
              )}
            >
              <Crown className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
              {!collapsed && <span className="flex-1">{topPlan ? 'Manage Plan' : 'Upgrade Plan'}</span>}
              {!collapsed && <ChevronRight className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5" />}
            </NavLink>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Logout' : undefined}
            onClick={logout}
            className={cn(itemClass(false, collapsed), 'w-full')}
          >
            <LogOut className={iconClass()} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button
          type="button"
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          onClick={() => setCollapsed((v) => !v)}
          className="nvw-divider nvw-item flex items-center justify-center py-2.5 border-t transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}

export default Sidebar;
