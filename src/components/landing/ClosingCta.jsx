import { Phone } from 'lucide-react';
import { ButtonLink } from '@/components/primitives';

/** The page's close: a frosted glass panel over two soft orange glows (`.nvp-cta`, `.nvp-cta-glow` in index.css). */
export default function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate px-4 py-20 sm:px-6 lg:py-24">
      <div className="relative mx-auto max-w-7xl">
        {/* The light the glass blurs: one glow behind each end of the panel. */}
        <span aria-hidden="true" className="nvp-cta-glow -left-10 -top-12 -z-10 h-56 w-56 sm:h-72 sm:w-72" />
        <span aria-hidden="true" className="nvp-cta-glow -bottom-16 -right-6 -z-10 h-64 w-64 sm:h-80 sm:w-80" />
        <div className="nvp-cta flex flex-col gap-8 rounded-[28px] px-6 py-12 sm:px-10 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:px-14">
          <div className="max-w-2xl">
            <h2 id="cta-title" className="nvp-h2">Talk to an agent before you buy</h2>
            <p className="nvp-lede mt-4 text-[var(--nv-muted)]">
              Book a demo on the same voice stack your agent will run on, with no writes to your real systems.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:shrink-0">
            <ButtonLink to="/request-demo" size="lg" className="shadow-[0_14px_28px_-14px_rgba(254,119,37,0.9)]">
              <Phone className="h-4 w-4" aria-hidden /> Book a demo
            </ButtonLink>
            <ButtonLink to="/request-quote" size="lg" variant="secondary">Get a quote</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
