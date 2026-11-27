import { motion, useReducedMotion } from 'framer-motion';
import {
  AudioWaveform, CalendarCheck, CalendarDays, CirclePlay, DatabaseZap, Mail, Phone,
  PhoneCall, UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ButtonLink } from '@/components/primitives';
import { INTEGRATIONS } from '@/config/platform';
import zohoLogo from '@/assets/zoho.png';
import twilioLogo from '@/assets/twilio.png';
import OrbStage from './OrbStage';

const EASE_OUT = [0.16, 1, 0.3, 1];


/** A floating capability chip around the orb. */
function Chip({ icon: Icon, className, delay = 0, drift = 0, reduce, children }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, delay: 0.55 + delay, ease: EASE_OUT }}
      className={cn('absolute', className)}
    >
      <div
        className="nvp-drift flex items-center gap-2.5 rounded-2xl border border-[var(--nv-line)] bg-[var(--nv-surface)] py-2 pl-2 pr-3.5 shadow-[var(--nvp-shadow-chip)] sm:gap-3 sm:py-2.5 sm:pl-2.5 sm:pr-4"
        style={{ animationDelay: `${-drift}s` }}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--nv-orange-soft)] text-[var(--nvp-orange-text)] sm:h-9 sm:w-9">
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
        </span>
        <span className="max-w-[7.5rem] text-[0.78rem] font-semibold leading-tight sm:max-w-[8.5rem] sm:text-[0.84rem]">{children}</span>
      </div>
    </motion.div>
  );
}

function HeroVisual({ reduce }) {
  return (
    <div
      role="img"
      aria-label="The NVIP voice agent: a glass orb wearing headphones on a glowing stand. It answers every call, books meetings in your calendar, qualifies leads and syncs with your CRM."
      className="relative mx-auto aspect-[11/10] w-full max-w-[440px] sm:max-w-[560px] lg:max-w-[610px]"
    >
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: EASE_OUT }}
      >
        <OrbStage />
      </motion.div>

      <Chip icon={PhoneCall} reduce={reduce} className="left-0 top-[13%] sm:-left-[3%]" delay={0} drift={0}>
        Answer every call
      </Chip>
      <Chip icon={CalendarCheck} reduce={reduce} className="right-0 top-[5%] sm:-right-[1%]" delay={0.12} drift={2.3}>
        Book meetings in your calendar
      </Chip>
      <Chip icon={UserCheck} reduce={reduce} className="-left-[3%] top-[58%] hidden sm:block" delay={0.24} drift={4.1}>
        Qualify leads automatically
      </Chip>
      <Chip icon={DatabaseZap} reduce={reduce} className="-right-[2%] top-[55%] hidden sm:block" delay={0.36} drift={5.6}>
        Sync with your CRM
      </Chip>
    </div>
  );
}

const INTEGRATION_MARKS = {
  // zoho.png has wide transparent margins: 30px tall draws the blocks at about the 16px icon height, and the negative
  // margin keeps the tile's text row on the same baseline as the others. "CRM" completes it as "ZOHO CRM".
  zoho: { logo: zohoLogo, className: '-my-[9px] h-[34px]', label: 'CRM' },
  twilio: { logo: twilioLogo, className: 'h-[22px]' },
  'google-calendar': { icon: CalendarDays },
  outlook: { icon: Mail },
  vapi: { icon: AudioWaveform },
};

