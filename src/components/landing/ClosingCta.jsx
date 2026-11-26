import { Phone } from 'lucide-react';
import { ButtonLink } from '@/components/primitives';

/** The page's close: one orange panel on the cream page. `.nvp-cta` makes navy the action colour on the orange. */
export default function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-6 lg:py-24">
      <div className="nvp-cta mx-auto flex max-w-7xl flex-col gap-8 rounded-[28px] px-6 py-12 shadow-[0_34px_70px_-44px_rgba(254,119,37,0.55)] sm:px-10 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:px-14">
        <div className="max-w-2xl">
          <h2 id="cta-title" className="nvp-h2">Talk to an agent before you buy</h2>
          <p className="nvp-lede mt-4 text-[var(--nv-muted)]">
            Book a demo on the same voice stack your agent will run on, with no writes to your real systems.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:shrink-0">
          <ButtonLink to="/request-demo" size="lg"><Phone className="h-4 w-4" aria-hidden /> Book a demo</ButtonLink>
          <ButtonLink to="/request-quote" size="lg" variant="secondary" className="border-transparent">Get a quote</ButtonLink>
        </div>
      </div>
    </section>
  );
}
