import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import netsmartzOnLight from '@/assets/netsmartz-27-on-light.png';
import netsmartzOnDark from '@/assets/netsmartz-27-on-dark.png';

// Intrinsic size of both logo files, so the browser reserves the right box before they load.
const LOGO_W = 860;
const LOGO_H = 198;

/**
 * Netsmartz │ NVIP lockup for the public site. The parent-brand logo leads (it is the larger mark), then a hairline
 * and the product name. tone="auto" follows the public theme; tone="onDark" always uses the white-lettered logo.
 */
export default function NvipLockup({ tone = 'auto', to = '/', className, onClick }) {
  const img = 'h-[34px] sm:h-[42px] w-auto max-w-none select-none';
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label="NVIP by Netsmartz, home"
      className={cn('group flex shrink-0 items-center gap-3 rounded-md text-[var(--nv-chrome-fg)]', className)}
    >
      {tone === 'onDark' ? (
        <img src={netsmartzOnDark} width={LOGO_W} height={LOGO_H} alt="" draggable={false} className={img} />
      ) : (
        <>
          <img src={netsmartzOnLight} width={LOGO_W} height={LOGO_H} alt="" draggable={false} className={cn(img, 'nvp-logo-light')} />
          <img src={netsmartzOnDark} width={LOGO_W} height={LOGO_H} alt="" draggable={false} className={cn(img, 'nvp-logo-dark')} />
        </>
      )}
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-current opacity-20" />
      <span className="flex flex-col leading-none">
        <span className="text-[1.05rem] font-bold tracking-[-0.03em]">N<span className="text-[var(--nvp-orange-text,#E4580B)]">VIP</span></span>
        <span className="mt-1 hidden text-[0.66rem] font-medium tracking-[0.01em] opacity-70 lg:block">Voice Intelligence Platform</span>
      </span>
    </Link>
  );
}
