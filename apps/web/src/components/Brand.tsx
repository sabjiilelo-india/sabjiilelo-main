import { Link } from 'react-router-dom';
import clsx from 'clsx';

/** Logo mark + wordmark. The full logo artwork is too small to read at header size, so the name is set in type. */
export function Brand({ to = '/', compact, light, className }: { to?: string; compact?: boolean; light?: boolean; className?: string }) {
  return (
    <Link to={to} className={clsx('flex shrink-0 items-center gap-2', className)} aria-label="Sabjii Le Lo home">
      <span className={clsx('flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl shadow-sm', light ? 'bg-white/95' : 'bg-white ring-1 ring-line')}>
        <img src="/images/logo.png" alt="" className="h-9 w-9 object-contain" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={clsx('block text-[17px] font-bold tracking-tight', light ? 'text-white' : 'text-primary')}>
            Sabjii <span className="text-accent">Le Lo</span>
          </span>
          <span className={clsx('block font-script text-[15px]', light ? 'text-[#9be36f]' : 'text-leaf')}>farm fresh daily</span>
        </span>
      )}
    </Link>
  );
}
