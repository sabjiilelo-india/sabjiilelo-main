import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

type Kind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}

let next = 1;
const subs = new Set<(t: Toast[]) => void>();
let items: Toast[] = [];

function push(kind: Kind, text: string) {
  const t = { id: next++, kind, text };
  items = [...items, t].slice(-4);
  subs.forEach((s) => s(items));
  setTimeout(() => {
    items = items.filter((x) => x.id !== t.id);
    subs.forEach((s) => s(items));
  }, kind === 'error' ? 5000 : 3000);
}

export const toast = {
  success: (t: string) => push('success', t),
  error: (t: string) => push('error', t),
  info: (t: string) => push('info', t),
};

export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    subs.add(setList);
    return () => {
      subs.delete(setList);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lift',
              t.kind === 'success' && 'bg-primary',
              t.kind === 'error' && 'bg-danger',
              t.kind === 'info' && 'bg-ink',
            )}
          >
            <Icon size={18} className="shrink-0" />
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
