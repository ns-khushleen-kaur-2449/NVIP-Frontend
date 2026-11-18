import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { AGENTS } from '../../config/agents';
import { accessApi } from '../../api/services';
import { errorMessage } from '../../api/client';
import { cn } from '@/lib/utils';
import { Button, ButtonLink, Panel } from '../../components/primitives';
import Field from '../../components/Field';
import SignInBackdrop, { SIGN_IN_PAGE_BG } from '@/components/marketing/SignInBackdrop';

const COPY = {
  demo: {
    title: 'Book a demo',
    subtitle: "Talk to a live, sandboxed agent. We'll send a calendar invite with a time that works.",
    submit: 'Request demo',
  },
  quote: {
    title: 'Request a quote',
    subtitle: 'Enterprise volumes, dedicated numbers, custom SLAs or a custom agent — our sales team will reply.',
    submit: 'Request quote',
  },
};

/** Demo & quote requests — no account required (FR-PORTAL-03, FR-PRICE-04). */
export default function RequestAccess({ kind }) {
  const copy = COPY[kind];
  const [params] = useSearchParams();
  const [status, setStatus] = useState({ sending: false, error: null, done: false });
  // Agents of interest: any number (none = not sure yet). A card's "Book a demo" link may preselect one (?agent=slug).
  const [agents, setAgents] = useState(() => {
    const preset = params.get('agent');
    return AGENTS.some((a) => a.slug === preset) ? [preset] : [];
  });
  const toggleAgent = (slug) => setAgents((current) => (
    current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]));

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.delete('agents');
    // In the catalog's order, whatever order they were ticked in.
    const payload = { ...Object.fromEntries(form), agents: AGENTS.map((a) => a.slug).filter((s) => agents.includes(s)) };
    setStatus({ sending: true, error: null, done: false });
    try {
      await accessApi.submitRequest(kind, payload);
      setStatus({ sending: false, error: null, done: true });
    } catch (err) {
      setStatus({ sending: false, error: errorMessage(err), done: false });
    }
  }

  const page = (children) => (
    <div className={cn('relative isolate min-h-[calc(100vh-5.25rem)] overflow-hidden', SIGN_IN_PAGE_BG)}>
      <SignInBackdrop />
      {children}
    </div>
  );

  if (status.done) {
    return page(
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-[var(--nv-success)]" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Request received</h1>
        <p className="mt-2 text-[var(--nv-muted)]">Our team will be in touch within one business day.</p>
        <ButtonLink to="/" variant="secondary" className="mt-8">Back to agents</ButtonLink>
      </div>,
    );
  }

  return page(
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-[var(--nv-muted)]">{copy.subtitle}</p>

      {/* The sign-in card's look: white in light mode, a lifted dark card with an orange hairline in dark mode. */}
      <Panel className="mt-8 p-6 sm:p-8 bg-white shadow-[0_24px_60px_-32px_rgba(23,19,15,0.25)] dark:border-[rgba(248,114,23,0.16)] dark:bg-[#0E0C0B] dark:shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)]">
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="name" required autoComplete="name" />
          <Field label="Work email" name="email" type="email" required autoComplete="email" />
          <Field label="Company" name="company" required autoComplete="organization" />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 block text-sm font-semibold">Agents of interest</legend>
            <p className="mb-2.5 text-xs text-[var(--nv-muted)]">Pick any number, or none if you're not sure yet.</p>
            <div className="flex flex-wrap gap-2">
              {AGENTS.map((a) => {
                const on = agents.includes(a.slug);
                return (
                  <label key={a.slug}
                    className={cn('flex cursor-pointer select-none items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                      'focus-within:ring-2 focus-within:ring-[var(--nv-orange)]/40',
                      on ? 'border-[var(--nv-orange)] bg-[var(--nv-orange-soft)] text-[var(--nv-ink)]'
                        : 'border-[var(--nv-line)] text-[var(--nv-muted)] hover:border-[var(--nv-orange)] hover:text-[var(--nv-ink)]')}>
                    <input type="checkbox" name="agents" value={a.slug} checked={on} onChange={() => toggleAgent(a.slug)}
                      className="h-4 w-4 accent-[var(--nv-orange)]" />
                    {a.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <input type="hidden" name="tier" value={params.get('tier') || ''} />
          <Field label="Anything we should know?" name="notes" as="textarea" className="sm:col-span-2" />
          {status.error && <p className="sm:col-span-2 text-sm text-[var(--nv-danger)]" role="alert">{status.error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={status.sending}>{status.sending ? 'Sending…' : copy.submit}</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
