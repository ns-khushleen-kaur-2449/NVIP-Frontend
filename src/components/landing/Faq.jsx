import * as Accordion from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import { TextLink } from '@/components/primitives';

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

/** Questions buyers ask. Pricing has its own page (/pricing), so the landing page links there instead of repeating it. */
export default function Faq() {
  return (
    <section aria-labelledby="faq-title" className="bg-[var(--nv-bg)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:gap-20 lg:py-28">
        <div className="lg:col-span-4">
          <h2 id="faq-title" className="nvp-h2">Questions buyers ask</h2>
          <p className="nvp-lede mt-4 max-w-sm text-[var(--nv-muted)]">
            The short answers. The full path from demo to live calls is on <TextLink to="/how-it-works">How it works</TextLink>, and
            every tier is on <TextLink to="/pricing">Pricing</TextLink>.
          </p>
        </div>
        <div className="lg:col-span-8">
          <Accordion.Root type="single" collapsible className="border-t border-[var(--nv-line)]">
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
