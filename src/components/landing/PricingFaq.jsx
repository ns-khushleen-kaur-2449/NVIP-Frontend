import * as Accordion from '@radix-ui/react-accordion';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { AgentTile, ButtonLink } from '@/components/primitives';

/** Answers drawn from the platform's own documentation (How it works, agent guardrails, pricing notes). */
const FAQS = [
  {
    q: 'Do we need our own Twilio, Vapi or ElevenLabs accounts?',
    a: 'No. NVIP manages the voice stack for you. Your team gets a login to the NVIP workspace, never raw provider credentials.',
  },
  {
    q: 'Does NVIP replace our CRM or ATS?',
    a: 'No. Agents look up and update your CRM, ATS or property system, and it stays the system of record.',
  },
  {
    q: 'Can we try an agent before going live?',
    a: 'Yes. A demo runs on a sandboxed agent with the same voice stack and no writes to your real systems. Before go-live you run test calls and pass an acceptance checklist.',
  },
  {
    q: 'Which calendars can agents book into?',
    a: 'Agents book through Nylas, which connects Google, Outlook and Exchange calendars.',
  },
  {
    q: 'What guardrails are built in?',
    a: 'Each agent ships with fixed guardrails that admins can see but not switch off: for example do-not-call and consent checks before every outbound dial, no automatic hire or reject decisions, and fair-housing scripting for real estate.',
  },
  {
    q: 'How is pricing structured?',
    a: "Per agent. Every agent has Starter, Growth and Enterprise tiers, and usage beyond what a tier includes is itemized separately. Enterprise volumes are quoted.",
  },
];

/** Pricing snapshot (from the live agent list) beside the FAQ. Agent names here are not headings. */
export default function PricingFaq({ agents }) {
  return (
    <section aria-labelledby="pricing-title" className="bg-[var(--nv-bg)]">
      <div className="mx-auto grid max-w-7xl gap-16 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:gap-20 lg:py-28">
        <div className="lg:col-span-5">
          <h2 id="pricing-title" className="nvp-h2">Priced per agent</h2>
          <p className="mt-4 max-w-md leading-relaxed text-[var(--nv-muted)]">
            Every agent has Starter, Growth and Enterprise tiers. Usage beyond what's included is itemized separately.
          </p>
          {agents?.length > 0 && (
            <ul className="mt-8 divide-y divide-[var(--nv-line)] border-y border-[var(--nv-line)]">
              {agents.map((a) => (
                <li key={a.type}>
                  <Link to={`/pricing#${a.slug}`} className="group flex items-center gap-4 rounded-sm py-4">
                    <AgentTile agent={a} size="sm" tone="neutral" />
                    <span className="flex-1 font-semibold transition-colors group-hover:text-[var(--nv-orange-ink)]">{a.name}</span>
                    <span className="text-sm text-[var(--nv-muted)]">
                      From <span className="font-bold tabular-nums text-[var(--nv-ink)]">${a.startingPrice}</span>/mo
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--nv-muted)] transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <ButtonLink to="/pricing" variant="secondary" className="mt-8">Compare all tiers</ButtonLink>
        </div>

        <div className="lg:col-span-7">
          <h2 className="nvp-h2">Questions buyers ask</h2>
          <Accordion.Root type="single" collapsible className="mt-8 border-t border-[var(--nv-line)]">
            {FAQS.map((f, i) => (
              <Accordion.Item key={f.q} value={`faq-${i}`} className="border-b border-[var(--nv-line)]">
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 rounded-sm py-5 text-left text-[1.05rem] font-semibold transition-colors hover:text-[var(--nv-orange-ink)]">
                    {f.q}
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--nv-line)] transition-[transform,background-color,border-color] duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:border-[var(--nv-orange)] group-data-[state=open]:bg-[var(--nv-orange)] group-data-[state=open]:text-[var(--nv-on-orange)]">
                      <Plus className="h-4 w-4" aria-hidden />
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
                  <p className="max-w-[62ch] pb-6 pr-12 leading-relaxed text-[var(--nv-muted)]">{f.a}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </div>
    </section>
  );
}
