<<<<<<< Updated upstream
// The NVIP landing page (home "/" for guests; App.js SmartRoot). Agents come from config/agents.js: an agent with a
// backend agent type is "Available", the rest "Coming soon". The words on the cards are the landing page's own.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AGENTS, AGENT_TYPES, runsOnBackend } from '../../config/agents';
import { pillButton } from '../../layouts/PublicLayout';
import SignInBackdrop, { SIGN_IN_PAGE_BG } from '@/components/marketing/SignInBackdrop';

// Landing copy per agent, in the order shown.
const CARDS = [
  { type: AGENT_TYPES.OUTBOUND, letter: 'O', name: 'Outbound SDR',
    summary: 'Calls your approved lead lists, qualifies interest, handles objections and books meetings on your calendar.',
    tags: ['Campaigns', 'do-not-call', 'calling hours', 'retries'] },
  { type: AGENT_TYPES.SDR, letter: 'I', name: 'Inbound SDR',
    summary: 'Answers your number, recognises returning callers, qualifies them and books demos — even after hours.',
    tags: ['Business hours', 'overflow', 'known-caller greeting'] },
  { type: AGENT_TYPES.HIRING, letter: 'H', name: 'Hiresmartz',
    summary: 'Screens candidates by phone with your questions and schedules interviews. Hiring decisions stay with your recruiters.',
    tags: ['Structured screening', 'interview booking'] },
  { type: AGENT_TYPES.RECEPTIONIST, letter: 'R', name: 'AI Receptionist',
    summary: 'Answers every call and routes it to the right agent or person with a short summary.',
    tags: ['Routing', 'messages', 'callbacks'] },
  { type: AGENT_TYPES.REAL_ESTATE, letter: 'E', name: 'Real Estate Agent',
    summary: 'Answers property questions from live listing data and books viewings with the right agent.',
    tags: ['Live listings', 'viewing booking'] },
];

const STEPS = [
  { title: 'Set the agent up once',
    body: 'Business details, product catalog, persona, languages and rules. Hear it on a test call before anything goes live.' },
  { title: 'Launch campaigns', body: 'Pick leads, write a short brief, and preview exactly how the first calls will open.' },
  { title: 'Act on results',
    body: 'Meetings land on real calendar slots. Every call has a transcript, an outcome and a lead score you can override.' },
];

const RULES = [
  { title: 'Do-not-call, everywhere', body: 'A lead who says stop is blocked across every campaign straight away.' },
  { title: 'Calling hours', body: "Dials only inside your window, in each lead's own time zone." },
  { title: 'Real calendar slots', body: 'Meetings are offered from a live calendar check, never guessed.' },
  { title: 'Real prices only', body: 'Prices come from your catalog. The agent never invents one.' },
  { title: 'Your data stays yours', body: 'Each organisation is isolated in the database, not just in the app.' },
  { title: 'You can override', body: 'Scores, do-not-call and outcomes can always be corrected by a person.' },
];

const display = 'mk-display tracking-tight';

function StatusBadge({ available }) {
  return (
    <span className={cn('rounded-full px-3 py-1 text-xs font-semibold',
      available ? 'bg-[var(--nv-success-bg)] text-[var(--nv-success)]' : 'bg-[var(--nv-neutral-bg)] text-[var(--nv-muted)]')}>
      {available ? 'Available' : 'Coming soon'}
    </span>
  );
}

