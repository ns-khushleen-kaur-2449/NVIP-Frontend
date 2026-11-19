import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CircleCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENTS, CATEGORIES, runsOnBackend } from '@/config/agents';
import { AsyncBoundary, ButtonLink, EmptyState } from '@/components/primitives';

const EASE_OUT = [0.16, 1, 0.3, 1];
/** An agent with a backend agent type is live; the rest are on the way (config/agents.js). */
function StatusBadge({ agent }) {
  const available = runsOnBackend(agent.backend ? agent : AGENTS.find((a) => a.type === agent.type));
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold',
        available ? 'bg-[var(--nv-success-bg)] text-[var(--nv-success)]' : 'bg-[var(--nv-surface-2)] text-[var(--nv-muted)]',
      )}
    >
      {available ? 'Available' : 'Coming soon'}
    </span>
  );
}

const TILT_QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/** Tilt only with a real mouse and when the visitor has not asked for reduced motion. */
function useCanTilt() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.(TILT_QUERY);
      mq?.addEventListener?.('change', cb);
      return () => mq?.removeEventListener?.('change', cb);
    },
    () => window.matchMedia?.(TILT_QUERY).matches ?? false,
    () => false,
  );
}

function AgentCard({ agent, tilt }) {
  // Pointer position drives the tilt and the soft orange sheen; written straight to CSS variables (no re-render).
  const onMove = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (tilt) {
      el.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
    }
  };
  const onLeave = (e) => {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  };

  const Icon = agent.icon;
  return (
    <Link
      // /marketplace, not /agents: in the app /agents/:agentType is an agent's configuration (e.g. /agents/sdr_outbound).
      to={`/marketplace/${agent.slug}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn(
        'group relative flex h-full flex-col rounded-[22px] border p-6 shadow-[var(--nvp-shadow-card)] sm:p-7',
        '[transform:perspective(1100px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_translateY(var(--lift,0px))]',
        '[transition:transform_0.5s_cubic-bezier(0.16,1,0.3,1),box-shadow_0.35s_ease,border-color_0.35s_ease]',
        'hover:shadow-[var(--nvp-shadow-lift)] hover:[--lift:-6px] focus-visible:[--lift:-6px]',
        'motion-reduce:hover:[--lift:0px] motion-reduce:focus-visible:[--lift:0px]',
        agent.popular
          ? 'border-[var(--nv-orange)] bg-[linear-gradient(180deg,var(--nv-orange-soft)_0%,var(--nv-surface)_55%)]'
          : 'border-[var(--nv-line)] bg-[var(--nv-surface)] hover:border-[rgba(254,119,37,0.7)]',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgba(254, 119, 37, 0.1), transparent 45%)' }}
      />
      {agent.popular && (
        <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-[var(--nv-orange)] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-[var(--nv-on-orange)] shadow-[0_8px_18px_-10px_rgba(254,119,37,0.9)]">
          <Sparkles className="h-3 w-3" aria-hidden /> Most popular
        </span>
      )}
      <div className="relative flex items-start gap-4">
        <span
          aria-hidden
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--nv-orange-soft)] text-[var(--nvp-orange-text)] ring-1 ring-inset ring-[rgba(254,119,37,0.18)] transition-transform duration-500 group-hover:scale-105"
        >
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="text-[1.2rem] font-bold leading-snug tracking-[-0.02em]">{agent.name}</h3>
            <StatusBadge agent={agent} />
          </div>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-[var(--nv-muted)]">{agent.summary}</p>
        </div>
      </div>
      <ul className="relative mt-5 grid gap-2 text-[0.9rem]">
        {agent.tools.slice(0, 3).map((tool) => (
          <li key={tool} className="flex gap-2.5">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nvp-orange-text)]" aria-hidden /> {tool}
          </li>
        ))}
      </ul>
      <div className="relative mt-auto pt-6">
        <div className="flex items-center justify-between gap-3 border-t border-[var(--nv-line)] pt-5">
          <span className="text-sm text-[var(--nv-muted)]">
            From <span className="text-base font-bold tabular-nums text-[var(--nv-ink)]">${agent.startingPrice}</span>/mo
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--nv-orange-ink)]">
            Explore agent <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CustomCard() {
  return (
    <div className="relative flex h-full flex-col rounded-[22px] border border-dashed border-[rgba(254,119,37,0.5)] bg-[var(--nv-surface-2)] p-6 sm:p-7">
      <div className="relative flex items-start gap-4">
        <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--nv-surface)] text-[var(--nvp-orange-text)] shadow-[var(--nvp-shadow-card)]">
          <Sparkles className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 pt-1">
          <h3 className="text-[1.2rem] font-bold leading-snug tracking-[-0.02em]">Need something custom?</h3>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-[var(--nv-muted)]">
            MSP Service Desk, Voice Commerce and more agents are on the roadmap — talk to us.
          </p>
        </div>
      </div>
      <div className="relative mt-auto pt-7">
        <ButtonLink to="/request-quote">Contact sales <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
      </div>
    </div>
  );
}

function CategoryFilter({ agents, value, onChange, panelId }) {
  const refs = useRef([]);
  const counts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id === 'all' ? agents.length : agents.filter((a) => a.category === c.id).length])),
    [agents],
  );

  // Tabs pattern: arrows, Home and End move between categories.
  const onKeyDown = (e, i) => {
    const last = CATEGORIES.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(CATEGORIES[next].id);
    refs.current[next]?.focus();
  };

  return (
    // Pills wrap on narrow screens rather than scroll, so a label is never cut.
    <div>
      <div role="tablist" aria-label="Filter agents by category" className="flex flex-wrap justify-center gap-2.5">
        {CATEGORIES.map((c, i) => {
          const active = value === c.id;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`agent-tab-${c.id}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(c.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors duration-200',
                active
                  ? 'border-transparent text-[var(--nv-on-orange)]'
                  : 'border-[var(--nv-line)] bg-[var(--nv-surface)] text-[var(--nv-ink)] shadow-[0_1px_2px_rgba(120,53,15,0.05)] hover:border-[rgba(254,119,37,0.6)]',
              )}
            >
              {active && (
                <motion.span
                  layoutId="agent-filter-pill"
                  className="absolute -inset-px rounded-full bg-[var(--nv-orange)] shadow-[0_10px_22px_-12px_rgba(254,119,37,0.95)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <Icon className={cn('relative h-4 w-4', !active && 'text-[var(--nvp-orange-text)]')} aria-hidden />
              <span className="relative whitespace-nowrap">{c.label}</span>
              <span className={cn('relative tabular-nums', !active && 'text-[var(--nv-muted)]')}>({counts[c.id]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The agent catalog: the page's decision point. Data comes from marketplaceApi.listAgents(). */
export default function AgentShowcase({ query }) {
  const [category, setCategory] = useState('all');
  const tilt = useCanTilt();
  const panelId = 'agent-catalog-panel';

  return (
    <section id="agents" aria-labelledby="agents-title" className="relative scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:pb-28 lg:pt-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="agents-title" className="nvp-h2">Pick the voice agent your business needs</h2>
          <p className="nvp-lede mt-4 text-[var(--nv-muted)]">
            Every agent runs on the same trusted platform — your CRM, ATS or property system stays the system of record.
          </p>
        </div>

        <AsyncBoundary query={query} loadingLabel="Loading agents…">
          {(agents) => {
            const shown = category === 'all' ? agents : agents.filter((a) => a.category === category);
            return (
              <>
                <div className="mt-10">
                  <CategoryFilter agents={agents} value={category} onChange={setCategory} panelId={panelId} />
                </div>
                <div
                  id={panelId}
                  role="tabpanel"
                  aria-labelledby={`agent-tab-${category}`}
                  className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {shown.map((agent) => (
                      <motion.div
                        key={agent.type}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                      >
                        <AgentCard agent={agent} tilt={tilt} />
                      </motion.div>
                    ))}
                    {shown.length === 0 && (
                      <motion.div key="empty" layout className="sm:col-span-2">
                        <EmptyState title="No agents in this category yet" />
                      </motion.div>
                    )}
                    <motion.div key="custom" layout transition={{ duration: 0.4, ease: EASE_OUT }}>
                      <CustomCard />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </>
            );
          }}
        </AsyncBoundary>
      </div>
    </section>
  );
}
