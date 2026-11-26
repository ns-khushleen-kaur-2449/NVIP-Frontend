import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import netsmartzOnLight from '@/assets/netsmartz-27-on-light.png';
import netsmartzOnDark from '@/assets/netsmartz-27-on-dark.png';

// Intrinsic size of both logo files, so the browser reserves the right box before they load.
const LOGO_W = 860;
const LOGO_H = 198;

/**
 * The Netsmartz logo as the public site's home link. tone="auto" follows the public theme; tone="onDark" always uses the white-lettered logo.
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
      {/* The logo alone: no "NVIP" word and no product name beside it (the hero carries the name). */}
    </Link>
  );
}
