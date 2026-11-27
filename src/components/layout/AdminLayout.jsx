import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, ShieldCheck } from 'lucide-react';
import BrandLockup, { NetsmartzMark } from '@/components/shared/BrandLockup';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { PLATFORM_NAV, visibleNavItems } from '@/lib/adminNav';
import ThemeToggle from '@/components/shared/ThemeToggle';

const itemClass = ({ isActive }, collapsed = false) => cn(
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
  collapsed && 'md:justify-center md:px-2',
  isActive ? 'bg-[var(--pine)] text-white' : 'text-[var(--mist)] hover:text-[var(--ink)] hover:bg-[var(--stone)]',
);

/**
 * The platform control area's own shell (/admin/*): a sidebar with only the platform pages
 * (lib/adminNav.js PLATFORM_NAV), kept apart from the tenant app and its Settings. On a phone the
 * sidebar becomes a row of links above the page. From md up it can be collapsed to icons only,
 * like the tenant app's sidebar (components/layout/Sidebar.js); collapsed links keep their name as
 * the accessible label and a hover title.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const items = visibleNavItems(user, PLATFORM_NAV);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background" data-testid="admin-layout">
      <aside className={cn(
        'mk shrink-0 md:h-screen md:sticky md:top-0 flex flex-col bg-[var(--paper)] border-b md:border-b-0 md:border-r border-[var(--line)] transition-[width] duration-200',
        collapsed ? 'md:w-[76px]' : 'md:w-[240px]',
      )}>
        <div role="img" aria-label="NVIP by Netsmartz"
          className={cn('flex h-16 items-center px-4 md:border-b border-[var(--line)]', collapsed && 'md:justify-center md:px-2')}>
          {collapsed ? (
            <>
              <BrandLockup size="side" className="text-[var(--ink)] md:hidden" />
              <NetsmartzMark size={30} className="hidden md:block" />
            </>
          ) : <BrandLockup size="side" className="text-[var(--ink)]" />}
        </div>
        <p className={cn('flex items-center gap-2 px-5 pt-3 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--mist)]', collapsed && 'md:hidden')}>
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--pine)]" aria-hidden="true" />
          Platform admin · Super Admin
        </p>

        <nav aria-label="Platform admin" className="flex md:flex-col gap-1 px-3 pb-3 md:py-3 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:flex-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={(state) => itemClass(state, collapsed)}
                aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined}>
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-[var(--mist)] group-hover:text-[var(--pine)]')} />
                    <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden md:block border-t border-[var(--line)] px-3 py-3 space-y-1">
          <div className={cn('flex items-center gap-2 px-1 pt-1', collapsed ? 'justify-center' : 'justify-between')}>
            {user?.email && !collapsed && <span className="text-xs text-[var(--mist)] truncate">{user.email}</span>}
            <ThemeToggle className="h-8 w-8 shrink-0" />
          </div>
          <button type="button" onClick={logout} aria-label={collapsed ? 'Logout' : undefined} title={collapsed ? 'Logout' : undefined}
            className={cn(itemClass({ isActive: false }, collapsed), 'w-full')}>
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button
          type="button"
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:flex shrink-0 items-center justify-center border-t border-[var(--line)] py-2.5 text-[var(--mist)] transition-colors hover:bg-[var(--stone)] hover:text-[var(--ink)]"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-end gap-2 px-4 pt-3">
          <ThemeToggle className="h-8 w-8" />
          <button type="button" onClick={logout} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
