import { useState } from 'react';
import clsx from 'clsx';
import { produceEmoji, produceTile } from '@sabjiilelo/shared';

/** Item photo with a friendly emoji tile when there is no photo (or it fails to load). */
export function ProduceImage({ src, name, className, emojiClass = 'text-5xl' }: { src?: string | null; name: string; className?: string; emojiClass?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={clsx('object-cover', className)} />;
  }
  return (
    <div className={clsx('flex items-center justify-center', className)} style={{ background: produceTile(name) }} aria-label={name}>
      <span className={clsx('select-none drop-shadow-sm', emojiClass)}>{produceEmoji(name)}</span>
    </div>
  );
}
