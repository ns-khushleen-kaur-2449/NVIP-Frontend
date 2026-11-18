import HeroWave3D from '@/components/marketing/HeroWave3D';
import { cn } from '@/lib/utils';

/**
 * The sign-in page's background (pages/Login.js), for other pages that should look the same: the 3D wave along the
 * bottom, two slow orange glows and a faint grid. Put it first inside a `relative isolate overflow-hidden` wrapper
 * that also carries SIGN_IN_PAGE_BG; every layer sits at -z-10 and ignores the pointer. `waveClassName` places the wave
 * (default: along the bottom, as on sign-in; a long page such as the landing puts it behind its hero instead).
 */
const WAVE_AT_BOTTOM = 'bottom-0 h-[300px] lg:h-[62%]';

export const SIGN_IN_PAGE_BG = 'bg-[linear-gradient(180deg,#FFF6EC_0%,#FDEBDA_100%)] dark:bg-none dark:bg-[#080808]';

export default function SignInBackdrop({ waveClassName = WAVE_AT_BOTTOM }) {
  return (
    <>
      <HeroWave3D className={cn('pointer-events-none absolute inset-x-0 -z-10 opacity-50', waveClassName)} />
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(248,114,23,0.30), transparent 62%)' }} />
      <div className="pointer-events-none absolute -bottom-48 -right-32 -z-10 h-[30rem] w-[30rem] rounded-full mk-aurora"
        style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.20), transparent 62%)', animationDelay: '5s' }} />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '52px 52px', maskImage: 'radial-gradient(ellipse at 40% 40%, black, transparent 75%)' }} />
    </>
  );
}
