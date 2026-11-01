import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';

type Kind = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  kind: Kind;
  title: string;
  description?: string;
  duration: number;
}

let next = 1;
const subs = new Set<(t: Toast[]) => void>();
let items: Toast[] = [];
const emit = () => subs.forEach((s) => s(items));

function dismiss(id: number) {
  items = items.filter((x) => x.id !== id);
  emit();
}

function push(kind: Kind, title: string, description?: string) {
  // Collapse identical messages fired in quick succession (double clicks, retries).
  if (items.some((t) => t.title === title && t.kind === kind)) return;
  const duration = kind === 'error' ? 5000 : 3200;
  const t = { id: next++, kind, title, description, duration };
  items = [...items, t].slice(-4);
  emit();
  setTimeout(() => dismiss(t.id), duration);
}

export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
  warning: (title: string, description?: string) => push('warning', title, description),
};

const STYLE: Record<Kind, { icon: typeof Info; ring: string; iconBg: string; bar: string }> = {
  success: { icon: CheckCircle2, ring: 'ring-primary/15', iconBg: 'bg-light-green text-primary', bar: 'bg-primary' },
  error: { icon: XCircle, ring: 'ring-danger/20', iconBg: 'bg-danger/10 text-danger', bar: 'bg-danger' },
  info: { icon: Info, ring: 'ring-sky-500/15', iconBg: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500' },
  warning: { icon: AlertTriangle, ring: 'ring-accent/25', iconBg: 'bg-accent/15 text-[#c25a14]', bar: 'bg-accent' },
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
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end" aria-live="polite">
      {list.map((t) => {
        const s = STYLE[t.kind];
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={clsx('toast-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-lift ring-1', s.ring)}
          >
            <div className="flex items-start gap-3 p-3.5 pr-10">
              <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', s.iconBg)}>
                <Icon size={20} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
            </div>
            <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:bg-beige" aria-label="Dismiss">
              <X size={16} />
            </button>
            <span className={clsx('toast-bar absolute bottom-0 left-0 h-0.5', s.bar)} style={{ animationDuration: `${t.duration}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