function AgentCard({ card, agent }) {
  const available = runsOnBackend(agent);
  return (
    <Link
      // /marketplace, not /agents: in the app /agents/:agentType is an agent's configuration (e.g. /agents/sdr_outbound).
      to={`/marketplace/${agent.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)] p-6 transition-colors hover:border-[var(--nv-orange)]"
    >
      <div className="flex items-start justify-between">
        <span className={cn(display, 'grid h-11 w-11 place-items-center rounded-lg bg-[var(--nv-orange-soft)] text-lg font-bold text-[var(--nv-orange)]')}
          aria-hidden>
          {card.letter}
        </span>
        <StatusBadge available={available} />
      </div>
      <h3 className={cn(display, 'mt-4 text-[1.35rem] font-bold')}>{card.name}</h3>
      <p className="mt-3 leading-relaxed text-[var(--nv-muted)]">{card.summary}</p>
      <p className="mt-auto pt-4 text-sm text-[var(--nv-muted)]/80">{card.tags.join(' · ')}</p>
    </Link>
  );
}

export default function AgentCatalog() {
  const location = useLocation();
  // The header's section links ("/#agents"): scroll there on arrival and when the hash changes.
  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const byType = Object.fromEntries(AGENTS.map((a) => [a.type, a]));
  const cards = CARDS.filter((card) => byType[card.type]);

  return (
    // The sign-in page's background (gradient, glows, grid) over the whole page; its 3D wave sits behind the hero.
    <div className={cn('relative isolate overflow-hidden', SIGN_IN_PAGE_BG)}>
      <SignInBackdrop waveClassName="top-0 h-[460px] sm:h-[560px]" />
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 text-center">
        <span className={cn(display, 'inline-block rounded-full bg-[var(--nv-orange-soft)] px-3.5 py-1 text-xs font-semibold text-[var(--nv-orange)]')}>
          Netsmartz Voice Intelligence Platform
        </span>
        <h1 className={cn(display, 'mt-6 text-[2.6rem] sm:text-6xl font-bold leading-[1.05] tracking-[-0.035em]')}>
          Voice agents that call, qualify and book — <span className="text-[var(--nv-orange)]">on rules you control</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--nv-muted)]">
          Set up an agent once with your business, products and tone. NVIP runs your outbound campaigns and answers your
          inbound calls, while your CRM and calendar stay the source of truth.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/request-demo" className={pillButton('primary')}>Book a demo</Link>
          <Link to="/request-quote" className={pillButton('outline')}>Talk to sales</Link>
        </div>
      </section>

      {/* The agents */}
      <section id="agents" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <h2 className={cn(display, 'text-3xl sm:text-[2.1rem] font-bold')}>The agents</h2>
        <p className="mt-2 text-[var(--nv-muted)]">Each one is a configuration on the same platform, not a separate product to integrate.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => <AgentCard key={card.type} card={card} agent={byType[card.type]} />)}
        </div>
        <p className="mt-8 text-sm text-[var(--nv-muted)]">
          Pricing is set per organisation.{' '}
          <Link to="/request-quote" className="text-[var(--nv-orange)] underline underline-offset-4 hover:no-underline">Ask for a quote</Link>.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 border-y border-[var(--nv-line)] bg-[var(--nv-surface-2)]/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <h2 className={cn(display, 'text-3xl sm:text-[2.1rem] font-bold')}>How it works</h2>
          <ol className="mt-9 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <p className={cn(display, 'text-sm font-semibold text-[var(--nv-orange)]')}>Step {i + 1}</p>
                <h3 className={cn(display, 'mt-2 text-xl font-bold')}>{step.title}</h3>
                <p className="mt-3 leading-relaxed text-[var(--nv-muted)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rules */}
      <section id="trust" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <h2 className={cn(display, 'text-3xl sm:text-[2.1rem] font-bold')}>Every call follows your rules</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RULES.map((rule) => (
            <div key={rule.title} className="rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)] px-5 py-5">
              <h3 className={cn(display, 'font-bold')}>{rule.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--nv-muted)]">{rule.body}</p>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="mt-20 flex flex-col gap-6 rounded-3xl bg-[var(--nv-orange)] px-8 py-10 text-[#1A0E05] sm:flex-row sm:items-center sm:justify-between sm:px-12">
          <div>
            <h2 className={cn(display, 'text-3xl font-bold tracking-[-0.03em]')}>Hear an NVIP agent on your own phone</h2>
            <p className="mt-2">A 20-minute demo with your products and a live test call.</p>
          </div>
          <Link to="/request-demo" className={cn(pillButton('dark'), 'shrink-0 self-start sm:self-auto')}>Book a demo</Link>
        </div>
      </section>
    </div>
=======
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AGENT_TYPES } from '../../config/agents';
import { marketplaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import LandingHero from '../../components/landing/LandingHero';
import AgentShowcase from '../../components/landing/AgentShowcase';
import CallDemo from '../../components/landing/CallDemo';
import GoLiveSection from '../../components/landing/GoLiveSection';
import UseCases from '../../components/landing/UseCases';
import NetsmartzBand from '../../components/landing/NetsmartzBand';
import PricingFaq from '../../components/landing/PricingFaq';
import ClosingCta from '../../components/landing/ClosingCta';

/**
 * Public landing page (`/`): the NVIP agent catalog, after the approved mockup.
 * Every agent fact on the page comes from marketplaceApi.listAgents(); platform facts from config/platform.js.
 * reducedMotion="user" turns framer-motion transforms off for visitors who ask for reduced motion.
 */
export default function AgentCatalog() {
  const query = useNvipQuery(() => marketplaceApi.listAgents(), []);
  const agents = query.data;
  const sdr = agents?.find((a) => a.type === AGENT_TYPES.SDR);

  // Header and hero links such as /#integrations and /#agents land on their section.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

  return (
    <MotionConfig reducedMotion="user">
      <LandingHero />
      <AgentShowcase query={query} />
      <CallDemo agent={sdr} />
      <UseCases agents={agents} />
      <GoLiveSection />
      <NetsmartzBand />
      <PricingFaq agents={agents} />
      <ClosingCta />
    </MotionConfig>
>>>>>>> Stashed changes
  );
}
