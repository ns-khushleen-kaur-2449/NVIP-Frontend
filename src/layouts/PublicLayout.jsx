import { useContext, useMemo, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '../components/ThemeToggle';
import { ButtonLink } from '../components/primitives';
import NvipLockup from '../components/landing/NvipLockup';
import PublicFooter from '../components/landing/PublicFooter';
import { AuthContext } from '@/lib/AuthContext';
import { ThemeContext } from '@/context/ThemeContext';
import { homePath } from '@/lib/rbac';

// Where a visitor's explicit theme choice is saved: next-themes in the full app (App.js), ThemeContext in predev.
const THEME_KEYS = ['smartsdr-theme', 'nvip_theme'];
function savedThemeChoice() {
  try {
    for (const key of THEME_KEYS) {
      const v = localStorage.getItem(key);
      if (v === 'light' || v === 'dark') return v;
    }
  } catch {
    /* storage blocked: no saved choice */
  }
  return null;
}

/**
 * The public site opens on the white Netsmartz page. The app-wide default theme is dark, so the public pages
 * follow it only once the visitor has picked a theme; the toggle here saves that choice for the whole app.
 */
function usePublicTheme() {
  const app = useContext(ThemeContext);
  const [choice, setChoice] = useState(savedThemeChoice);
  const theme = choice ?? 'light';
  const value = useMemo(() => {
    const setTheme = (next) => {
      setChoice(next);
      app?.setTheme(next);
    };
    return { theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
  }, [app, theme]);
  return value;
}

// `section` links jump to a part of the landing page; they never show as the current page.
const LINKS = [
  { to: '/', label: 'Agents', end: true },
  { to: '/pricing', label: 'Pricing' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/#integrations', label: 'Integrations', section: true },
];

/**
 * Public site shell: a light header (blurred over the cream page) and a navy footer. The header shows the
 * Netsmartz │ NVIP lockup on inner pages only; on `/` the hero leads with the logo instead.
 * `.nv-public` swaps in the public-site tokens (index.css); the workspace keeps its own.
 */
export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  // The real sign-in (lib/AuthContext). Read without useAuth() so the page also renders where no AuthProvider is
  // mounted (the predev route tests); there it is simply signed out.
  const auth = useContext(AuthContext);
  const signedIn = Boolean(auth?.user || auth?.token);
  const workspace = homePath(auth?.user);
  const themeValue = usePublicTheme();

  const linkClass = ({ isActive }) =>
    cn(
      'relative rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition-colors',
      'after:absolute after:inset-x-3.5 after:-bottom-[18px] after:h-0.5 after:rounded-full after:transition-colors',
      isActive
        ? 'text-[var(--nv-chrome-fg)] after:bg-[var(--nv-orange)]'
        : 'text-[var(--nv-chrome-muted)] hover:text-[var(--nv-chrome-fg)] after:bg-transparent',
    );
  const mobileLinkClass = ({ isActive }) =>
    cn('rounded-md py-2 text-base font-medium', isActive ? 'text-[var(--nv-chrome-fg)]' : 'text-[var(--nv-chrome-muted)]');
  const quietLink = 'rounded-md px-1 font-semibold text-[var(--nv-chrome-muted)] transition-colors hover:text-[var(--nv-chrome-fg)]';
  const navItem = (l, className, onClick) =>
    l.section
      ? <Link key={l.to} to={l.to} className={className({ isActive: false })} onClick={onClick}>{l.label}</Link>
      : <NavLink key={l.to} to={l.to} end={l.end} className={className} onClick={onClick}>{l.label}</NavLink>;

  return (
    <ThemeContext.Provider value={themeValue}>
    <div className="nv-public flex min-h-screen flex-col" data-nv-theme={themeValue.theme}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--nv-surface)] focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--nv-chrome-border)] bg-[var(--nv-chrome-bg)] backdrop-blur-xl backdrop-saturate-150">
        <div className="relative mx-auto flex h-[76px] max-w-7xl items-center gap-8 px-4 sm:px-6">
          <NvipLockup onClick={() => setOpen(false)} />
          {/* Centred on the header, independent of what sits left and right of it. */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 xl:flex" aria-label="Main">
            {LINKS.map((l) => navItem(l, linkClass))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 xl:flex">
            <ThemeToggle className="h-10 w-10" />
            <ButtonLink to={signedIn ? workspace : '/login'} variant="secondary">
              {signedIn ? 'Go to workspace' : 'Sign in'}
            </ButtonLink>
            <ButtonLink to="/request-demo" className="shadow-[0_10px_22px_-12px_rgba(254,119,37,0.85)]">
              <Phone className="h-4 w-4" aria-hidden /> Book a demo
            </ButtonLink>
          </div>
          <div className="ml-auto flex items-center gap-2 xl:hidden">
            <ThemeToggle className="h-10 w-10" />
            <ButtonLink to="/request-demo" className="hidden sm:inline-flex" onClick={() => setOpen(false)}>
              <Phone className="h-4 w-4" aria-hidden /> Book a demo
            </ButtonLink>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg text-[var(--nv-chrome-fg)] hover:bg-[var(--nv-chrome-hover)]"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu: slides open by animating its row height */}
        <div
          id="public-mobile-menu"
          className={cn(
            'grid xl:hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          inert={!open}
        >
          <div className="overflow-hidden">
            <nav className="flex flex-col gap-2 border-t border-[var(--nv-chrome-border)] px-4 py-4" aria-label="Main">
              {LINKS.map((l) => navItem(l, mobileLinkClass, () => setOpen(false)))}
              <Link to={signedIn ? workspace : '/login'} className={cn(quietLink, 'px-0 py-2')} onClick={() => setOpen(false)}>
                {signedIn ? 'Go to workspace' : 'Sign in'}
              </Link>
              <ButtonLink to="/request-demo" size="lg" className="mt-2" onClick={() => setOpen(false)}>
                <Phone className="h-4 w-4" aria-hidden /> Book a demo
              </ButtonLink>
            </nav>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <PublicFooter signedIn={signedIn} workspace={workspace} />
    </div>
    </ThemeContext.Provider>
  );
}
