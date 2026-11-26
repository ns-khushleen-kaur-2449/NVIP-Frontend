import { ArrowUpRight } from 'lucide-react';
import { NETSMARTZ_FACTS, NETSMARTZ_URL } from '@/config/platform';

/** Parent-brand proof: only the Netsmartz facts the user approved (config/platform.js). */
export default function NetsmartzBand() {
  return (
    <section aria-labelledby="netsmartz-title" className="nvp-band">
      <div className="mx-auto grid max-w-7xl items-end gap-14 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-7">
          {/* No logo here: the header already carries it; the heading names Netsmartz. */}
          <h2 id="netsmartz-title" className="nvp-h2">Built and backed by Netsmartz</h2>
          <p className="nvp-lede mt-5 max-w-xl text-[var(--nv-muted)]">
            NVIP is a Netsmartz product. Netsmartz is a software and AI services company that has worked with clients around the world since 1999.
          </p>
          <a
            href={NETSMARTZ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-1.5 rounded-sm font-semibold text-[var(--nv-orange-ink)] underline-offset-4 hover:underline"
          >
            About Netsmartz <ArrowUpRight className="h-4 w-4" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <dl className="divide-y divide-[var(--nv-line)] border-y border-[var(--nv-line)] lg:col-span-5">
          {NETSMARTZ_FACTS.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-6 py-4">
              <dt className="text-[var(--nv-muted)]">{f.label}</dt>
              <dd className="text-2xl font-bold tracking-[-0.03em] tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