/** What NVIP connects to. Only shipped integrations (config/platform.js). */
function IntegrationsStrip({ reduce }) {
  return (
    <motion.div
      id="integrations"
      className="relative mx-auto max-w-7xl scroll-mt-28 px-4 pb-16 sm:px-6 lg:pb-20"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5, ease: EASE_OUT }}
    >
      <div className="flex flex-col gap-6 rounded-3xl border border-[var(--nv-line)] bg-[var(--nv-surface)] p-5 shadow-[var(--nvp-shadow-card)] sm:p-6 lg:flex-row lg:items-center lg:gap-8 lg:pl-8">
        <div className="lg:w-[13.5rem] lg:shrink-0">
          <h2 className="text-lg font-bold tracking-[-0.015em]">Works with your stack</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--nv-muted)]">
            Connect the tools you already use and keep your workflows in sync.
          </p>
        </div>
        <ul aria-label="Integrations" className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 [&>li:last-child]:col-span-2 sm:[&>li:last-child]:col-span-1">
          {INTEGRATIONS.map((item) => {
            const mark = INTEGRATION_MARKS[item.id] ?? {};
            const Icon = mark.icon;
            return (
              <li
                key={item.id}
                className="flex h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--nv-line)] px-2 text-center"
              >
                {mark.logo && mark.label ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[0.9rem] font-bold tracking-[-0.015em]">
                    <img src={mark.logo} alt={item.name.replace(` ${mark.label}`, '')} className={cn('w-auto object-contain', mark.className)} />
                    {mark.label}
                  </span>
                ) : mark.logo ? (
                  <img src={mark.logo} alt={item.name} className={cn('w-auto max-w-full object-contain', mark.className)} />
                ) : (
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[0.9rem] font-bold tracking-[-0.015em]">
                    <Icon className="h-4 w-4 shrink-0 text-[var(--nvp-orange-text)]" aria-hidden /> {item.name}
                  </span>
                )}
                <span className="text-[0.72rem] font-medium text-[var(--nv-muted)]">{item.role}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}

/**
 * Landing hero, after the approved mockup: warm cream page, the Netsmartz logo and the NVIP wordmark leading the left
 * column (the SmartSDR arrangement), the 3D voice orb on its stand at right, and the integrations strip under both.
 */
export default function LandingHero() {
  const reduce = useReducedMotion();
  const rise = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE_OUT },
  });

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div aria-hidden className="nvp-hero-bg pointer-events-none absolute inset-0" />
      <div aria-hidden className="nvp-hero-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-12 lg:gap-4 lg:pb-14 lg:pt-12">
        <div className="lg:col-span-6 lg:pr-2">
          {/* Product name, straight under the header's Netsmartz logo, so it starts at "Voice". One colour; the
              orange bar is the accent. It is the largest line here; the H1 below sits a step smaller. */}
          <motion.div className="-ml-4 flex items-stretch gap-3 sm:-ml-5 sm:gap-4" {...rise(0)}>
            <span aria-hidden className="w-1 shrink-0 rounded-full bg-gradient-to-b from-[#FE7725] to-[#FE7725]/0" />
            <p className="nvp-fullname nvp-fullname--hero">
              {/* Always two lines: "Voice Intelligence" then "Platform", at every width. */}
              <span className="block">Voice Intelligence</span>
              <span className="block">Platform</span>
              <span className="sr-only"> (NVIP)</span>
            </p>
          </motion.div>
          <motion.h1 id="hero-title" className="nvp-display mt-8 max-w-[22ch] sm:mt-10" {...rise(0.08)}>
            Meet the AI voice agents that move <span className="text-[var(--nvp-orange-text)]">your business forward.</span>
          </motion.h1>
          <motion.p className="nvp-lede mt-5 max-w-[32rem] text-[var(--nv-muted)]" {...rise(0.16)}>
            Automate conversations, qualify leads, manage customer interactions and book appointments — all through
            intelligent AI voice agents.
          </motion.p>
          <motion.div className="mt-9 flex flex-wrap gap-3" {...rise(0.24)}>
            <ButtonLink to="/request-demo" size="lg" className="shadow-[0_14px_28px_-14px_rgba(254,119,37,0.9)]">
              <Phone className="h-4 w-4" aria-hidden /> Book a demo
            </ButtonLink>
            <ButtonLink to="/#agents" size="lg" variant="secondary">
              <CirclePlay className="h-[18px] w-[18px] text-[var(--nvp-orange-text)]" aria-hidden /> Explore AI agents
            </ButtonLink>
          </motion.div>
        </div>
        <div className="lg:col-span-6">
          <HeroVisual reduce={reduce} />
        </div>
      </div>
      <IntegrationsStrip reduce={reduce} />
    </section>
  );
}
