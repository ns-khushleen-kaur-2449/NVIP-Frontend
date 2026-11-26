import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { AGENTS } from '@/config/agents';
import { NETSMARTZ_URL, VOICE_STACK } from '@/config/platform';

const linkClass = 'text-[var(--nv-muted)] transition-colors hover:text-[var(--nv-ink)] rounded-sm';

function Column({ title, children }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--nv-ink)]">{title}</p>
      <ul className="mt-4 space-y-3 text-[0.95rem]">{children}</ul>
    </div>
  );
}

/** Public-site footer: always on deep navy, like netsmartz.com. */
export default function PublicFooter({ signedIn, workspace }) {
  return (
    <footer className="nvp-band border-t border-[var(--nv-line)]">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            {/* No logo in the footer: the product name alone, as the link home. */}
            <Link to="/" className="inline-block rounded-sm text-xl font-bold tracking-[-0.02em] text-[var(--nv-ink)]">
              Voice Intelligence Platform
            </Link>
            <p className="mt-6 max-w-sm leading-relaxed text-[var(--nv-muted)]">
              One portal for every Netsmartz voice agent. Each agent is a configuration on the same managed platform, not a separate app.
            </p>
            <a
              href={NETSMARTZ_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 rounded-sm font-semibold text-[var(--nv-orange-ink)] hover:underline underline-offset-4"
            >
              netsmartz.com <ArrowUpRight className="h-4 w-4" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            <Column title="Agents">
              {AGENTS.map((a) => (
                <li key={a.type}><Link to={`/marketplace/${a.slug}`} className={linkClass}>{a.name}</Link></li>
              ))}
            </Column>
            <Column title="Platform">
              <li><Link to="/pricing" className={linkClass}>Pricing</Link></li>
              <li><Link to="/how-it-works" className={linkClass}>How it works</Link></li>
              <li><Link to="/request-demo" className={linkClass}>Book a demo</Link></li>
              <li><Link to="/request-quote" className={linkClass}>Get a quote</Link></li>
            </Column>
            <Column title="Account">
              <li>
                <Link to={signedIn ? workspace : '/login'} className={linkClass}>{signedIn ? 'Go to workspace' : 'Sign in'}</Link>
              </li>
            </Column>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[var(--nv-line)] pt-6 text-sm text-[var(--nv-muted)] sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Netsmartz · Voice Intelligence Platform</span>
          <span>Built on {VOICE_STACK.map((s) => s.name).join(' · ')}</span>
        </div>
      </div>
    </footer>
  );
}
