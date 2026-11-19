import { ArrowRight } from 'lucide-react';
import { TextLink } from '@/components/primitives';
import { GO_LIVE_SHORT, VOICE_STACK } from '@/config/platform';

/** How the platform works: three steps to live calls, then the managed voice stack (the only integrations named). */
export default function GoLiveSection() {
  return (
    <section aria-labelledby="golive-title" className="bg-[var(--nv-bg)]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-28">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <h2 id="golive-title" className="nvp-h2 max-w-xl">From demo to live calls in three steps</h2>
          <TextLink to="/how-it-works" className="shrink-0 font-semibold">
            See the full path to live <ArrowRight className="h-4 w-4" aria-hidden />
          </TextLink>
        </div>

        <ol className="relative mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          <span
            aria-hidden
            className="absolute bottom-6 left-[21px] top-6 w-px bg-[var(--nv-line)] md:bottom-auto md:left-6 md:right-6 md:top-[22px] md:h-px md:w-auto"
          />
          {GO_LIVE_SHORT.map((step, i) => (
            <li key={step.id} className="relative pl-16 md:pl-0">
              <span className="absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full border border-[var(--nv-line)] bg-[var(--nv-bg)] text-[0.95rem] font-bold tabular-nums text-[var(--nv-ink)] md:relative">
                {i + 1}
              </span>
              <h3 className="text-xl font-bold tracking-[-0.015em] md:mt-7">{step.title}</h3>
              <p className="mt-2 max-w-sm leading-relaxed text-[var(--nv-muted)]">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-24 grid gap-10 border-t border-[var(--nv-line)] pt-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <h3 className="text-2xl font-bold tracking-[-0.02em]">Runs on a managed voice stack</h3>
            <p className="mt-3 leading-relaxed text-[var(--nv-muted)]">
              You get a login to your NVIP workspace, never raw provider credentials. NVIP manages the voice stack for you.
            </p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-line)] sm:grid-cols-2 lg:col-span-8">
            {VOICE_STACK.map((s) => (
              <li key={s.name} className="bg-[var(--nv-surface)] p-6 sm:p-7">
                <p className="text-xl font-bold tracking-[-0.02em]">{s.name}</p>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-[var(--nv-muted)]">{s.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
