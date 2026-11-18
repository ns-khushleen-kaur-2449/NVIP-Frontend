import { useContext, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '../components/ThemeToggle';
import { AuthContext } from '@/lib/AuthContext';
import { NetsmartzLogo } from '@/components/shared/BrandLockup';
import { homePath } from '@/lib/rbac';

// Sections of the landing page (pages/public/AgentCatalog.jsx); from another public page they open the home page there.
const LINKS = [
  { hash: '#agents', label: 'Agents' },
  { hash: '#how-it-works', label: 'How it works' },
  { hash: '#trust', label: 'Trust & security' },
];

/** netsmartz | NVIP, as in the landing design. */
export function PublicLogo({ className }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)} aria-label="NVIP by netsmartz, home">
      {/* The real Netsmartz logo (light and dark versions follow the theme), as on the sign-in page. */}
      <NetsmartzLogo className="h-8 sm:h-9" />
      <span className="h-6 w-px bg-[var(--nv-chrome-border)]" aria-hidden />
      <span className="mk-display text-lg font-semibold text-[var(--nv-orange)]">NVIP</span>
    </Link>
  );
}

export const pillButton = (variant = 'primary') => cn(
  'mk-display inline-flex items-center justify-center rounded-full px-5 h-11 text-[0.95rem] font-semibold transition-colors',
  variant === 'primary' && 'bg-[var(--nv-orange)] text-[#1A0E05] hover:bg-[var(--nv-orange-2)]',
  variant === 'outline' && 'border border-[var(--nv-line)] text-[var(--nv-ink)] hover:border-[var(--nv-orange)]',
  variant === 'dark' && 'bg-[#1A120C] text-white hover:bg-black',
);

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  // The real sign-in (lib/AuthContext). Read without useAuth() so the page also renders where no AuthProvider is
  // mounted (the predev route tests); there it is simply signed out.
  const auth = useContext(AuthContext);
  const signedIn = Boolean(auth?.user || auth?.token);
  const workspace = homePath(auth?.user);
  const navLink = 'mk-display font-medium text-[var(--nv-chrome-muted)] transition-colors hover:text-[var(--nv-chrome-fg)]';
  const account = signedIn
    ? <Link to={workspace} className={navLink}>Go to workspace</Link>
    : <Link to="/login" className={navLink}>Sign in</Link>;

  return (
    <div className="nv-public min-h-screen flex flex-col bg-[var(--nv-bg)] text-[var(--nv-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--nv-chrome-border)] bg-[var(--nv-chrome-bg)]/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-[5.25rem] flex items-center gap-8">
          <PublicLogo />
          <nav className="hidden md:flex flex-1 items-center justify-center gap-7" aria-label="Main">
            {LINKS.map((l) => <Link key={l.hash} to={{ pathname: '/', hash: l.hash }} className={navLink}>{l.label}</Link>)}
          </nav>
          <div className="ml-auto hidden md:flex items-center gap-4">
            <ThemeToggle />
            {account}
            <Link to="/request-demo" className={pillButton('primary')}>Book a demo</Link>
          </div>
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--nv-chrome-fg)] hover:bg-[var(--nv-chrome-hover)]"
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
            'grid md:hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          inert={!open}
        >
          <div className="overflow-hidden">
            <nav className="border-t border-[var(--nv-chrome-border)] px-4 py-4 flex flex-col gap-4" aria-label="Main">
              {LINKS.map((l) => (
                <Link key={l.hash} to={{ pathname: '/', hash: l.hash }} className={navLink} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              ))}
              <Link to={signedIn ? workspace : '/login'} className={navLink} onClick={() => setOpen(false)}>
                {signedIn ? 'Go to workspace' : 'Sign in'}
              </Link>
              <Link to="/request-demo" className={cn(pillButton('primary'), 'self-start')} onClick={() => setOpen(false)}>
                Book a demo
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--nv-line)] py-8 text-sm text-[var(--nv-muted)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row gap-3 justify-between">
          <span>NVIP is built by Netsmartz · since 1999</span>
          <nav className="flex gap-5" aria-label="Footer">
            <Link to="/request-quote" className="text-[var(--nv-orange)] underline underline-offset-4 hover:no-underline">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
