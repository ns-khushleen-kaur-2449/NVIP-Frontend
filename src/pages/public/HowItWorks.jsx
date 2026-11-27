import { ArrowRight, CircleCheck, Package, Phone, PhoneCall, PlugZap, Server } from 'lucide-react';
import { ButtonLink, TextLink } from '../../components/primitives';
import ClosingCta from '../../components/landing/ClosingCta';
import { GO_LIVE_STEPS as STEPS, VOICE_STACK as STACK } from '../../config/platform';

/** One icon per step; the step text itself lives in config/platform.js. */
const STEP_ICONS = { demo: PhoneCall, package: Package, provision: Server, connect: PlugZap, live: CircleCheck };

/** What a step is for, in a word, shown above its title. */
const STEP_PHASE = { demo: 'Try', package: 'Choose', provision: 'Set up', connect: 'Configure', live: 'Launch' };

/**
 * How it works (/how-it-works): the full path from demo to live calls, then the managed voice stack.
 * This is the one place the steps are told; the landing page links here rather than repeating them.
 */
export default function HowItWorks() {
  return (
    <>
      <section aria-labelledby="hiw-title" className="bg-[var(--nv-bg)]">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:pb-20 lg:pt-24">
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
            {/* Intro: stays in view beside the steps on wide screens. */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--nvp-orange-text,var(--nv-orange-ink))]">How it works</p>
                <h1 id="hiw-title" className="nvp-h2 mt-4">From demo to live calls in five steps</h1>
                <p className="nvp-lede mt-5 max-w-md text-[var(--nv-muted)]">
                  You talk to a real agent first, then we set up your workspace. Nothing calls your customers or writes to
                  your systems until you have tested it and approved activation.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink to="/request-demo" size="lg">
                    <Phone className="h-4 w-4" aria-hidden /> Book a demo
                  </ButtonLink>
                  <ButtonLink to="/pricing" size="lg" variant="secondary">See pricing</ButtonLink>
                </div>
              </div>
            </div>

            {/* The steps, as a numbered timeline. */}
            <ol className="relative lg:col-span-7" aria-label="Steps to go live">
              <span aria-hidden className="absolute bottom-10 left-[23px] top-10 w-px bg-[var(--nv-line)]" />
              {STEPS.map((step, i) => {
                const Icon = STEP_ICONS[step.id] || CircleCheck;
                const last = i === STEPS.length - 1;
                return (
                  <li key={step.id} className={`relative flex gap-5 sm:gap-7 ${last ? '' : 'pb-6'}`}>
                    <span
                      className={`relative z-[1] grid h-12 w-12 shrink-0 place-items-center rounded-full border text-base font-bold tabular-nums ${
                        last
                          ? 'border-transparent bg-[var(--nv-orange)] text-[var(--nv-on-orange,#fff)] shadow-[0_12px_24px_-12px_rgba(254,119,37,0.9)]'
                          : 'border-[var(--nv-line)] bg-[var(--nv-bg)] text-[var(--nv-ink)]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)] p-5 transition-colors duration-200 hover:border-[var(--nv-orange)]/40 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--nv-muted)]">
                            Step {i + 1} · {STEP_PHASE[step.id]}
                          </p>
                          <h2 className="mt-1.5 text-xl font-bold tracking-[-0.015em]">{step.title}</h2>
                        </div>
                        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--nv-orange-soft)] text-[var(--nvp-orange-text,var(--nv-orange-ink))]">
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>
                      <p className="mt-3 max-w-prose leading-relaxed text-[var(--nv-muted)]">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="stack-title" className="bg-[var(--nv-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 border-t border-[var(--nv-line)] py-16 lg:grid-cols-12 lg:gap-12 lg:py-20">
            <div className="lg:col-span-4">
              <h2 id="stack-title" className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">Runs on a managed voice stack</h2>
              <p className="mt-3 leading-relaxed text-[var(--nv-muted)]">
                You get a login to your NVIP workspace, never raw provider credentials. NVIP manages the voice stack for you.
              </p>
              <TextLink to="/#agents" className="mt-5 font-semibold">
                Meet the agents <ArrowRight className="h-4 w-4" aria-hidden />
              </TextLink>
            </div>
            <ul className="grid gap-px self-start overflow-hidden rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-line)] sm:grid-cols-3 lg:col-span-8">
              {STACK.map((s) => (
                <li key={s.name} className="bg-[var(--nv-surface)] p-6 sm:p-7">
                  <p className="text-xl font-bold tracking-[-0.02em]">{s.name}</p>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed text-[var(--nv-muted)]">{s.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ClosingCta />
    </>
  );
}
